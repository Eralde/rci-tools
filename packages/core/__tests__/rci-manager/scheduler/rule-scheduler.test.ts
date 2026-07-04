import {describe, expect, it, vi} from 'vitest';
import {Subject} from 'rxjs';
import {type BatchSnapshot, RuleScheduler, TimerScheduler, raceSchedulers} from '../../../src';

const createSnapshot = (paths: string[], overrides: Partial<BatchSnapshot> = {}): BatchSnapshot => ({
  taskCount: overrides.taskCount ?? paths.length,
  queryCount: overrides.queryCount ?? paths.length,
  createdAt: overrides.createdAt ?? 1000,
  elapsedMs: overrides.elapsedMs ?? 0,
  queryPaths: paths,
});

describe('RuleScheduler', () => {
  it('flushes when any rule returns true', () => {
    const batch$ = new Subject<BatchSnapshot>();
    const scheduler = new RuleScheduler([
      () => false,
      (snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface'),
    ]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.version']));
    expect(next).not.toHaveBeenCalled();

    batch$.next(createSnapshot(['show.interface']));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not flush when all rules return false', () => {
    const batch$ = new Subject<BatchSnapshot>();
    const scheduler = new RuleScheduler([
      () => false,
      () => false,
    ]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.version']));
    batch$.next(createSnapshot(['show.system']));

    expect(next).not.toHaveBeenCalled();
  });

  it('evaluates rules in order and stops at first match', () => {
    const firstRule = vi.fn((snapshot: BatchSnapshot) => {
      return snapshot.queryPaths.some((path) => path === 'show.interface');
    });
    const secondRule = vi.fn(() => true);
    const thirdRule = vi.fn(() => true);
    const batch$ = new Subject<BatchSnapshot>();
    const scheduler = new RuleScheduler([firstRule, secondRule, thirdRule]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
    expect(firstRule).toHaveBeenCalledTimes(1);
    expect(secondRule).not.toHaveBeenCalled();
    expect(thirdRule).not.toHaveBeenCalled();
  });

  it('flushes only once even if subsequent emissions match', () => {
    const batch$ = new Subject<BatchSnapshot>();
    const scheduler = new RuleScheduler([
      () => true,
    ]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.version']));
    batch$.next(createSnapshot(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('raceSchedulers', () => {
  it('flushes when first scheduler emits', () => {
    const batch$ = new Subject<BatchSnapshot>();
    const ruleScheduler = new RuleScheduler([
      (snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface'),
    ]);
    const composed = raceSchedulers(ruleScheduler, new TimerScheduler(50));
    const next = vi.fn();

    composed.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('flushes when timer scheduler emits first', () => {
    vi.useFakeTimers();

    const batch$ = new Subject<BatchSnapshot>();
    const ruleScheduler = new RuleScheduler([
      () => false,
    ]);
    const composed = raceSchedulers(ruleScheduler, new TimerScheduler(25));
    const next = vi.fn();

    composed.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.noname']));

    expect(next).not.toHaveBeenCalled();

    vi.advanceTimersByTime(25);

    expect(next).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('requires at least one scheduler', () => {
    // @ts-expect-error raceSchedulers() with no arguments should not compile
    raceSchedulers();
  });
});
