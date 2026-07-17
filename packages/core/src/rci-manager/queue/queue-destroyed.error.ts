export class QueueDestroyedError extends Error {
  constructor() {
    super(`Unable to enqueue: queue is destroyed`);

    this.name = 'QueueDestroyedError';
  }
}
