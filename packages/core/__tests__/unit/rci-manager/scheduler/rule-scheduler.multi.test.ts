import {describe, expect, it} from 'vitest';
import {RciQueue, RuleScheduler, when} from '../../../../src';
import {makeTransport} from '../../test.utils';

const FAKE_RIC_ENDPOINT = 'http://device/rci/';

describe('RuleScheduler integration', () => {
  it('flushes queue immediately when a rule matches the current batch', () => {
    const transport = makeTransport();
    const scheduler = new RuleScheduler([
      when((snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface.stat')),
    ]);

    const queue = new RciQueue(FAKE_RIC_ENDPOINT, transport, {batchTimeout: 20, scheduler});

    queue.addTask({path: 'show.version'}).subscribe();
    expect(transport.sendQueryArray).not.toHaveBeenCalled();

    queue.addTask({path: 'show.interface.stat'}).subscribe();
    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect((transport.sendQueryArray as any).mock.calls[0][1]).toHaveLength(2);
  });

  it('does not flush if no rule matches', () => {
    const transport = makeTransport();
    const scheduler = new RuleScheduler([
      when(() => false),
    ]);

    const queue = new RciQueue(FAKE_RIC_ENDPOINT, transport, {batchTimeout: 0, scheduler});

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.system'}).subscribe();

    expect(transport.sendQueryArray).not.toHaveBeenCalled();
  });

  it('trigger task stays in flushed batch', () => {
    const transport = makeTransport();
    const scheduler = new RuleScheduler([
      when((snapshot) => snapshot.queryPaths.some((path) => path === 'show.interface.stat')),
    ]);
    const queue = new RciQueue(FAKE_RIC_ENDPOINT, transport, {batchTimeout: 0, scheduler});

    queue.addTask({path: 'show.version'}).subscribe();
    queue.addTask({path: 'show.interface.stat'}).subscribe();

    expect(transport.sendQueryArray).toHaveBeenCalledTimes(1);
    expect((transport.sendQueryArray as any).mock.calls[0][1]).toHaveLength(2);
  });
});
