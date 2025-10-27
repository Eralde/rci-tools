import {BaseHttpResponse, HttpTransport} from '../transport';
import type {GenericObject} from '../type.utils';
import {RciQuery, RciTask} from './query';
import {RciQueue} from './queue';
import {RCI_QUEUE_DEFAULT_BATCH_TIMEOUT} from './queue/rci.queue.constants';
import type {ExecuteOptions, GenericResponse$} from './rci.manager.types';
import {RciContinuedQuery, RciContinuedQueue} from './continued';
import type {RciContinuedTaskOptions} from './continued';
import {DEFAULT_EXECUTE_OPTIONS} from './rci.manager.constants';

export class RciManager<
  QueryPath extends string = string,
  ContinuedQueryPath extends string = string
> {
  protected readonly batchQueue: RciQueue<BaseHttpResponse>;
  protected readonly priorityQueue: RciQueue<BaseHttpResponse>;
  protected readonly continuedQueues: Record<string, RciContinuedQueue<ContinuedQueryPath>> = {};

  protected readonly rciPath: string;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<BaseHttpResponse>,
    private batchTimeout = RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
  ) {
    this.rciPath = `${this.host}/rci/`;
    this.priorityQueue = new RciQueue(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout: 0,
      },
    );

    this.batchQueue = new RciQueue(
      this.rciPath,
      this.httpTransport,
      // the batch queue will be blocked any time the priority queue is used to execute something
      {
        batchTimeout: Math.max(this.batchTimeout, 0),
        blockerQueue: this.priorityQueue,
      },
    );
  }

  public execute(
    query: RciTask<QueryPath>,
    options: ExecuteOptions = DEFAULT_EXECUTE_OPTIONS
  ): GenericResponse$ {
    const _options = {
      ...DEFAULT_EXECUTE_OPTIONS,
      ...options,
    };

    if (_options.isPriorityTask) {
      return this.priorityQueue.addTask(query, _options.saveConfiguration);
    } else {
      return this.batchQueue.addTask(query, _options.saveConfiguration);
    }
  }

  public executeContinued(
    query: RciQuery<ContinuedQueryPath>,
    options: RciContinuedTaskOptions = {},
  ): RciContinuedQuery {
    const queue = new RciContinuedQueue<ContinuedQueryPath>(this.rciPath, query.path, this.httpTransport);

    return queue.push(query.data as GenericObject, options);
  }

  public queueContinuedTask(
    query: RciQuery<ContinuedQueryPath>,
    options: RciContinuedTaskOptions = {},
  ): RciContinuedQuery {
    const {path} = query;
    const key = String(path);
    const data = query.data || {};

    if (!this.continuedQueues[key]) {
      this.continuedQueues[key] = new RciContinuedQueue<ContinuedQueryPath>(this.rciPath, path, this.httpTransport);
    }

    return this.continuedQueues[key].push(data as GenericObject, options);
  }
}
