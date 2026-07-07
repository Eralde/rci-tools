import {describe, expect, it, vi} from 'vitest';
import {Subject} from 'rxjs';
import {type BatchSnapshot, RuleScheduler, TimerScheduler, raceSchedulers, when} from '../../../../src';

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
      when(() => false),
      when((snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface')),
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
      when(() => false),
      when(() => false),
    ]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.version']));
    batch$.next(createSnapshot(['show.system']));

    expect(next).not.toHaveBeenCalled();
  });

  it('flushes when first rule emits, ignoring later matches', () => {
    // Two rules both match show.interface — first one in array wins via merge subscription order
    const batch$ = new Subject<BatchSnapshot>();
    const scheduler = new RuleScheduler([
      when((snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface')),
      when(() => true),
    ]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('flushes only once even if subsequent emissions match', () => {
    const batch$ = new Subject<BatchSnapshot>();
    const scheduler = new RuleScheduler([
      when(() => true),
    ]);
    const next = vi.fn();

    scheduler.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.version']));
    batch$.next(createSnapshot(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws when constructed with no rules', () => {
    expect(() => new RuleScheduler([])).toThrow('at least one rule');
  });
});

describe('raceSchedulers', () => {
  it('flushes when first scheduler emits', () => {
    const batch$ = new Subject<BatchSnapshot>();
    const ruleScheduler = new RuleScheduler([
      when((snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface')),
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
      when(() => false),
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

  it('works with one scheduler', () => {
    vi.useFakeTimers();

    const batch$ = new Subject<BatchSnapshot>();
    const composed = raceSchedulers(new TimerScheduler(10));
    const next = vi.fn();

    composed.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.version']));

    expect(next).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);
    expect(next).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('works with three schedulers and first wins', () => {
    vi.useFakeTimers();

    const batch$ = new Subject<BatchSnapshot>();
    const ruleScheduler1 = new RuleScheduler([
      when(() => false),
    ]);
    const ruleScheduler2 = new RuleScheduler([
      when((snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface')),
    ]);
    const composed = raceSchedulers(
      ruleScheduler1,
      new TimerScheduler(100),
      ruleScheduler2,
    );
    const next = vi.fn();

    composed.schedule(batch$).subscribe({next});
    batch$.next(createSnapshot(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
