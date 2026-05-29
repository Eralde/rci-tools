import {describe, it, expect, vi} from 'vitest';
import {of, firstValueFrom, take} from 'rxjs';
import {
  RciBackgroundProcess,
  RCI_BACKGROUND_PROCESS_STATE,
  RCI_BACKGROUND_PROCESS_FINISH_REASON,
} from '../../src/rci-manager/background-process';
import type {BaseHttpResponse, HttpTransport} from '../../src/transport';

function createMockTransport(responses: {
  post?: BaseHttpResponse;
  get?: BaseHttpResponse | BaseHttpResponse[];
}): HttpTransport<BaseHttpResponse> {
  const getResponses = Array.isArray(responses.get)
    ? responses.get
    : [responses.get ?? {status: 200, data: {}}];

  let getIndex = 0;

  return {
    get: vi.fn().mockImplementation(() => {
      const resp = getResponses[getIndex];
      getIndex = Math.min(getIndex + 1, getResponses.length - 1);
      return of(resp);
    }),
    post: vi.fn().mockImplementation(() => of(responses.post ?? {status: 200, data: {}})),
    delete: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    getHeader: vi.fn().mockReturnValue(''),
    onAuthRequest: vi.fn(),
    clearAuthData: vi.fn(),
    sendQueryArray: vi.fn().mockReturnValue(of([])),
  };
}

describe('RciBackgroundProcess', () => {
  it('should POST, get final response immediately (no continued flag)', async () => {
    const transport = createMockTransport({
      post: {status: 200, data: {result: 'done'}},
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {arg: 1},
      {},
      'http://device/rci/',
      transport,
    );

    const resultPromise = firstValueFrom(process.result$.pipe(take(1)));
    const dataPromise = firstValueFrom(process.data$.pipe(take(1)));
    const donePromise = firstValueFrom(process.done$.pipe(take(1)));

    process.start();

    const data = await dataPromise;
    const result = await resultPromise;
    const done = await donePromise;

    expect(transport.post).toHaveBeenCalledOnce();
    expect(transport.get).not.toHaveBeenCalled();
    expect(data).toEqual({result: 'done'});
    expect(result).toEqual({result: 'done'});
    expect(done).toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
  });

  it('should emit result$ once with final payload after polling', async () => {
    const transport = createMockTransport({
      post: {status: 200, data: {continued: true, progress: 50}},
      get: [
        {status: 200, data: {continued: true, progress: 80}},
        {status: 200, data: {result: 'final'}},
      ],
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {pollInterval: 10},
      'http://device/rci/',
      transport,
    );

    const resultPromise = firstValueFrom(process.result$.pipe(take(1)));

    process.start();

    const result = await resultPromise;

    expect(transport.post).toHaveBeenCalledOnce();
    expect(transport.get).toHaveBeenCalledTimes(2);
    expect(result).toEqual({result: 'final'});
  });

  it('should not emit result$ on abort', async () => {
    const transport = createMockTransport({
      post: {status: 200, data: {continued: true, progress: 50}},
      get: {status: 200, data: {continued: true, progress: 50}},
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {pollInterval: 100},
      'http://device/rci/',
      transport,
    );

    let resultEmitted = false;
    process.result$.subscribe(() => {
      resultEmitted = true;
    });

    process.start();

    await new Promise((r) => setTimeout(r, 150));
    process.abort();

    await new Promise((r) => setTimeout(r, 50));

    expect(resultEmitted).toBe(false);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.ABORTED);
  });

  it('should not emit result$ on timeout', async () => {
    const transport = createMockTransport({
      post: {status: 200, data: {continued: true, progress: 50}},
      get: {status: 200, data: {continued: true, progress: 50}},
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {timeout: 50, pollInterval: 1000},
      'http://device/rci/',
      transport,
    );

    let resultEmitted = false;
    process.result$.subscribe(() => {
      resultEmitted = true;
    });

    process.start();

    await new Promise((r) => setTimeout(r, 100));

    expect(resultEmitted).toBe(false);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT);
  });

  it('should reject attachToRunning after start has been called', () => {
    const transport = createMockTransport({
      post: {status: 200, data: {result: 'done'}},
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {},
      'http://device/rci/',
      transport,
    );

    expect(process.start()).toBe(true);
    expect(process.attachToRunning()).toBe(false);
  });

  it('should reject start after attachToRunning has been called', () => {
    const transport = createMockTransport({
      get: {status: 200, data: {result: 'done'}},
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {},
      'http://device/rci/',
      transport,
    );

    expect(process.attachToRunning()).toBe(true);
    expect(process.start()).toBe(false);
  });

  it('should poll with GET after attachToRunning and complete on final response', async () => {
    const transport = createMockTransport({
      get: [
        {status: 200, data: {continued: true, progress: 30}},
        {status: 200, data: {result: 'final'}},
      ],
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {pollInterval: 10},
      'http://device/rci/',
      transport,
    );

    const dataValues: any[] = [];
    process.data$.subscribe((v) => dataValues.push(v));

    process.attachToRunning();

    await new Promise((r) => setTimeout(r, 100));

    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.get).toHaveBeenCalledTimes(2);
    expect(dataValues).toContainEqual({result: 'final'});
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
  });

  it('should complete immediately when attachToRunning gets response without continued flag', async () => {
    const transport = createMockTransport({
      get: {status: 200, data: {message: 'nothing running'}},
    });

    const process = new RciBackgroundProcess(
      'test.command',
      {},
      {},
      'http://device/rci/',
      transport,
    );

    process.attachToRunning();

    await new Promise((r) => setTimeout(r, 50));

    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.get).toHaveBeenCalledOnce();
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
  });
});
