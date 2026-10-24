import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NEVER, TimeoutError} from 'rxjs';
import {RciManager, RciQueue} from '../../../src';
import {makeTransport} from '../test.utils';

const RCI = 'http://device/rci/';
const invalidValues = [-1, NaN, Infinity, 2_147_483_648];
const timingOptions = ['requestTimeout', 'batchTimeout'] as const;

describe('RciManager timing options', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(timingOptions.flatMap(name => invalidValues.map(value => [name, value] as const)))(
    'rejects invalid %s %s in RciManager',
    (name, value) => {
      expect(() => new RciManager('http://device', makeTransport(), {[name]: value})).toThrow(RangeError);
      expect(() => new RciManager('http://device', makeTransport(), {[name]: value})).toThrow(name);
    },
  );

  it.each(timingOptions.flatMap(name => invalidValues.map(value => [name, value] as const)))(
    'rejects invalid %s %s in RciQueue',
    (name, value) => {
      expect(() => new RciQueue(RCI, makeTransport(), {[name]: value})).toThrow(RangeError);
      expect(() => new RciQueue(RCI, makeTransport(), {[name]: value})).toThrow(name);
    },
  );

  it.each(timingOptions)('accepts the largest timer delay for %s', (name) => {
    expect(() => new RciManager('http://device', makeTransport(), {[name]: 2_147_483_647})).not.toThrow();
    expect(() => new RciQueue(RCI, makeTransport(), {[name]: 2_147_483_647})).not.toThrow();
  });

  it('applies requestTimeout to execute()', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);
    const manager = new RciManager('http://device', transport, {requestTimeout: 1000});
    const errors: unknown[] = [];

    manager.execute({path: 'show.version'}).subscribe({error: error => errors.push(error)});

    vi.advanceTimersByTime(999);
    expect(errors).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TimeoutError);

    manager.destroy();
  });

  it('applies requestTimeout to both queues', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);
    const manager = new RciManager('http://device', transport, {requestTimeout: 1000});
    const batchErrors: unknown[] = [];
    const priorityErrors: unknown[] = [];

    manager.queue({path: 'show.version'}).subscribe({error: error => batchErrors.push(error)});

    vi.advanceTimersByTime(20);
    expect(transport.post).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(batchErrors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(batchErrors).toHaveLength(1);
    expect(batchErrors[0]).toBeInstanceOf(TimeoutError);

    manager.queue({path: 'show.system'}, {isPriorityTask: true})
      .subscribe({error: error => priorityErrors.push(error)});

    vi.advanceTimersByTime(0);
    expect(transport.post).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(999);
    expect(priorityErrors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(priorityErrors).toHaveLength(1);
    expect(priorityErrors[0]).toBeInstanceOf(TimeoutError);

    manager.destroy();
  });

  it('requestTimeout 0 disables the timeout', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);
    const manager = new RciManager('http://device', transport, {requestTimeout: 0});
    const errors: unknown[] = [];

    manager.execute({path: 'show.version'}).subscribe({error: error => errors.push(error)});
    manager.queue({path: 'show.system'}).subscribe({error: error => errors.push(error)});

    vi.advanceTimersByTime(600_000);

    expect(errors).toEqual([]);
    expect(transport.post).toHaveBeenCalledTimes(2);

    manager.destroy();
  });

  it('defaults requestTimeout to 60 seconds', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);
    const manager = new RciManager('http://device', transport);
    const errors: unknown[] = [];

    manager.execute({path: 'show.version'}).subscribe({error: error => errors.push(error)});

    vi.advanceTimersByTime(59_999);
    expect(errors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TimeoutError);

    manager.destroy();
  });

  it('copies timing options at construction', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);
    const options = {requestTimeout: 1000, batchTimeout: 50};
    const manager = new RciManager('http://device', transport, options);
    const errors: unknown[] = [];

    options.requestTimeout = 0;
    options.batchTimeout = 500;
    manager.queue({path: 'show.version'}).subscribe({error: error => errors.push(error)});

    vi.advanceTimersByTime(49);
    expect(transport.post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(transport.post).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(999);
    expect(errors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TimeoutError);

    manager.destroy();
  });

  it('applies requestTimeout in a standalone RciQueue', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);
    const queue = new RciQueue(RCI, transport, {batchTimeout: 0, requestTimeout: 500});
    const errors: unknown[] = [];

    queue.addTask({path: 'show.version'}).subscribe({error: error => errors.push(error)});
    vi.advanceTimersByTime(0);
    expect(transport.post).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(499);
    expect(errors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TimeoutError);

    queue.destroy();
  });
});
