import type {BatchScheduler} from './scheduler';

export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface RciManagerOptions<QueryPath extends string = string> {
  batchTimeout?: number;
  batchScheduler?: BatchScheduler<QueryPath>;
}

export interface RciResponse {
  [key: string]: unknown;
  error?: unknown;
  status?: unknown;
  body?: unknown;
}
