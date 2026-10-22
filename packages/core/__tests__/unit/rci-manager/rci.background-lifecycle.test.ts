import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER, Observable, Subject, of, throwError} from 'rxjs';
import {
  type BaseHttpResponse,
  QueueDestroyedError,
  RCI_BACKGROUND_PROCESS_FINISH_REASON,
  RCI_BACKGROUND_PROCESS_STATE,
  RciBackgroundProcess,
} from '../../../src';
import {
  RCI_BACKGROUND_TASK_QUEUE_STATE,
  RciBackgroundTaskQueue,
} from '../../../src/rci-manager/background-process/rci.background-task.queue';
import {makeTransport} from '../test.utils';

const RCI_PATH = 'http://device/rci/';
const CONTINUED = {status: 200, data: {continued: true}};

describe('RciBackgroundProcess lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('destroy during polling stops further GET requests', async () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(of(CONTINUED));
    vi.mocked(transport.get).mockReturnValue(of(CONTINUED));

    const process = new RciBackgroundProcess('tools.ping', {}, {pollInterval: 10}, RCI_PATH, transport);

    process.start();
    await vi.advanceTimersByTimeAsync(25);

    const callsBeforeDestroy = vi.mocked(transport.get).mock.calls.length;

    expect(callsBeforeDestroy).toBeGreaterThan(0);

    process.destroy();
    await vi.advanceTimersByTimeAsync(100);

    expect(vi.mocked(transport.get).mock.calls.length).toBe(callsBeforeDestroy);
  });

  it('destroy during initial POST tears down the request', () => {
    const transport = makeTransport();
    const teardown = vi.fn();
    vi.mocked(transport.post).mockReturnValue(new Observable<BaseHttpResponse>(() => teardown));

    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);

    process.start();
    process.destroy();

    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('abort of a queued process finishes it without contacting the device', () => {
    const transport = makeTransport();
    const process = new RciBackgroundProcess('tools.ping', {}, {}, RCI_PATH, transport);
    const done = vi.fn();
    const trigger = new Subject<void>();

    process.done$.subscribe(done);
    process.setQueued(trigger);

    expect(process.abort()).toBe(true);

    trigger.next();

    expect(done).toHaveBeenCalledWith(RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED);
    expect(process.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.ABORTED);
    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.delete).not.toHaveBeenCalled();

    process.destroy();
  });
});

describe('RciBackgroundTaskQueue lifecycle', () => {
  it('advances after a process that completes synchronously', () => {
    const transport = makeTransport();
    const queue = new RciBackgroundTaskQueue(RCI_PATH, 'tools.ping', transport);

    queue.push({});
    queue.push({});

    expect(transport.post).toHaveBeenCalledTimes(2);

    let state: string | undefined;
    queue.state$.subscribe((value) => (state = value));

    expect(state).toBe(RCI_BACKGROUND_TASK_QUEUE_STATE.READY);

    queue.destroy();
  });

  it('advances after a process that fails synchronously', () => {
    const transport = makeTransport();
    vi.mocked(transport.post)
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValue(of({status: 200, data: {}}));

    const queue = new RciBackgroundTaskQueue(RCI_PATH, 'tools.ping', transport);

    const first = queue.push({});
    queue.push({});

    expect(first.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.ERROR);
    expect(transport.post).toHaveBeenCalledTimes(2);

    queue.destroy();
  });

  it('advances when the current process is destroyed', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);

    const queue = new RciBackgroundTaskQueue(RCI_PATH, 'tools.ping', transport);

    const first = queue.push({});
    queue.push({});

    expect(transport.post).toHaveBeenCalledTimes(1);

    first.destroy();

    expect(transport.post).toHaveBeenCalledTimes(2);

    queue.destroy();
  });

  it('skips a queued process that was destroyed', () => {
    const transport = makeTransport();
    const firstPost$ = new Subject<BaseHttpResponse>();
    vi.mocked(transport.post)
      .mockReturnValueOnce(firstPost$)
      .mockReturnValue(NEVER);

    const queue = new RciBackgroundTaskQueue(RCI_PATH, 'tools.ping', transport);

    queue.push({n: 1});
    const second = queue.push({n: 2});
    const third = queue.push({n: 3});

    second.destroy();

    firstPost$.next({status: 200, data: {}});

    expect(transport.post).toHaveBeenCalledTimes(2);
    expect(transport.post).toHaveBeenLastCalledWith(`${RCI_PATH}tools/ping`, {n: 3});
    expect(third.getState()).toBe(RCI_BACKGROUND_PROCESS_STATE.RUNNING);

    queue.destroy();
  });

  it('skips a queued process that was aborted', () => {
    const transport = makeTransport();
    const firstPost$ = new Subject<BaseHttpResponse>();
    vi.mocked(transport.post)
      .mockReturnValueOnce(firstPost$)
      .mockReturnValue(NEVER);

    const queue = new RciBackgroundTaskQueue(RCI_PATH, 'tools.ping', transport);

    queue.push({n: 1});
    const second = queue.push({n: 2});
    queue.push({n: 3});

    expect(second.abort()).toBe(true);

    firstPost$.next({status: 200, data: {}});

    expect(transport.post).toHaveBeenCalledTimes(2);
    expect(transport.post).toHaveBeenLastCalledWith(`${RCI_PATH}tools/ping`, {n: 3});
    expect(transport.delete).not.toHaveBeenCalled();

    queue.destroy();
  });

  it('push after destroy throws QueueDestroyedError', () => {
    const transport = makeTransport();
    const queue = new RciBackgroundTaskQueue(RCI_PATH, 'tools.ping', transport);

    queue.destroy();

    expect(() => queue.push({})).toThrow(QueueDestroyedError);
    expect(transport.post).not.toHaveBeenCalled();
  });
});
