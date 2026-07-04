import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Subject, firstValueFrom} from 'rxjs';
import {TimerScheduler, type BatchSnapshot} from '../../../src';

describe('TimerScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits once after timeout and completes', async () => {
    const scheduler = new TimerScheduler(25);
    const batch$ = new Subject<BatchSnapshot>();
    const done = firstValueFrom(scheduler.schedule(batch$));

    vi.advanceTimersByTime(25);

    await expect(done).resolves.toBeUndefined();
  });

  it('unsubscribe before timeout prevents emission', () => {
    const scheduler = new TimerScheduler(25);
    const batch$ = new Subject<BatchSnapshot>();
    const next = vi.fn();

    const sub = scheduler.schedule(batch$).subscribe({next});
    sub.unsubscribe();
    vi.advanceTimersByTime(25);

    expect(next).not.toHaveBeenCalled();
  });

  it('input batch contents are ignored', async () => {
    const scheduler = new TimerScheduler(20);
    const batch$ = new Subject<BatchSnapshot>();
    const done = firstValueFrom(scheduler.schedule(batch$));

    batch$.next({taskCount: 1, queryCount: 1, createdAt: 1000, elapsedMs: 0, queryPaths: ['a.b']});
    batch$.next({taskCount: 2, queryCount: 3, createdAt: 1000, elapsedMs: 5, queryPaths: ['x.y', 'z.w']});

    vi.advanceTimersByTime(20);

    await expect(done).resolves.toBeUndefined();
  });
});
