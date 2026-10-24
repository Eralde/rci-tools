import type {BatchScheduler} from './scheduler/scheduler.types';

export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface RciManagerOptions<QueryPath extends string = string> {
  batchTimeout?: number;
  batchScheduler?: BatchScheduler<QueryPath>;
  /** Timeout in milliseconds per RCI HTTP request. Defaults to 60000; 0 disables the timeout. */
  requestTimeout?: number;
}

// `T = never` marks "no explicit response type": the result is then inferred from the queries
export type RciBatchResultsConstraint<T, Q extends readonly unknown[]> = [T] extends [never]
  ? { -readonly [K in keyof Q]: unknown }
  : Array<T | undefined>;
