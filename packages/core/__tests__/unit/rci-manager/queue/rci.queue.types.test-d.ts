import {describe, expectTypeOf, it} from 'vitest';
import type {Observable} from 'rxjs';
import {
  type GenericObject,
  RCI_QUEUE_BUSY_STATES,
  RciQueue,
  type RciQueueState,
  type RciTask,
  type TaskResult,
} from '../../../../src';
import {makeTransport} from '../../test.utils';

declare const unionTask: RciTask;

describe('RciQueue public types', () => {
  it('exposes busy states as a readonly array', () => {
    expectTypeOf(RCI_QUEUE_BUSY_STATES).toEqualTypeOf<readonly RciQueueState[]>();
  });

  it('types addTask() single, array, and union inputs without any', () => {
    const queue = new RciQueue('http://device/rci/', makeTransport());

    expectTypeOf(queue.addTask({path: 'show.version'}))
      .toEqualTypeOf<Observable<GenericObject | undefined>>();
    expectTypeOf(queue.addTask([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();

    expectTypeOf(queue.addTask(unionTask)).toEqualTypeOf<Observable<TaskResult>>();
  });
});
