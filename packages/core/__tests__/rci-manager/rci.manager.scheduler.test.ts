import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER, firstValueFrom, of, timer} from 'rxjs';
import {map} from 'rxjs/operators';
import {RciManager} from '../../src/rci-manager';
import type {BaseHttpResponse, HttpTransport} from '../../src/transport';
import type {BatchScheduler} from '../../src/rci-manager/scheduler';
import {SchedulerReplacementInProgressError} from '../../src/rci-manager/rci.manager';

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
      scheduleBatch: vi.fn(() => timer(0).pipe(map(() => undefined))),
      reset: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new RciManager('http://device', transport, {batchScheduler});

    manager.queue({path: 'show.version'}).subscribe();
    vi.advanceTimersByTime(0);

    expect(batchScheduler.scheduleBatch).toHaveBeenCalledTimes(1);
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
    const swap$ = manager.setBatchScheduler({
      scheduleBatch: () => timer(0).pipe(map(() => undefined)),
      reset: vi.fn(),
      destroy: vi.fn(),
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
      scheduleBatch: () => NEVER,
      reset: vi.fn(),
      destroy: vi.fn(),
    };
    const manager = new RciManager('http://device', transport, {
      batchScheduler: neverFlushScheduler,
      batchTimeout: 100,
    });

    manager.queue({path: 'show.version'}).subscribe();
    const swapPromise = firstValueFrom(manager.setBatchScheduler({
      scheduleBatch: () => timer(0).pipe(map(() => undefined)),
      reset: vi.fn(),
      destroy: vi.fn(),
    }, 10));

    vi.advanceTimersByTime(10);

    await expect(swapPromise).rejects.toMatchObject({name: 'TimeoutError'});
  });

  it('errors when replacement is already in progress', async () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 100});

    manager.queue({path: 'show.version'}).subscribe();
    manager.setBatchScheduler({
      scheduleBatch: () => timer(0).pipe(map(() => undefined)),
      reset: vi.fn(),
      destroy: vi.fn(),
    }, 1000);

    await expect(firstValueFrom(manager.setBatchScheduler({
      scheduleBatch: () => timer(0).pipe(map(() => undefined)),
      reset: vi.fn(),
      destroy: vi.fn(),
    }, 1000))).rejects.toBeInstanceOf(SchedulerReplacementInProgressError);
  });

  it('shares one replacement execution across multiple subscribers', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 20});
    const completeA = vi.fn();
    const completeB = vi.fn();

    manager.queue({path: 'show.version'}).subscribe();
    const swap$ = manager.setBatchScheduler({
      scheduleBatch: () => timer(0).pipe(map(() => undefined)),
      reset: vi.fn(),
      destroy: vi.fn(),
    }, 1000);

    swap$.subscribe({complete: completeA});
    swap$.subscribe({complete: completeB});

    vi.advanceTimersByTime(20);

    expect(completeA).toHaveBeenCalledTimes(1);
    expect(completeB).toHaveBeenCalledTimes(1);
  });
});
