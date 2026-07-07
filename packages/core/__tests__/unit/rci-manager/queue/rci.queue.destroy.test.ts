import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER} from 'rxjs';
import {RciQueue} from '../../../../src';
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

    queue.addTask({path: 'show.version'}).subscribe({error: () => {/* expected on destroy */}});

    queue.destroy();

    vi.advanceTimersByTime(100);

    expect(transport.sendQueryArray).not.toHaveBeenCalled();
  });

  it('destroy during AWAITING_RESPONSE errors pending task subjects', () => {
    const transport = {
      ...makeTransport(),
      sendQueryArray: vi.fn().mockReturnValue(NEVER),
    };
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});

    const next = vi.fn();
    const error = vi.fn();
    const complete = vi.fn();

    queue.addTask({path: 'show.version'}).subscribe({next, error, complete});

    vi.advanceTimersByTime(0);

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();

    queue.destroy();

    expect(error).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
