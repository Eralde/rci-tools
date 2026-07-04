import {describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {RciQueue} from '../../../src/rci-manager/queue';
import {RuleScheduler, type BaseHttpResponse, type HttpTransport} from '../../../src';

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

describe('RuleScheduler integration', () => {
  it('flushes queue immediately when a rule matches the current batch', () => {
    const transport = makeTransport();
    const scheduler = new RuleScheduler([
      (snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface.stat'),
    ]);
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 20}, scheduler);

    queue.addTask({path: 'show.version'}).subscribe();
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    queue.addTask({path: 'show.interface.stat'}).subscribe();
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect((transport.sendQueryArray as any).mock.calls[0][1]).toHaveLength(2);
  });

  it('does not flush if no rule matches', () => {
    const transport = makeTransport();
    const scheduler = new RuleScheduler([
      () => false,
    ]);
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0}, scheduler);

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.system'}).subscribe();

    expect(transport.sendQueryArray).not.toHaveBeenCalled();
  });

  it('trigger task stays in flushed batch', () => {
    const transport = makeTransport();
    const scheduler = new RuleScheduler([
      (snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface.stat'),
    ]);
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0}, scheduler);

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.interface.stat'}).subscribe();

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect((transport.sendQueryArray as any).mock.calls[0][1]).toHaveLength(2);
  });
});
