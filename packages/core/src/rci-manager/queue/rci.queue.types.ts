import {Subject} from 'rxjs';
import type {BaseHttpResponse} from '../../transport';
import type {ObjectOrArray, Values} from '../../type.utils';
import {RciQuery} from '../query';
import type {BatchScheduler} from '../scheduler';
import type {QueryStatsCollector} from '../stats';
import {RciQueue} from './rci.queue';

export interface RciQueueOptions<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  batchTimeout: number;
  blockerQueue: RciQueue<ResponseType, QueryPath> | null;
  queueName?: string;
  scheduler?: BatchScheduler<QueryPath> | undefined;
  statsCollector?: QueryStatsCollector | null | undefined;
}

export const RCI_QUEUE_STATE = {
  // the queue is ready to process tasks
  READY: 'READY',

  // the queue is preparing a batch of tasks to be sent in a single HTTP query
  BATCHING_TASKS: 'BATCHING_TASKS',

  // the queue was preempted by its 'blocker' queue: batching stopped and any
  // in-flight HTTP query was abandoned (its response will be ignored, tasks
  // returned to the queue); once the 'blocker' queue is READY again, all
  // pending tasks are (re-)sent as a single batch
  PENDING: 'PENDING',

  // the queue has sent an HTTP query and is awaiting response
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
} as const;

export type RciQueueState = Values<typeof RCI_QUEUE_STATE>;

export interface Task<QueryPath extends string = string> {
  isSingleQuery: boolean;
  queries: RciQuery<QueryPath>[];
  subject: Subject<ObjectOrArray>;
}
