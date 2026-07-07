import {QueueOptions} from './rci.manager.types';

export const RCI_QUERY_TIMEOUT = 60_000; // 1 minute
export const RCI_SCHEDULER_SWAP_DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  saveConfiguration: false,
  isPriorityTask: false,
};
