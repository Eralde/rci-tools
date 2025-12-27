import {Subject} from 'rxjs';
import type {BaseHttpResponse} from '../../transport';
import type {ObjectOrArray, Values} from '../../type.utils';
import {RciQuery} from '../query';
import {RciQueue} from './rci.queue';

export interface RciQueueOptions<ResponseType extends BaseHttpResponse> {
  batchTimeout: number;
  blockerQueue: RciQueue<ResponseType> | null;
}

export const RCI_QUEUE_STATE = {
  // the queue is ready to process tasks
  READY: 'READY',

  // the queue is preparing a batch of tasks to be sent in a single HTTP query
  BATCHING_TASKS: 'BATCHING_TASKS',

  // the queue is pending until the 'blocker' queue is free,
  // then it will retry sending the last batch
  PENDING: 'PENDING',

  // the queue has sent an HTTP query and is awaiting response
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
} as const;

export type RciQueueState = Values<typeof RCI_QUEUE_STATE>;

export interface Task {
  isSingleQuery: boolean;
  queries: RciQuery[];
  subject: Subject<ObjectOrArray>;
}
