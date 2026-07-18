export class QueueDestroyedError extends Error {
  constructor(message: string = 'Queue destroyed') {
    super(message);

    this.name = 'QueueDestroyedError';
  }
}
