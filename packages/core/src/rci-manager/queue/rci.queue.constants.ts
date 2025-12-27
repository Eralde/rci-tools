import {RciQueueOptions} from './rci.queue.types';

export const RCI_QUEUE_DEFAULT_BATCH_TIMEOUT = 20;
export const SAVE_CONFIGURATION_QUERY = 'system.configuration.save';

export const RCI_QUEUE_DEFAULT_OPTIONS: RciQueueOptions<never> = {
  batchTimeout: RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
  blockerQueue: null,
};
