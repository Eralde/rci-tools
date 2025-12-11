import {QueueOptions} from './rci.manager.types';

export const RCI_QUERY_TIMEOUT = 60_000; // 1 minute

export const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  saveConfiguration: false,
  isPriorityTask: false,
};
