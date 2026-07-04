import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom, take} from 'rxjs';
import {RciManager} from '../../src/';
import {makeTransport} from '../test.utils';

describe('RciManager stats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits stats after a batch completes when enabled', async () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    manager.toggleStats(true);

    const statsPromise = firstValueFrom(manager.stats$.pipe(take(1)));

    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(20);

    const stats = await statsPromise;
    expect(stats.queueName).toBe('batch');
    expect(stats.taskCount).toBeGreaterThanOrEqual(1);
    expect(stats.success).toBe(true);
    expect(stats.queryPaths).toEqual(['show.version', 'show.version']);
  });

  it('does not emit stats when disabled', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const next = vi.fn();

    manager.stats$.subscribe({next});
    manager.toggleStats(false);
    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(20);

    expect(next).not.toHaveBeenCalled();
  });

  it('completes stats$ on destroy', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const complete = vi.fn();

    manager.stats$.subscribe({complete});
    manager.destroy();

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('emits ordered queryPaths for completed batch when stats are enabled', async () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    manager.toggleStats(true);

    const statsPromise = firstValueFrom(manager.stats$.pipe(take(1)));

    manager.queue({path: 'show.version'}).subscribe();
    manager.queue({path: 'show.system'}).subscribe();
    vi.advanceTimersByTime(20);

    const stats = await statsPromise;
    expect(stats.queryPaths).toEqual(['show.version', 'show.version', 'show.system', 'show.system']);
  });
});
