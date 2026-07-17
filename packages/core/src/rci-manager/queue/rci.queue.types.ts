import {Subject} from 'rxjs';
import type {BaseHttpResponse} from '../../transport';
import type {GenericObject, TaskResult, Values} from '../../type.utils';
import {RciQuery} from '../query';
import type {BatchScheduler} from '../scheduler';
import type {QueryStatsCollector} from '../stats';
import {RciQueue} from './rci.queue';
import type {QueryMap} from '../payload';

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

  // the queue is pending until the 'blocker' queue is free,
  // then it will retry sending the last batch
  PENDING: 'PENDING',

  // the queue has sent an HTTP query and is awaiting response
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
} as const;

export type RciQueueState = Values<typeof RCI_QUEUE_STATE>;

export interface Task<QueryPath extends string = string> {
  isSingleQuery: boolean;
  queries: RciQuery<QueryPath>[];
  subject: Subject<TaskResult>;
}

export type BlockerRaceResult =
  | {type: 'task'; data: TaskResult}
  | {type: 'blocked'};

export interface BatchHttpResult<QueryPath extends string = string> {
  batchedResponse: GenericObject[];
  httpClientError: unknown;
  queryMap: QueryMap;
  tasks: Task<QueryPath>[];
  sentAt: number;
  statsQueryPaths: QueryPath[];
}
