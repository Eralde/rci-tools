import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import type {GenericObject} from '../../../src';
import {FetchTransport, RciQueue} from '../../../src';

const IP_ADDRESS = process.env['RCI_DEVICE_IP'];

if (!IP_ADDRESS) {
  throw new Error('Device IP address was not provided.');
}

const host = String(IP_ADDRESS).startsWith('http://')
  ? String(IP_ADDRESS)
  : `http://${String(IP_ADDRESS)}`;

const rciPath = `${host}/rci/`;

const SHOW_VERSION = 'show.version';
const SHOW_IDENTIFICATION = 'show.identification';

// fragments of the serialized request bodies, used to tell requests apart
const VERSION_FRAGMENT = '"version"';
const IDENTIFICATION_FRAGMENT = '"identification"';

const originalFetch = global.fetch;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitUntil = async (predicate: () => boolean, timeoutMs: number = 5_000): Promise<void> => {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('waitUntil: condition was not met in time');
    }

    await sleep(10);
  }
};

describe('RciQueue blocker semantics (device)', () => {
  let fetchSpy: any;
  let sentBodies: string[];
  let holds: Array<{match: string; open: Promise<void>}>;
  let releases: Array<() => void>;
  let queues: Array<RciQueue<any>>;

  const sentBodiesWith = (fragment: string): string[] => {
    return sentBodies.filter((body) => body.includes(fragment));
  };

  // The next request whose body contains `match` reaches the device normally,
  // but its response is withheld from the client until the returned function
  // is called. This keeps the sending queue busy for a controlled time span.
  const holdResponse = (match: string): () => void => {
    let release!: () => void;

    const open = new Promise<void>((resolve) => {
      release = resolve;
    });

    holds.push({match, open});
    releases.push(release);

    return release;
  };

  const makeQueues = (batchTimeout: number) => {
    const transport = new FetchTransport();

    const priorityQueue = new RciQueue(rciPath, transport, {
      batchTimeout: 0,
      queueName: 'priority',
    });

    const batchQueue = new RciQueue(rciPath, transport, {
      batchTimeout,
      blockerQueue: priorityQueue,
      queueName: 'batch',
    });

    queues.push(batchQueue, priorityQueue);

    return {priorityQueue, batchQueue};
  };

  beforeEach(() => {
    sentBodies = [];
    holds = [];
    releases = [];
    queues = [];

    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (...args: any[]) => {
      const body = typeof args[1]?.body === 'string' ? args[1].body : '';

      sentBodies.push(body);

      // @ts-ignore
      const response = await originalFetch(...args);
      const holdIndex = holds.findIndex((hold) => body.includes(hold.match));

      if (holdIndex !== -1) {
        const [hold] = holds.splice(holdIndex, 1); // each hold is one-shot

        await hold!.open;
      }

      return response;
    });
  });

  afterEach(() => {
    releases.forEach((release) => release());
    queues.forEach((queue) => queue.destroy());

    fetchSpy.mockRestore();
  });

  it(
    'does not send a batched task while the priority queue is busy, sends it exactly once afterwards',
    async () => {
      const {priorityQueue, batchQueue} = makeQueues(20);

      const releasePriorityResponse = holdResponse(IDENTIFICATION_FRAGMENT);
      const priorityResult = firstValueFrom(priorityQueue.addTask({path: SHOW_IDENTIFICATION}));

      // the priority request is on the device, its response is withheld
      await waitUntil(() => sentBodiesWith(IDENTIFICATION_FRAGMENT).length === 1);

      const batchResult = firstValueFrom(batchQueue.addTask({path: SHOW_VERSION}));

      // the batching window (20ms) expires while the priority queue is busy;
      // the batch must NOT be sent
      await sleep(200);
      expect(sentBodiesWith(VERSION_FRAGMENT)).toHaveLength(0);

      releasePriorityResponse();

      const version = (await batchResult) as GenericObject;

      expect(await priorityResult).toBeDefined();

      // sent exactly once, and the response is a real device payload
      expect(sentBodiesWith(VERSION_FRAGMENT)).toHaveLength(1);
      expect(version).toHaveProperty('release');
      expect(version).toHaveProperty('title');
    },
    15_000,
  );

  it(
    'preempts an in-flight batch: ignores its response, re-sends it after the priority queue is done',
    async () => {
      const {priorityQueue, batchQueue} = makeQueues(0);

      const releasePreemptedResponse = holdResponse(VERSION_FRAGMENT);
      const results: GenericObject[] = [];

      batchQueue.addTask({path: SHOW_VERSION})
        .subscribe((data) => results.push(data as GenericObject));

      // the batch request is on the device, its response is withheld
      await waitUntil(() => sentBodiesWith(VERSION_FRAGMENT).length === 1);

      // a priority task preempts the in-flight batch
      const priorityResult = await firstValueFrom(priorityQueue.addTask({path: SHOW_IDENTIFICATION}));

      expect(priorityResult).toBeDefined();

      // the batch is re-sent to the device (the preempted request already
      // executed there — this documented duplicate is the intended trade-off)
      await waitUntil(() => sentBodiesWith(VERSION_FRAGMENT).length === 2);
      await waitUntil(() => results.length === 1);

      expect(results[0]).toHaveProperty('release');
      expect(results[0]).toHaveProperty('title');

      // releasing the withheld response of the preempted request
      // must not produce a second emission
      releasePreemptedResponse();
      await sleep(200);

      expect(results).toHaveLength(1);
      expect(sentBodiesWith(VERSION_FRAGMENT)).toHaveLength(2);
    },
    15_000,
  );
});
