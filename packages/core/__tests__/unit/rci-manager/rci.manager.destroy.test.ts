import {describe, expect, it, vi} from 'vitest';
import {NEVER, firstValueFrom} from 'rxjs';
import {RciManager, RciManagerDestroyedError, TimerScheduler} from '../../../src';
import {makeTransport} from '../test.utils';

function makeDestroyedManager() {
  const transport = makeTransport();
  const manager = new RciManager('http://device', transport);

  manager.destroy();

  return {manager, transport};
}

describe('RciManager.destroy', () => {
  it('is idempotent', () => {
    const {manager} = makeDestroyedManager();

    expect(() => manager.destroy()).not.toThrow();
  });

  it('execute after destroy errors with RciManagerDestroyedError and sends nothing', async () => {
    const {manager, transport} = makeDestroyedManager();

    await expect(firstValueFrom(manager.execute({path: 'show.version'}))).rejects.toBeInstanceOf(
      RciManagerDestroyedError,
    );
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('queue after destroy errors with RciManagerDestroyedError', async () => {
    const {manager} = makeDestroyedManager();

    await expect(firstValueFrom(manager.queue({path: 'show.version'}))).rejects.toBeInstanceOf(
      RciManagerDestroyedError,
    );
    await expect(firstValueFrom(manager.queue({path: 'show.version'}, {isPriorityTask: true}))).rejects
      .toBeInstanceOf(RciManagerDestroyedError);
  });

  it('replaceBatchScheduler after destroy errors with RciManagerDestroyedError', async () => {
    const {manager} = makeDestroyedManager();

    await expect(firstValueFrom(manager.replaceBatchScheduler(new TimerScheduler(0)))).rejects.toBeInstanceOf(
      RciManagerDestroyedError,
    );
  });

  it('background process factories throw RciManagerDestroyedError after destroy', () => {
    const {manager, transport} = makeDestroyedManager();

    expect(() => manager.initBackgroundProcess({path: 'tools.ping'})).toThrow(RciManagerDestroyedError);
    expect(() => manager.queueBackgroundProcess({path: 'tools.ping'})).toThrow(RciManagerDestroyedError);
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('destroys background queues created before destroy', () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(NEVER);

    const manager = new RciManager('http://device', transport);
    let completed = false;

    manager.queueBackgroundProcess({path: 'tools.ping'}).state$.subscribe({complete: () => (completed = true)});
    manager.destroy();

    expect(completed).toBe(true);
  });
});
