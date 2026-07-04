import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER, firstValueFrom, timer} from 'rxjs';
import {map} from 'rxjs/operators';
import {type BatchScheduler, RciManager, SchedulerReplacementInProgressError} from '../../src';
import {makeTransport} from '../test.utils';

describe('RciManager scheduler wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to timer scheduler semantics for batch queue', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);

    manager.queue({path: 'show.version'}).subscribe();
    manager.queue({path: 'show.system'}).subscribe();

    vi.advanceTimersByTime(19);
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('uses options.batchScheduler for batch queue', () => {
    const transport = makeTransport();
    const batchScheduler: BatchScheduler = {
      schedule: vi.fn(() => timer(0).pipe(map(() => undefined))),
    };
    const manager = new RciManager('http://device', transport, {batchScheduler});

    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(batchScheduler.schedule).toHaveBeenCalledTimes(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('clamps options.batchTimeout to non-negative', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: -100});

    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('waits for READY before replacing scheduler', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 100});
    const completed = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();
    const swap$ = manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    });
    swap$.subscribe({complete: completed});

    vi.advanceTimersByTime(99);
    expect(completed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('errors with timeout when queue does not become READY', async () => {
    const transport = makeTransport();
    const neverFlushScheduler: BatchScheduler = {
      schedule: () => NEVER,
    };
    const manager = new RciManager('http://device', transport, {
      batchScheduler: neverFlushScheduler,
      batchTimeout: 100,
    });

    manager.queue({path: 'show.version'}).subscribe();
    const swapPromise = firstValueFrom(manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 10}));

    vi.advanceTimersByTime(10);

    await expect(swapPromise).rejects.toMatchObject({name: 'TimeoutError'});
  });

  it('errors when replacement is already in progress', async () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 100});

    manager.queue({path: 'show.version'}).subscribe();
    manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 1000}).subscribe();

    await expect(firstValueFrom(manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 1000}))).rejects.toBeInstanceOf(SchedulerReplacementInProgressError);
  });

  it('shares one replacement execution across multiple subscribers', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 20});
    const completeA = vi.fn();
    const completeB = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();
    const swap$ = manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 1000});

    swap$.subscribe({complete: completeA});
    swap$.subscribe({complete: completeB});

    vi.advanceTimersByTime(20);

    expect(completeA).toHaveBeenCalledTimes(1);
    expect(completeB).toHaveBeenCalledTimes(1);
  });

  it('creating observable without subscribing does not block later replacement', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 20});
    const completed = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();

    manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 1000});

    const swap2$ = manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 5000});
    swap2$.subscribe({complete: completed});

    vi.advanceTimersByTime(20);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('early unsubscribe from one subscriber does not clear active state for another', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 50});
    const completeA = vi.fn();
    const completeB = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();
    const swap$ = manager.replaceBatchScheduler({
      schedule: () => timer(0).pipe(map(() => undefined)),
    }, {waitForIdleMs: 1000});

    const subA = swap$.subscribe({complete: completeA});
    swap$.subscribe({complete: completeB});

    subA.unsubscribe();

    vi.advanceTimersByTime(50);
    expect(completeA).not.toHaveBeenCalled();
    expect(completeB).toHaveBeenCalledTimes(1);
  });
});
