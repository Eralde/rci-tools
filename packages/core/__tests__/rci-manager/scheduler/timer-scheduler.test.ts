import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Subject, firstValueFrom} from 'rxjs';
import {TimerScheduler} from '../../../src/rci-manager/scheduler/timer-scheduler';
import type {BatchInfo} from '../../../src/rci-manager/scheduler/batch-info';

describe('TimerScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits once after timeout and completes', async () => {
    const scheduler = new TimerScheduler(25);
    const batch$ = new Subject<BatchInfo>();
    const done = firstValueFrom(scheduler.scheduleBatch(batch$));

    vi.advanceTimersByTime(25);

    await expect(done).resolves.toBeUndefined();
  });

  it('reset cancels pending emission', async () => {
    const scheduler = new TimerScheduler(25);
    const batch$ = new Subject<BatchInfo>();
    const next = vi.fn();

    scheduler.scheduleBatch(batch$).subscribe({next});
    vi.advanceTimersByTime(10);
    scheduler.reset();
    vi.advanceTimersByTime(100);

    expect(next).not.toHaveBeenCalled();
  });

  it('destroy is safe and idempotent', () => {
    const scheduler = new TimerScheduler(25);
    expect(() => scheduler.destroy()).not.toThrow();
    expect(() => scheduler.destroy()).not.toThrow();
  });

  it('ignores batch stream contents', async () => {
    const scheduler = new TimerScheduler(20);
    const batch$ = new Subject<BatchInfo>();
    const done = firstValueFrom(scheduler.scheduleBatch(batch$));

    batch$.next({tasks: [{queries: [{path: 'a.b'}]}] as any, createdAt: Date.now(), elapsedMs: 0});
    batch$.next({tasks: [{queries: [{path: 'x.y'}]}] as any, createdAt: Date.now(), elapsedMs: 1});

    vi.advanceTimersByTime(20);

    await expect(done).resolves.toBeUndefined();
  });
});
