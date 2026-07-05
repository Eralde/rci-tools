import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER, Subject, firstValueFrom, timer} from 'rxjs';
import {map} from 'rxjs/operators';
import {
  type BatchScheduler,
  type BatchSnapshot,
  RciManager,
  RuleScheduler,
  SchedulerReplacementInProgressError,
  after,
  pathIncluded,
  queryCountAtLeast,
} from '../../src';
import {RCI_QUEUE_DEFAULT_BATCH_TIMEOUT} from '../../src/rci-manager/queue';
import {makeTransport} from '../test.utils';

const FAKE_HOST = 'http://device';

describe('RciManager scheduler wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to timer scheduler semantics for batch queue', () => {
    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport);

    manager.queue({path: 'show.version'}).subscribe();
    manager.queue({path: 'show.system'}).subscribe();

    vi.advanceTimersByTime(RCI_QUEUE_DEFAULT_BATCH_TIMEOUT - 1);
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('uses options.batchScheduler for batch queue', () => {
    const transport = makeTransport();
    const batchScheduler: BatchScheduler = {
      schedule: vi.fn(() => timer(0).pipe(map(() => undefined))),
    };

    const manager = new RciManager(FAKE_HOST, transport, {batchScheduler});

    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(batchScheduler.schedule).toHaveBeenCalledTimes(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('clamps options.batchTimeout to non-negative', () => {
    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport, {batchTimeout: -100});

    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('waits for READY before replacing scheduler', () => {
    const BATCH_TIMEOUT = 100;

    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport, {batchTimeout: BATCH_TIMEOUT});
    const completed = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();

    const swap$ = manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    });

    swap$.subscribe({complete: completed});

    vi.advanceTimersByTime(BATCH_TIMEOUT - 1);
    expect(completed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('errors with timeout when queue does not become READY', async () => {
    const transport = makeTransport();
    const neverFlushScheduler: BatchScheduler = {
      schedule: () => NEVER,
    };

    const manager = new RciManager(
      FAKE_HOST,
      transport,
      {
        batchScheduler: neverFlushScheduler,
        batchTimeout: 100,
      },
    );

    manager.queue({path: 'show.version'}).subscribe();

    const swapPromise = firstValueFrom(
      manager.replaceBatchScheduler(
        {
          schedule: () => timer(0).pipe(map(() => undefined)),
        },
        {waitIdleFor: 10},
      ),
    );

    vi.advanceTimersByTime(10);

    await expect(swapPromise).rejects.toMatchObject({name: 'TimeoutError'});
  });

  it('errors when replacement is already in progress', async () => {
    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport, {batchTimeout: 100});

    manager.queue({path: 'show.version'}).subscribe();
    manager.replaceBatchScheduler(
      {
        schedule: () => timer(0).pipe(map(() => undefined)),
      },
      {waitIdleFor: 1000},
    )
      .subscribe();

    const swap2$ = manager.replaceBatchScheduler(
      {
        schedule: () => timer(0).pipe(map(() => undefined)),
      },
      {waitIdleFor: 1000},
    );

    await expect(firstValueFrom(swap2$)).rejects.toBeInstanceOf(SchedulerReplacementInProgressError);
  });

  it('shares one replacement execution across multiple subscribers', () => {
    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport, {batchTimeout: 20});
    const completeA = vi.fn();
    const completeB = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();

    const swap$ = manager.replaceBatchScheduler(
      {
        schedule: () => timer(0).pipe(map(() => undefined)),
      },
      {waitIdleFor: 1000},
    );

    swap$.subscribe({complete: completeA});
    swap$.subscribe({complete: completeB});

    vi.advanceTimersByTime(20);

    expect(completeA).toHaveBeenCalledTimes(1);
    expect(completeB).toHaveBeenCalledTimes(1);
  });

  it('creating observable without subscribing does not block later replacement', () => {
    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport, {batchTimeout: 20});
    const completed = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();

    manager.replaceBatchScheduler(
      {
        schedule: () => timer(0).pipe(map(() => undefined)),
      },
      {waitIdleFor: 1000},
    );

    const swap2$ = manager.replaceBatchScheduler(
      {
        schedule: () => timer(0).pipe(map(() => undefined)),
      },
      {waitIdleFor: 5000},
    );

    swap2$.subscribe({complete: completed});

    vi.advanceTimersByTime(20);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('early unsubscribe from one subscriber does not clear active state for another', () => {
    const transport = makeTransport();
    const manager = new RciManager(FAKE_HOST, transport, {batchTimeout: 50});
    const completeA = vi.fn();
    const completeB = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();

    const swap$ = manager.replaceBatchScheduler(
      {
        schedule: () => timer(0).pipe(map(() => undefined)),
      },
      {waitIdleFor: 1000},
    );

    const subA = swap$.subscribe({complete: completeA});

    swap$.subscribe({complete: completeB});
    subA.unsubscribe();

    vi.advanceTimersByTime(50);
    expect(completeA).not.toHaveBeenCalled();
    expect(completeB).toHaveBeenCalledTimes(1);
  });
});

describe('RuleScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeSnapshot(overrides: Partial<BatchSnapshot> = {}): BatchSnapshot {
    return {
      taskCount: 0,
      queryCount: 0,
      createdAt: Date.now(),
      elapsedMs: 0,
      queryPaths: [],
      ...overrides,
    };
  }

  it('count-based rule flushes after queryCount threshold is met', async () => {
    const scheduler = new RuleScheduler([queryCountAtLeast(3)]);
    const batch$ = new Subject<BatchSnapshot>();

    const schedulePromise = firstValueFrom(scheduler.schedule(batch$));

    batch$.next(makeSnapshot({queryCount: 1}));
    batch$.next(makeSnapshot({queryCount: 2}));
    // Still shouldn't resolve yet

    batch$.next(makeSnapshot({queryCount: 3}));
    await schedulePromise; // should resolve when count >= 3
  });

  it('path-based rule flushes when matching path appears', async () => {
    const scheduler = new RuleScheduler([pathIncluded('show.interface')]);
    const batch$ = new Subject<BatchSnapshot>();

    const schedulePromise = firstValueFrom(scheduler.schedule(batch$));

    batch$.next(makeSnapshot({queryPaths: ['show.version']}));
    batch$.next(makeSnapshot({queryPaths: ['show.system']}));

    batch$.next(makeSnapshot({queryPaths: ['show.interface']}));
    await schedulePromise;
  });

  it('time-based rule flushes after timer even without new snapshots', async () => {
    const scheduler = new RuleScheduler([after(100)]);
    const batch$ = new Subject<BatchSnapshot>();

    const schedulePromise = firstValueFrom(scheduler.schedule(batch$));

    vi.advanceTimersByTime(100);
    await schedulePromise;
  });

  it('combines multiple rules — shortest path wins', async () => {
    const scheduler = new RuleScheduler([
      queryCountAtLeast(10), // won't fire
      after(50), // fires at 50ms
      pathIncluded('show.interface'), // won't appear
    ]);
    const batch$ = new Subject<BatchSnapshot>();

    const schedulePromise = firstValueFrom(scheduler.schedule(batch$));

    vi.advanceTimersByTime(50);
    await schedulePromise;
  });
});
