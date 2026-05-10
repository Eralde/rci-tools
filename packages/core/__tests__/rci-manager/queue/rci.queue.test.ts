import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {of, firstValueFrom} from 'rxjs';
import {take, toArray} from 'rxjs/operators';
import {RciQueue} from '../../../src/rci-manager/queue/rci.queue';
import type {BaseHttpResponse, HttpTransport} from '../../../src/transport';

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

describe('RciQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isBusy$', () => {
    it('emits true when state transitions to BATCHING_TASKS', async () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100});

      const emissions$ = queue.isBusy$.pipe(take(2), toArray());
      const promise = firstValueFrom(emissions$);

      queue.addTask({path: 'show.version'}).subscribe();
      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toEqual([false, true]);
    });

    it('emits false when state returns to READY', async () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});

      const emissions$ = queue.isBusy$.pipe(take(4), toArray());
      const promise = firstValueFrom(emissions$);

      queue.addTask({path: 'show.version'}).subscribe();
      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toEqual([false, true, true, false]);
    });
  });

  describe('destroy()', () => {
    it('should be a method on RciQueue', () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});

      expect(typeof queue.destroy).toBe('function');
      expect(() => queue.destroy()).not.toThrow();
    });

    it('completes state$ and prevents further emissions', async () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100});

      const completed = vi.fn();
      queue.state$.subscribe({complete: completed});

      queue.destroy();
      expect(completed).toHaveBeenCalledTimes(1);
    });

    it('is idempotent - double destroy does not throw', () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});

      queue.destroy();
      expect(() => queue.destroy()).not.toThrow();
    });
  });
});
