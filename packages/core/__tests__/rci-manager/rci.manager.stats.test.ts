import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom, of, take} from 'rxjs';
import {RciManager, type BaseHttpResponse, type HttpTransport} from '../../src/';

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
});
