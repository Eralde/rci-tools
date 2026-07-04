import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {RciManager, type BaseHttpResponse, type HttpTransport} from '../../../src';

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

describe('RciQueue scheduler integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default batch queue scheduler still batches tasks in one timeout window', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);

    manager.queue({path: 'show.version'}).subscribe();
    manager.queue({path: 'show.system'}).subscribe();

    vi.advanceTimersByTime(19);
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });

  it('priority queue stays immediate', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);

    manager.queue({path: 'show.version'}, {isPriorityTask: true}).subscribe();
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
  });
});
