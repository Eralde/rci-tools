import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom, of, take, throwError} from 'rxjs';
import {RciQueue} from '../../../src/rci-manager/queue';
import {QueryStatsCollector, type BaseHttpResponse, type HttpTransport} from '../../../src';

function makeTransport(): HttpTransport<BaseHttpResponse> {
  return {
    get: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    delete: vi.fn(),
    getHeader: vi.fn(),
    onAuthRequest: vi.fn(),
    clearAuthData: vi.fn(),
    sendQueryArray: vi.fn().mockImplementation((_, queryArray) => of(queryArray.map(() => ({})))),
  };
}

describe('RciQueue stats collection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits expected stats payload on successful batch', async () => {
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
