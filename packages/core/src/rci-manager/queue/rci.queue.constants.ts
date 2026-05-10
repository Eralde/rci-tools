import {RCI_QUEUE_STATE, RciQueueOptions, RciQueueState} from './rci.queue.types';

export const RCI_QUEUE_DEFAULT_BATCH_TIMEOUT = 20;
export const SAVE_CONFIGURATION_QUERY = 'system.configuration.save';

export const RCI_QUEUE_DEFAULT_OPTIONS: RciQueueOptions<never> = {
  batchTimeout: RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
  blockerQueue: null,
};

export const RCI_QUEUE_BUSY_STATES: RciQueueState[] = [
  RCI_QUEUE_STATE.BATCHING_TASKS,
  RCI_QUEUE_STATE.AWAITING_RESPONSE,
  RCI_QUEUE_STATE.PENDING,
];
