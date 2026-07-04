import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Subject, of} from 'rxjs';
import {RciQueue} from '../../../src/rci-manager/queue';
import type {BatchScheduler, BatchSnapshot} from '../../../src';
import {makeTransport} from '../../test.utils';

describe('RciQueue scheduler integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default batch queue scheduler batches tasks in one timeout window', () => {
    const transport = makeTransport();
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 20});

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.system'}).subscribe();

    vi.advanceTimersByTime(19);
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('priority queue (timeout 0) stays immediate', () => {
    const transport = makeTransport();
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});

    queue.addTask({path: 'show.version'}).subscribe();
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('synchronous flush includes the triggering task in the sent HTTP batch', () => {
    const transport = makeTransport();

    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0});

    queue.addTask({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('adding second task before timer fires sends HTTP batch with BOTH query paths', () => {
    const transport = makeTransport();
    const sentBatches: any[][] = [];

    transport.sendQueryArray = vi.fn().mockImplementation((_url, queryArray: any[]) => {
      sentBatches.push(queryArray);
      return of(queryArray.map(() => ({})));
    });

    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100});

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.system'}).subscribe();

    vi.advanceTimersByTime(100);

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect(sentBatches).toHaveLength(1);
    expect(sentBatches[0]).toHaveLength(2);
  });

  it('after sync flush, immediately adding another task starts next window with correct createdAt', () => {
    const transport = makeTransport();
    const snapshots: BatchSnapshot[] = [];
    const flushTriggers$: Subject<void>[] = [];

    const scheduler: BatchScheduler = {
      schedule: (batch$) => {
        const flush$ = new Subject<void>();
        flushTriggers$.push(flush$);
        batch$.subscribe((s) => snapshots.push(s));
        return flush$;
      },
    };

    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 100}, scheduler);

    vi.setSystemTime(10_000);
    queue.addTask({path: 'a'}).subscribe();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.createdAt).toBe(10_000);

    flushTriggers$[0]!.next();
    vi.advanceTimersByTime(0);

    vi.setSystemTime(20_000);
    queue.addTask({path: 'b'}).subscribe();
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]!.createdAt).toBe(20_000);
    expect(snapshots[1]!.taskCount).toBe(1);
    expect(snapshots[1]!.elapsedMs).toBe(0);
  });
});
