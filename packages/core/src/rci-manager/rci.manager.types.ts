import type {BatchScheduler} from './scheduler';

export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface RciManagerOptions {
  batchTimeout?: number;
  batchScheduler?: BatchScheduler;
}

export interface RciResponse {
  [key: string]: unknown;
  error?: unknown;
  status?: unknown;
  body?: unknown;
}
