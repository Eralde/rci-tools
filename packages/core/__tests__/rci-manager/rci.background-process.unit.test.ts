import {describe, expect, it, vi} from 'vitest';
import {Subject, of} from 'rxjs';
import {
  RCI_BACKGROUND_PROCESS_FINISH_REASON,
  RCI_BACKGROUND_PROCESS_STATE,
  RciBackgroundProcess,
  RciBackgroundTaskQueue,
} from '../../src';
import {makeTransport} from '../test.utils';

class TestBackgroundProcess extends RciBackgroundProcess<string> {
  public finish(reason: RCI_BACKGROUND_PROCESS_FINISH_REASON): void {
    this['doneSub$'].next(reason);
  }
}

describe('RciBackgroundProcess cleanup', () => {
  it('maps finish reasons to final states', () => {
    const cases = [
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE, RCI_BACKGROUND_PROCESS_STATE.COMPLETED],
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED, RCI_BACKGROUND_PROCESS_STATE.ABORTED],
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT, RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT],
      [RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR, RCI_BACKGROUND_PROCESS_STATE.ERROR],
    ] as const;

    for (const [reason, state] of cases) {
      const process = new TestBackgroundProcess('show.version', {}, {}, 'http://device/rci/', makeTransport());
      process.finish(reason);
      expect(process.getState()).toBe(state);
      process.destroy();
    }
  });

  it('destroy completes public streams', () => {
    const process = new RciBackgroundProcess('show.version', {}, {}, 'http://device/rci/', makeTransport());
    const completed = vi.fn();

    process.state$.subscribe({complete: completed});
    process.destroy();
    process.destroy();

    expect(completed).toHaveBeenCalledTimes(1);
  });
});

describe('RciBackgroundTaskQueue cleanup', () => {
  it('destroy completes state$ and queued processes', () => {
    const queue = new RciBackgroundTaskQueue('http://device/rci/', 'show.version', makeTransport());
    const completed = vi.fn();

    queue.state$.subscribe({complete: completed});
    queue.push({});

    queue.destroy();
    queue.destroy();

    expect(completed).toHaveBeenCalledTimes(1);
  });
});
