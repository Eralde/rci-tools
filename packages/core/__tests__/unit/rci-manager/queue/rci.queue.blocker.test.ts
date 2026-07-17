import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Subject} from 'rxjs';
import type {BaseHttpResponse, GenericObject, HttpTransport} from '../../../../src';
import {RciQueue} from '../../../../src';

const FAKE_RCI = 'http://device/rci/';

interface PendingCall {
  queryArray: GenericObject[];
  respond: () => void;
}

// Transport whose sendQueryArray responses are resolved manually,
// so a queue can be held in AWAITING_RESPONSE for as long as the test needs
function makeDeferredTransport(): {transport: HttpTransport<BaseHttpResponse>; calls: PendingCall[]} {
  const calls: PendingCall[] = [];

  const transport: HttpTransport<BaseHttpResponse> = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getHeader: vi.fn(),
    onAuthRequest: vi.fn(),
    clearAuthData: vi.fn(),
    sendQueryArray: vi.fn().mockImplementation((_url: string, queryArray: GenericObject[]) => {
      const response$ = new Subject<GenericObject[]>();

      calls.push({
        queryArray,
        respond: () => {
          response$.next(queryArray.map(() => ({})));
          response$.complete();
        },
      });

      return response$.asObservable();
    }),
  };

  return {transport, calls};
}

const containsShowVersion = (queryArray: GenericObject[]): boolean => {
  return queryArray.some((query) => Boolean((query['show'] as GenericObject | undefined)?.['version']));
};

describe('RciQueue with a busy blocker queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupBlockedQueues = () => {
    const {transport, calls} = makeDeferredTransport();
    const priorityQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});
    const batchQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0, blockerQueue: priorityQueue});

    // Put the priority queue into AWAITING_RESPONSE (its HTTP response stays pending)
    priorityQueue.addTask({path: 'priority.command'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(calls).toHaveLength(1);

    return {transport, calls, priorityQueue, batchQueue};
  };

  it('does not send a blocked task before the blocker queue is free', () => {
    const {calls, batchQueue} = setupBlockedQueues();

    batchQueue.addTask({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    const sentWhileBlocked = calls.filter((call) => containsShowVersion(call.queryArray));

    expect(sentWhileBlocked).toHaveLength(0);
  });

  it('sends a blocked task exactly once after the blocker queue becomes free', () => {
    const {calls, batchQueue} = setupBlockedQueues();

    const results: unknown[] = [];

    batchQueue.addTask({path: 'show.version'}).subscribe((data) => results.push(data));
    vi.advanceTimersByTime(0);

    // Release the priority queue -> batch queue should retry the blocked task
    calls[0]!.respond();
    vi.advanceTimersByTime(0);

    // Drain: responding to a call may trigger further sends, so respond until none remain
    for (let index = 1; index < calls.length; index++) {
      calls[index]!.respond();
      vi.advanceTimersByTime(0);
    }

    const sendsWithTask = calls.filter((call) => containsShowVersion(call.queryArray));

    expect(sendsWithTask).toHaveLength(1);
    expect(results).toHaveLength(1);
  });

  it('preempts an in-flight batch: discards the response and re-sends after the blocker frees', () => {
    const {transport, calls} = makeDeferredTransport();
    const priorityQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});
    const batchQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0, blockerQueue: priorityQueue});

    const results: unknown[] = [];
    const states: string[] = [];

    batchQueue.state$.subscribe((state) => states.push(state));

    batchQueue.addTask({path: 'show.version'}).subscribe((data) => results.push(data));
    vi.advanceTimersByTime(0);

    // batch is in flight (response withheld)
    expect(calls).toHaveLength(1);

    // a priority task preempts the in-flight batch
    priorityQueue.addTask({path: 'priority.command'}).subscribe();

    expect(states).toContain('PENDING');

    // the abandoned response must be ignored
    calls[0]!.respond();
    expect(results).toHaveLength(0);

    // priority queue flushes and finishes -> batch queue re-sends
    vi.advanceTimersByTime(0);
    expect(calls).toHaveLength(2);
    calls[1]!.respond();

    expect(calls).toHaveLength(3);
    expect(containsShowVersion(calls[2]!.queryArray)).toBe(true);

    calls[2]!.respond();

    // the caller gets exactly one emission, produced by the re-sent batch
    expect(results).toHaveLength(1);
  });

  it('defers an open batching window when the blocker queue becomes busy before the flush', () => {
    const {transport, calls} = makeDeferredTransport();
    const priorityQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});
    const batchQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100, blockerQueue: priorityQueue});

    const results: unknown[] = [];
    const showVersionSends = () => calls.filter((call) => containsShowVersion(call.queryArray));

    batchQueue.addTask({path: 'show.version'}).subscribe((data) => results.push(data));
    vi.advanceTimersByTime(50);

    // preempt mid-window, then let the batch timer expire while blocked
    priorityQueue.addTask({path: 'priority.command'}).subscribe();
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(100);

    expect(showVersionSends()).toHaveLength(0);

    // releasing the blocker re-sends the pending tasks immediately
    calls[0]!.respond();
    expect(showVersionSends()).toHaveLength(1);

    showVersionSends()[0]!.respond();
    expect(results).toHaveLength(1);
  });
});
