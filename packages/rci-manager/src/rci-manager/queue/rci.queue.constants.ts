import {RciQueueOptions} from './rci.queue.types';

export const RCI_QUEUE_DEFAULT_BATCH_TIMEOUT = 100;
export const RCI_QUEUE_HTTP_TIMEOUT = 60_000; // 1 minute
export const SAVE_CONFIGURATION_QUERY = 'system.configuration.save';

export const RCI_QUEUE_DEFAULT_OPTIONS: RciQueueOptions<never> = {
  batchTimeout: RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
  blockerQueue: null,
};
