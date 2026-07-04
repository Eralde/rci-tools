import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {RciQueue} from '../../../src/rci-manager/queue';
import {makeTransport} from '../../test.utils';

describe('RciQueue.destroy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes state$ on destroy', () => {
    const transport = makeTransport();
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 10});
    const complete = vi.fn();

    queue.state$.subscribe({complete});

    queue.destroy();

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — double destroy does not throw and completes only once', () => {
    const transport = makeTransport();
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});
    const complete = vi.fn();

    queue.state$.subscribe({complete});

    queue.destroy();
    expect(() => queue.destroy()).not.toThrow();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('destroy during BATCHING_TASKS unsubscribes scheduling window, preventing delayed flush', () => {
    const transport = makeTransport();
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100});

    queue.addTask({path: 'show.version'}).subscribe();

    queue.destroy();

    vi.advanceTimersByTime(100);

    expect(transport.sendQueryArray).not.toHaveBeenCalled();
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
