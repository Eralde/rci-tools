import type {RciQueueState} from './rci.queue.types';

export class QueueNotIdleError extends Error {
  constructor(public readonly state: RciQueueState) {
    super(`Cannot replace scheduler unless queue state is READY (current: ${state}).`);
    this.name = 'QueueNotIdleError';
  }
}
