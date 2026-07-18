import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER, Subject, firstValueFrom, throwError} from 'rxjs';
import {take, toArray} from 'rxjs/operators';
import {type BatchScheduler, type BatchSnapshot, QueueNotIdleError, RciQueue, TimerScheduler} from '../../../../src';
import {makeTransport} from '../../test.utils';

const FAKE_RCI = 'http://device/rci/';

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
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});

      const emissions$ = queue.isBusy$.pipe(take(2), toArray());
      const promise = firstValueFrom(emissions$);

      queue.addTask({path: 'show.version'}).subscribe();
      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toEqual([false, true]);
    });

    it('emits false when state returns to READY', async () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});

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
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});

      expect(typeof queue.destroy).toBe('function');
      expect(() => queue.destroy()).not.toThrow();
    });

    it('completes state$ and prevents further emissions', async () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});

      const completed = vi.fn();
      queue.state$.subscribe({complete: completed});

      queue.destroy();
      expect(completed).toHaveBeenCalledTimes(1);
    });

    it('is idempotent - double destroy does not throw', () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});

      queue.destroy();
      expect(() => queue.destroy()).not.toThrow();
    });
  });

  describe('BatchSnapshot emissions', () => {
    it('emits stable createdAt, increasing elapsedMs, taskCount, queryCount, and queryPaths', () => {
      const transport = makeTransport();
      const snapshots: BatchSnapshot[] = [];
      const scheduler: BatchScheduler = {
        schedule: (batch$) => {
          batch$.subscribe((snapshot) => {
            snapshots.push(snapshot);
          });
          return NEVER;
        },
      };
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100, scheduler});

      vi.setSystemTime(1_000);
      queue.addTask({path: 'show.version'}).subscribe();
      vi.setSystemTime(1_010);
      queue.addTask({path: 'show.system'}).subscribe();

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]?.createdAt).toBe(1_000);
      expect(snapshots[1]?.createdAt).toBe(1_000);
      expect(snapshots[0]?.elapsedMs).toBe(0);
      expect(snapshots[1]?.elapsedMs).toBe(10);
      expect(snapshots[0]?.taskCount).toBe(1);
      expect(snapshots[1]?.taskCount).toBe(2);
      expect(snapshots[0]?.queryCount).toBe(1);
      expect(snapshots[1]?.queryCount).toBe(2);
      expect(snapshots[0]?.queryPaths).toEqual(['show.version']);
      expect(snapshots[1]?.queryPaths).toEqual(['show.version', 'show.system']);
      expect(snapshots[0]?.queryPaths).not.toBe(snapshots[1]?.queryPaths);
    });

    it('preserves queryPath order and duplicates across tasks', () => {
      const transport = makeTransport();
      const snapshots: BatchSnapshot[] = [];
      const scheduler: BatchScheduler = {
        schedule: (batch$) => {
          batch$.subscribe((snapshot) => {
            snapshots.push(snapshot);
          });
          return NEVER;
        },
      };
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100, scheduler});

      vi.setSystemTime(2_000);
      queue.addTask([{path: 'show.version'}, {path: 'show.system'}]).subscribe();
      vi.setSystemTime(2_005);
      queue.addTask({path: 'show.version'}).subscribe();

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]?.queryPaths).toEqual(['show.version', 'show.system']);
      expect(snapshots[1]?.queryPaths).toEqual(['show.version', 'show.system', 'show.version']);
      expect(snapshots[1]?.taskCount).toBe(2);
      expect(snapshots[1]?.queryCount).toBe(3);
    });

    it('queryCount counts flattened queries from multi-query tasks', () => {
      const transport = makeTransport();
      const snapshots: BatchSnapshot[] = [];
      const scheduler: BatchScheduler = {
        schedule: (batch$) => {
          batch$.subscribe((snapshot) => {
            snapshots.push(snapshot);
          });
          return NEVER;
        },
      };
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100, scheduler});

      vi.setSystemTime(3_000);
      queue.addTask([{path: 'a'}, {path: 'b'}, {path: 'c'}]).subscribe();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]?.taskCount).toBe(1);
      expect(snapshots[0]?.queryCount).toBe(3);
      expect(snapshots[0]?.queryPaths).toEqual(['a', 'b', 'c']);
    });

    it('taskCount increments per addTask call', () => {
      const transport = makeTransport();
      const snapshots: BatchSnapshot[] = [];
      const scheduler: BatchScheduler = {
        schedule: (batch$) => {
          batch$.subscribe((snapshot) => {
            snapshots.push(snapshot);
          });
          return NEVER;
        },
      };
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100, scheduler});

      vi.setSystemTime(4_000);
      queue.addTask({path: 'first'}).subscribe();
      queue.addTask({path: 'second'}).subscribe();
      queue.addTask({path: 'third'}).subscribe();

      expect(snapshots).toHaveLength(3);
      expect(snapshots.map((s) => s.taskCount)).toEqual([1, 2, 3]);
    });
  });

  describe('setScheduler()', () => {
    it('throws QueueNotIdleError when queue is not READY', () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});

      queue.addTask({path: 'show.version'}).subscribe();

      expect(() => {
        queue.setScheduler(new TimerScheduler(1));
      }).toThrowError(QueueNotIdleError);
    });

    it('replaces scheduler in READY state', () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});

      expect(() => {
        queue.setScheduler(new TimerScheduler(1));
      }).not.toThrow();
    });

    it('uses replaced scheduler and ignores the old one', () => {
      const transport = makeTransport();
      const oldFlush$ = new Subject<void>();
      const queue = new RciQueue(
        FAKE_RCI,
        transport,
        {
          batchTimeout: 0,
          scheduler: {schedule: () => oldFlush$.asObservable()},
        },
      );

      queue.addTask({path: 'first'}).subscribe();
      oldFlush$.next();
      expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);

      const newFlush$ = new Subject<void>();

      queue.setScheduler({schedule: () => newFlush$.asObservable()});
      queue.addTask({path: 'second'}).subscribe();

      oldFlush$.next(); // old scheduler firing must do nothing
      expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);

      newFlush$.next();
      expect(transport.sendQueryArray).toHaveBeenCalledTimes(2);
    });
  });

  describe('addTask subscription behavior', () => {
    it('does not enqueue a blocked task until returned observable is subscribed', () => {
      const transport = makeTransport();
      const blockerQueue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100, blockerQueue});
      const states: string[] = [];

      queue.state$.subscribe((state) => states.push(state));

      queue.addTask({path: 'show.version'});

      expect(states).toEqual(['READY']);
      expect(transport.sendQueryArray).not.toHaveBeenCalled();
    });

    it('does not mutate caller query array when saveConfiguration is true', () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});
      const queries = [{path: 'show.version'}];

      queue.addTask(queries, true).subscribe();
      vi.advanceTimersByTime(0);

      expect(queries).toEqual([{path: 'show.version'}]);
      expect(transport.sendQueryArray).toHaveBeenCalledWith(FAKE_RCI, [
        {show: {version: {}}},
        {system: {configuration: {save: {}}}},
      ]);
    });

    it('unsubscribe mid-batch does not corrupt subsequent batches', () => {
      vi.useFakeTimers();

      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});

      const sub1 = queue.addTask({path: 'show.version'}).subscribe();
      sub1.unsubscribe();

      // Another task should still flush correctly
      queue.addTask({path: 'show.system'}).subscribe();
      vi.advanceTimersByTime(100);

      expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('QueueNotIdleError', () => {
    it('exposes the current state when thrown', () => {
      const transport = makeTransport();
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 100});

      queue.addTask({path: 'show.version'}).subscribe();

      try {
        queue.setScheduler(new TimerScheduler(1));
        throw new Error('Expected QueueNotIdleError');
      } catch (error) {
        expect(error).toBeInstanceOf(QueueNotIdleError);
        expect((error as QueueNotIdleError).state).toBe('BATCHING_TASKS');
      }
    });
  });

  describe('scheduler error handling', () => {
    it('errors tasks instead of losing them when the transport throws synchronously', () => {
      const transport = {
        ...makeTransport(),
        sendQueryArray: vi.fn().mockImplementation(() => {
          throw new Error('sync transport failure');
        }),
      };
      const queue = new RciQueue(FAKE_RCI, transport, {batchTimeout: 0});
      const error = vi.fn();

      queue.addTask({path: 'show.version'}).subscribe({error});

      vi.advanceTimersByTime(0);

      expect(error).toHaveBeenCalledTimes(1);
    });

    it('flushes batch when scheduler throws', () => {
      const transport = makeTransport();
      const faultyScheduler: BatchScheduler = {
        schedule: () => throwError(() => new Error('boom')),
      };
      const queue = new RciQueue(FAKE_RCI, transport, {scheduler: faultyScheduler});

      queue.addTask({path: 'show.version'}).subscribe();

      expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    });
  });
});
