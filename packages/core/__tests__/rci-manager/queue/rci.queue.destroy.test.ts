import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {of, timer} from 'rxjs';
import {map} from 'rxjs/operators';
import {RciQueue} from '../../../src/rci-manager/queue';
import type {BatchScheduler, BaseHttpResponse, HttpTransport} from '../../../src';

function makeTransport(): HttpTransport<BaseHttpResponse> {
  return {
    get: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    delete: vi.fn(),
    getHeader: vi.fn(),
    onAuthRequest: vi.fn(),
    clearAuthData: vi.fn(),
    sendQueryArray: vi.fn().mockReturnValue(of([])),
  };
}

describe('RciQueue.destroy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls injected scheduler destroy on queue destroy', () => {
    const transport = makeTransport();
    const scheduler: BatchScheduler = {
      scheduleBatch: vi.fn(() => timer(0).pipe(map(() => undefined))),
      reset: vi.fn(),
      destroy: vi.fn(),
    };
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 10}, scheduler);

    queue.destroy();

    expect(scheduler.destroy).toHaveBeenCalledTimes(1);
  });

  it('completes state$ and supports double destroy', () => {
    const transport = makeTransport();
    const scheduler: BatchScheduler = {
      scheduleBatch: vi.fn(() => timer(0).pipe(map(() => undefined))),
      reset: vi.fn(),
      destroy: vi.fn(),
    };
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0}, scheduler);
    const complete = vi.fn();

    queue.state$.subscribe({complete});
    queue.destroy();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(() => queue.destroy()).not.toThrow();
  });

  it('uses batchTimeout timing when scheduler is not injected', () => {
    const transport = makeTransport();
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 20});

    queue.addTask({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(19);
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });
});
