import {describe, expect, it, vi} from 'vitest';
import {NEVER, Subject, defer, firstValueFrom, of, throwError} from 'rxjs';
import {
  type BaseHttpResponse,
  RCI_BACKGROUND_PROCESS_FINISH_REASON,
  RCI_BACKGROUND_PROCESS_STATE,
  RciBackgroundProcess,
  RciManager,
} from '../../../src';
import {RciBackgroundTaskQueue} from '../../../src/rci-manager/background-process/rci.background-task.queue';
import {makeTransport} from '../test.utils';

describe('RciManager background process data', () => {
  const PING_URL = 'http://device/rci/tools/ping';

  it.each([false, 0, ''])('initBackgroundProcess posts falsy data %j as is', (data) => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const process = manager.initBackgroundProcess({path: 'tools.ping', data});

    process.start();

    expect(process.data).toBe(data);
    expect(transport.post).toHaveBeenCalledWith(PING_URL, data);

    process.destroy();
    manager.destroy();
  });

  it.each([false, 0, ''])('queueBackgroundProcess posts falsy data %j as is', (data) => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const process = manager.queueBackgroundProcess({path: 'tools.ping', data});

    expect(process.data).toBe(data);
    expect(transport.post).toHaveBeenCalledWith(PING_URL, data);

    manager.destroy();
  });

  it('defaults missing data to {}', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);

    expect(manager.initBackgroundProcess({path: 'tools.ping'}).data).toEqual({});
    expect(manager.queueBackgroundProcess({path: 'tools.ping'}).data).toEqual({});

    manager.destroy();
  });
});

describe('RciBackgroundProcess error', () => {
  const RCI_PATH = 'http://device/rci/';
  const httpError = {status: 500, data: {}};

  it('exposes the transport error of the first POST', () => {
    const transport = makeTransport();

    vi.mocked(transport.post).mockReturnValue(throwError(() => httpError));

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);

    process.start();

    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.ERROR);
    expect(process.error).toBe(httpError);
  });

  it('sets error before done$ emits ERROR', () => {
    const transport = makeTransport();

    vi.mocked(transport.post).mockReturnValue(throwError(() => httpError));

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);
    const seen: unknown[] = [];

    process.done$.subscribe((reason) => seen.push([reason, process.error]));
    process.start();

    expect(seen).toEqual([[RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR, httpError]]);
  });

  it('exposes an error thrown by a polling GET', () => {
    const transport = makeTransport();

    vi.mocked(transport.post).mockReturnValue(of({status: 200, data: {continued: true}}));
    vi.mocked(transport.get).mockReturnValue(throwError(() => httpError));

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);

    process.start();

    expect(process.error).toBe(httpError);
  });

  it('exposes an error of attachToRunning', () => {
    const transport = makeTransport();

    vi.mocked(transport.get).mockReturnValue(throwError(() => httpError));

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);

    process.attachToRunning();

    expect(process.error).toBe(httpError);
  });

  it('is null for a completed process', () => {
    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, makeTransport());

    process.start();

    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
    expect(process.error).toBeNull();
  });

  it('is null for an aborted process', () => {
    const transport = makeTransport();

    vi.mocked(transport.post).mockReturnValue(NEVER);

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);

    process.start();
    process.abort();

    expect(process.error).toBeNull();
  });

  it('keeps the error after destroy()', () => {
    const transport = makeTransport();

    vi.mocked(transport.post).mockReturnValue(throwError(() => httpError));

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);

    process.start();
    process.destroy();

    expect(process.error).toBe(httpError);
  });
});

class TestBackgroundProcess extends RciBackgroundProcess<string> {
  public finish(reason: RCI_BACKGROUND_PROCESS_FINISH_REASON): void {
    this['doneSub$'].next(reason);
  }
}

describe('RciBackgroundProcess cleanup', () => {
  it('sends DELETE to the process resource when aborted', async () => {
    const transport = makeTransport();
    const pendingPost$ = new Subject<BaseHttpResponse>();

    let deleteSubscribed = false;

    vi.mocked(transport.post).mockReturnValue(pendingPost$.asObservable());
    vi.mocked(transport.delete).mockReturnValue(
      defer(() => {
        deleteSubscribed = true;

        return of({status: 200, data: {}});
      }),
    );

    const process = new RciBackgroundProcess(
      'tools.ping',
      {host: '127.0.0.1', count: 100},
      {},
      'http://device/rci/',
      transport,
    );

    const donePromise = firstValueFrom(process.done$);

    expect(process.start()).toBe(true);
    expect(process.abort()).toBe(true);

    expect(deleteSubscribed).toBe(true);
    expect(transport.delete).toHaveBeenCalledWith('http://device/rci/tools/ping');
    await expect(donePromise).resolves.toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED);

    process.destroy();
  });

  it('sends DELETE to the process resource when timed out', async () => {
    vi.useFakeTimers();

    try {
      const transport = makeTransport();
      vi.mocked(transport.post).mockReturnValue(NEVER);
      vi.mocked(transport.delete).mockReturnValue(of({status: 200, data: {}}));

      const process = new RciBackgroundProcess(
        'tools.ping',
        {},
        {timeout: 10},
        'http://device/rci/',
        transport,
      );
      const donePromise = firstValueFrom(process.done$);

      expect(process.start()).toBe(true);
      await vi.advanceTimersByTimeAsync(10);

      expect(transport.delete).toHaveBeenCalledWith('http://device/rci/tools/ping');
      await expect(donePromise).resolves.toBe(RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT);

      process.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps finish reasons to final states', () => {
    const cases = [
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE, RCI_BACKGROUND_PROCESS_STATE.COMPLETED],
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED, RCI_BACKGROUND_PROCESS_STATE.ABORTED],
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT, RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT],
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR, RCI_BACKGROUND_PROCESS_STATE.ERROR],
    ] as const;

    for (const [reason, state] of cases) {
      const process = new TestBackgroundProcess('show.version', {}, {}, 'http://device/rci/', makeTransport());
      process.finish(reason);
      expect(process.getState()).toBe(state);
      process.destroy();
    }
  });

  it('destroy completes public streams', () => {
    const process = new RciBackgroundProcess('show.version', {}, {}, 'http://device/rci/', makeTransport());
    const completed = vi.fn();

    process.state$.subscribe({complete: completed});
    process.destroy();
    process.destroy();

    expect(completed).toHaveBeenCalledTimes(1);
  });
});

describe('RciBackgroundTaskQueue cleanup', () => {
  it('destroy completes state$ and queued processes', () => {
    const queue = new RciBackgroundTaskQueue('http://device/rci/', 'show.version', makeTransport());
    const completed = vi.fn();

    queue.state$.subscribe({complete: completed});
    queue.push({});

    queue.destroy();
    queue.destroy();

    expect(completed).toHaveBeenCalledTimes(1);
  });
});
