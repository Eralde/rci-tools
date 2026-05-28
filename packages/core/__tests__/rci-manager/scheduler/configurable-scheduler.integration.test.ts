import {describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {RciQueue} from '../../../src/rci-manager/queue/rci.queue';
import {ConfigurableScheduler} from '../../../src/rci-manager/scheduler';
import type {BaseHttpResponse, HttpTransport} from '../../../src/transport';

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

describe('ConfigurableScheduler integration', () => {
  it('flushes queue immediately when a rule matches the current batch', () => {
    const transport = makeTransport();
    const scheduler = new ConfigurableScheduler([
      (batchInfo) => batchInfo.tasks.some((task) => {
        return task.queries.some((query) => query.path === 'show.interface.stat');
      }),
    ]);
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 20}, scheduler);

    queue.addTask({path: 'show.version'}).subscribe();
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    queue.addTask({path: 'show.interface.stat'}).subscribe();
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect((transport.sendQueryArray as any).mock.calls[0][1]).toHaveLength(1);
  });

  it('does not flush if no rule matches', () => {
    const transport = makeTransport();
    const scheduler = new ConfigurableScheduler([
      () => false,
    ]);
    const queue = new RciQueue('http://device/rci/', transport, {batchTimeout: 0}, scheduler);

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.system'}).subscribe();

    expect(transport.sendQueryArray).not.toHaveBeenCalled();
  });
});
