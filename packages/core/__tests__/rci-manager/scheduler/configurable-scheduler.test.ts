import {describe, expect, it, vi} from 'vitest';
import {Subject} from 'rxjs';
import {ConfigurableScheduler, type BatchInfo} from '../../../src';

const createBatchInfo = (paths: string[], elapsedMs: number = 0): BatchInfo => {
  return {
    tasks: paths.map((path) => ({
      isSingleQuery: true,
      queries: [{path, extractData: true}],
      subject: new Subject(),
    })),
    createdAt: 1_000,
    elapsedMs,
  };
};

describe('ConfigurableScheduler', () => {
  it('flushes when any rule returns true', () => {
    const batch$ = new Subject<BatchInfo>();
    const scheduler = new ConfigurableScheduler([
      () => false,
      (batchInfo) => batchInfo.tasks.some((task) => task.queries.some((query) => query.path === 'show.interface')),
    ]);
    const next = vi.fn();

    scheduler.scheduleBatch(batch$).subscribe({next});
    batch$.next(createBatchInfo(['show.version']));
    expect(next).not.toHaveBeenCalled();

    batch$.next(createBatchInfo(['show.interface']));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not flush when all rules return false', () => {
    const batch$ = new Subject<BatchInfo>();
    const scheduler = new ConfigurableScheduler([
      () => false,
      () => false,
    ]);
    const next = vi.fn();

    scheduler.scheduleBatch(batch$).subscribe({next});
    batch$.next(createBatchInfo(['show.version']));
    batch$.next(createBatchInfo(['show.system']));

    expect(next).not.toHaveBeenCalled();
  });

  it('evaluates rules in order and stops at first match', () => {
    const firstRule = vi.fn((batchInfo: BatchInfo) => {
      return batchInfo.tasks.some((task) => task.queries.some((query) => query.path === 'show.interface'));
    });
    const secondRule = vi.fn(() => true);
    const thirdRule = vi.fn(() => true);
    const batch$ = new Subject<BatchInfo>();
    const scheduler = new ConfigurableScheduler([firstRule, secondRule, thirdRule]);
    const next = vi.fn();

    scheduler.scheduleBatch(batch$).subscribe({next});
    batch$.next(createBatchInfo(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
    expect(firstRule).toHaveBeenCalledTimes(1);
    expect(secondRule).not.toHaveBeenCalled();
    expect(thirdRule).not.toHaveBeenCalled();
  });

  it('flushes only once even if subsequent emissions match', () => {
    const batch$ = new Subject<BatchInfo>();
    const scheduler = new ConfigurableScheduler([
      () => true,
    ]);
    const next = vi.fn();

    scheduler.scheduleBatch(batch$).subscribe({next});
    batch$.next(createBatchInfo(['show.version']));
    batch$.next(createBatchInfo(['show.interface']));

    expect(next).toHaveBeenCalledTimes(1);
  });
});
