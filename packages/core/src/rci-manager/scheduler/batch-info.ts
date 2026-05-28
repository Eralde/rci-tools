import type {Task} from '../queue/rci.queue.types';

export interface BatchInfo {
  tasks: readonly Task[];
  createdAt: number;
  elapsedMs: number;
}
