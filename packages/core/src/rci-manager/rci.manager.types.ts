import type {BatchScheduler} from './scheduler/scheduler.types';

export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface RciManagerOptions<QueryPath extends string = string> {
  batchTimeout?: number;
  batchScheduler?: BatchScheduler<QueryPath>;
}
