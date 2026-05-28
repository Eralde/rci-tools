import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {NEVER, of, firstValueFrom} from 'rxjs';
import {take, toArray} from 'rxjs/operators';
import {RciQueue} from '../../../src/rci-manager/queue/rci.queue';
import {QueueNotIdleError} from '../../../src/rci-manager/queue/queue-not-idle.error';
import type {BatchInfo, BatchScheduler} from '../../../src/rci-manager/scheduler';
import {TimerScheduler} from '../../../src/rci-manager/scheduler';
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

  describe('BatchInfo emissions', () => {
    it('emits stable createdAt, increasing elapsedMs, and immutable task snapshots', () => {
      const transport = makeTransport();
      const snapshots: BatchInfo[] = [];
      const scheduler: BatchScheduler = {
        scheduleBatch: (batch$) => {
          batch$.subscribe((info) => {
            snapshots.push(info);
          });
          return NEVER;
        },
        reset: vi.fn(),
        destroy: vi.fn(),
      };
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100}, scheduler);

      vi.setSystemTime(1_000);
      queue.addTask({path: 'show.version'}).subscribe();
      vi.setSystemTime(1_010);
      queue.addTask({path: 'show.system'}).subscribe();

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]?.createdAt).toBe(1_000);
      expect(snapshots[1]?.createdAt).toBe(1_000);
      expect(snapshots[0]?.elapsedMs).toBe(0);
      expect(snapshots[1]?.elapsedMs).toBe(10);
      expect(snapshots[0]?.tasks).toHaveLength(1);
      expect(snapshots[1]?.tasks).toHaveLength(2);
      expect(snapshots[0]?.tasks).not.toBe(snapshots[1]?.tasks);
    });
  });

  describe('setScheduler()', () => {
    it('throws QueueNotIdleError when queue is not READY', () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100});

      queue.addTask({path: 'show.version'}).subscribe();

      expect(() => {
        queue.setScheduler(new TimerScheduler(1));
      }).toThrowError(QueueNotIdleError);
    });

    it('replaces scheduler in READY state', () => {
      const transport = makeTransport();
      const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100});

      expect(() => {
        queue.setScheduler(new TimerScheduler(1));
      }).not.toThrow();
    });
  });
});
