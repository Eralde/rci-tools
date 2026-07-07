import {beforeAll, describe, expect, it} from 'vitest';
import {firstValueFrom, take} from 'rxjs';
import {
  FetchTransport,
  RCI_BACKGROUND_PROCESS_FINISH_REASON,
  RCI_BACKGROUND_PROCESS_STATE,
  RciBackgroundProcess,
  SessionManager,
} from '../../../src';

const IP_ADDRESS = process.env.RCI_DEVICE_IP;

if (!IP_ADDRESS) {
  throw new Error('Device IP address was not provided. Use --addr <device-ip>');
}

const host = String(IP_ADDRESS).startsWith('http://')
  ? String(IP_ADDRESS)
  : `http://${String(IP_ADDRESS)}`;

const rciPath = `${host}/rci/`;

const USERNAME = process.env.RCI_USERNAME;
const PASSWORD = process.env.RCI_PASSWORD;

async function ensureAuth(transport: FetchTransport): Promise<void> {
  if (!USERNAME || !PASSWORD) {
    return;
  }

  const session = new SessionManager(host, transport);
  const authenticated = await firstValueFrom(session.login(USERNAME, PASSWORD));

  if (!authenticated) {
    throw new Error(`Auth failed for ${USERNAME} on ${host}`);
  }
}

const getPingArgs = (count: number) => {
  return {host: '127.0.0.1', count, packetsize: 56};
};

describe('RciBackgroundProcess', () => {
  let transport: FetchTransport;

  beforeAll(async () => {
    transport = new FetchTransport();

    await ensureAuth(transport);
  });

  it('should POST tools.ping and receive final response (count=1)', async () => {
    const process = new RciBackgroundProcess(
      'tools.ping',
      getPingArgs(1),
      {timeout: 15000},
      rciPath,
      transport,
    );

    const dataValues: any[] = [];

    process.data$.subscribe((v) => dataValues.push(v));

    const resultPromise = firstValueFrom(process.result$.pipe(take(1)));
    const donePromise = firstValueFrom(process.done$.pipe(take(1)));

    const started = process.start();

    expect(started).toBe(true);

    const result = await resultPromise;
    const done = await donePromise;

    expect(done).toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(dataValues.length).toBeGreaterThan(0);
    expect(dataValues[dataValues.length - 1]).toEqual(result);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
  }, 20000);

  it('should emit data$ updates during polling with continued flag (count=3)', async () => {
    const process = new RciBackgroundProcess(
      'tools.ping',
      getPingArgs(3),
      {pollInterval: 200, timeout: 15000},
      rciPath,
      transport,
    );

    const dataValues: any[] = [];

    process.data$.subscribe((v) => dataValues.push(v));

    const resultPromise = firstValueFrom(process.result$.pipe(take(1)));
    const donePromise = firstValueFrom(process.done$.pipe(take(1)));

    process.start();

    const result = await resultPromise;
    const done = await donePromise;

    expect(done).toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
    expect(result).toBeDefined();
    expect(dataValues.length).toBeGreaterThan(0);
    expect(dataValues[dataValues.length - 1]).toEqual(result);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
  }, 20000);

  it('should reject attachToRunning after start has been called', async () => {
    const process = new RciBackgroundProcess(
      'tools.ping',
      getPingArgs(1),
      {timeout: 10000},
      rciPath,
      transport,
    );

    const donePromise = firstValueFrom(process.done$.pipe(take(1)));

    expect(process.start()).toBe(true);
    expect(process.attachToRunning()).toBe(false);

    await donePromise;
  });

  it('should complete via attachToRunning (GET polling)', async () => {
    const startPing = firstValueFrom(
      transport.post(rciPath, {tools: {ping: getPingArgs(3)}}),
    );

    await startPing;

    const process = new RciBackgroundProcess(
      'tools.ping',
      {},
      {pollInterval: 200, timeout: 5000},
      rciPath,
      transport,
    );

    const dataValues: any[] = [];

    process.data$.subscribe((v) => dataValues.push(v));
    process.attachToRunning();

    const done = await firstValueFrom(process.done$.pipe(take(1)));

    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
    expect(done).toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
  }, 15000);

  it('should reject start after attachToRunning has been called', () => {
    const process = new RciBackgroundProcess(
      'tools.ping',
      {},
      {timeout: 5000},
      rciPath,
      transport,
    );

    expect(process.attachToRunning()).toBe(true);
    expect(process.start()).toBe(false);
  });

  it('should not emit result$ when aborted during polling', async () => {
    const process = new RciBackgroundProcess(
      'tools.ping',
      getPingArgs(100),
      {pollInterval: 10, timeout: 15000},
      rciPath,
      transport,
    );

    let resultEmitted = false;
    process.result$.subscribe(() => {
      resultEmitted = true;
    });

    process.start();

    await new Promise((r) => setTimeout(r, 100));

    const donePromise = firstValueFrom(process.done$.pipe(take(1)));
    const aborted = process.abort();

    expect(aborted).toBe(true);

    const done = await donePromise;

    expect(resultEmitted).toBe(false);
    expect(done).toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.ABORTED);
  }, 10000);

  it('should not emit result$ when timed out', async () => {
    const process = new RciBackgroundProcess(
      'tools.ping',
      getPingArgs(1000),
      {timeout: 500, pollInterval: 1000},
      rciPath,
      transport,
    );

    let resultEmitted = false;

    process.result$.subscribe(() => {
      resultEmitted = true;
    });

    process.start();

    const done = await firstValueFrom(process.done$.pipe(take(1)));

    expect(resultEmitted).toBe(false);
    expect(done).toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT);
  }, 10000);
});
