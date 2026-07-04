import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom, take, throwError} from 'rxjs';
import {RciQueue} from '../../../src/rci-manager/queue';
import {QueryStatsCollector} from '../../../src';
import {makeTransport} from '../../test.utils';

describe('RciQueue stats collection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits expected stats payload including queryPaths on successful batch', async () => {
    const transport = makeTransport();
    const collector = new QueryStatsCollector();

    collector.toggle(true);

    const queue = new RciQueue(
      'http://device/rci/',
      transport,
      {
        batchTimeout: 0,
        queueName: 'batch'
      },
      undefined,
      collector,
    );

    const statsPromise = firstValueFrom(collector.stats$.pipe(take(1)));

    queue.addTask({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    const stats = await statsPromise;

    expect(stats.queueName).toBe('batch');
    expect(stats.taskCount).toBe(1);
    expect(stats.queryCount).toBe(1);
    expect(stats.success).toBe(true);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof stats.sentAt).toBe('number');
    expect(stats.queryPaths).toEqual(['show.version']);
  });

  it('preserves queryPaths order as sent batch order', async () => {
    const transport = makeTransport();
    const collector = new QueryStatsCollector();

    collector.toggle(true);

    const queue = new RciQueue(
      'http://device/rci/',
      transport,
      {
        batchTimeout: 100,
        queueName: 'batch'
      },
      undefined,
      collector,
    );

    const statsPromise = firstValueFrom(collector.stats$.pipe(take(1)));

    queue.addTask([{path: 'show.version'}, {path: 'show.system'}, {path: 'show.interface'}]).subscribe();
    vi.advanceTimersByTime(100);

    const stats = await statsPromise;

    expect(stats.queryPaths).toEqual(['show.version', 'show.system', 'show.interface']);
    expect(stats.taskCount).toBe(1);
    expect(stats.queryCount).toBe(3);
  });

  it('preserves duplicate queryPaths in stats', async () => {
    const transport = makeTransport();
    const collector = new QueryStatsCollector();

    collector.toggle(true);

    const queue = new RciQueue(
      'http://device/rci/',
      transport,
      {
        batchTimeout: 100,
        queueName: 'batch'
      },
      undefined,
      collector,
    );

    const statsPromise = firstValueFrom(collector.stats$.pipe(take(1)));

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask([{path: 'show.system'}, {path: 'show.version'}]).subscribe();
    vi.advanceTimersByTime(100);

    const stats = await statsPromise;

    expect(stats.queryPaths).toEqual(['show.version', 'show.system', 'show.version']);
    expect(stats.taskCount).toBe(2);
    expect(stats.queryCount).toBe(3);
  });

  it('emits failed stats payload when HTTP transport errors', async () => {
    const transport = makeTransport();
    const error = new Error('transport failed');

    transport.sendQueryArray = vi.fn().mockReturnValue(throwError(() => error));

    const collector = new QueryStatsCollector();

    collector.toggle(true);

    const queue = new RciQueue(
      'http://device/rci/',
      transport,
      {
        batchTimeout: 0,
        queueName: 'batch'
      },
      undefined,
      collector,
    );

    const statsPromise = firstValueFrom(collector.stats$.pipe(take(1)));

    queue.addTask({path: 'show.version'}).subscribe({error: () => undefined});
    vi.advanceTimersByTime(0);

    const stats = await statsPromise;
    expect(stats.success).toBe(false);
    expect(stats.error).toBe(error);
  });

  it('continues queue flow when collector throws', async () => {
    const transport = makeTransport();
    const collector = new QueryStatsCollector();

    collector.toggle(true);
    collector.collect = vi.fn(() => {
      throw new Error('collector crash');
    });

    const queue = new RciQueue(
      'http://device/rci/',
      transport,
      {
        batchTimeout: 0,
        queueName: 'batch'
      },
      undefined,
      collector,
    );

    const resultPromise = firstValueFrom(queue.addTask({path: 'show.version'}));

    vi.advanceTimersByTime(0);

    await expect(resultPromise).resolves.toBeUndefined();
  });
});
