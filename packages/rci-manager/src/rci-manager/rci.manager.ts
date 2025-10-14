import _ from 'lodash';
import {BaseHttpResponse, HttpTransport} from '../transport';
import type {GenericObject} from '../type.utils';
import {RciQuery, RciTask} from './query';
import {RciQueue} from './queue';
import type {ExecuteOptions, GenericResponse$} from './rci.manager.types';
import {RciContinuedQuery, RciContinuedQueue} from './continued';
import type {RciContinuedTaskOptions} from './continued';
import {DEFAULT_EXECUTE_OPTIONS} from './rci.manager.constants';

export class RciManager {
  protected readonly batchQueue: RciQueue<BaseHttpResponse>;
  protected readonly priorityQueue: RciQueue<BaseHttpResponse>;
  protected readonly continuedQueues: Record<string, RciContinuedQueue> = {};

  protected readonly rciPath: string;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<BaseHttpResponse>,
  ) {
    this.rciPath = `${this.host}/rci/`;
    this.priorityQueue = new RciQueue(this.rciPath, this.httpTransport, {batchTimeout: 0});

    this.batchQueue = new RciQueue(
      this.rciPath,
      this.httpTransport,
      // the batch queue will be blocked any time the priority queue is used to execute something
      {blockerQueue: this.priorityQueue},
    );
  }

  public execute(query: RciTask, options: ExecuteOptions = DEFAULT_EXECUTE_OPTIONS): GenericResponse$ {
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
    query: RciQuery,
    options: RciContinuedTaskOptions = {},
  ): RciContinuedQuery {
    const queue = new RciContinuedQueue(this.rciPath, query.path, this.httpTransport);

    return queue.push(query.data as GenericObject, options);
  }

  public queueContinuedTask(
    query: RciQuery,
    options: RciContinuedTaskOptions = {},
  ): RciContinuedQuery {
    const {path} = query;
    const data = query.data || {};

    if (!this.continuedQueues[path]) {
      this.continuedQueues[path] = new RciContinuedQueue(this.rciPath, path, this.httpTransport);
    }

    return this.continuedQueues[path].push(data as GenericObject, options);
  }
}
