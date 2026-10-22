import {RCI_QUEUE_STATE, type RciQueueState} from './rci.queue.types';

export const RCI_QUEUE_DEFAULT_BATCH_TIMEOUT = 20;

export const clampNonNegativeTimeout = (timeoutMs: number): number => Math.max(timeoutMs, 0);

export const RCI_QUEUE_BUSY_STATES: readonly RciQueueState[] = [
  RCI_QUEUE_STATE.BATCHING_TASKS,
  RCI_QUEUE_STATE.AWAITING_RESPONSE,
  RCI_QUEUE_STATE.PENDING,
];
