import {map, timeout} from 'rxjs/operators';
import {BaseHttpResponse, HttpTransport} from '../transport';
import {RciQuery, RciTask} from './query';
import {RCI_QUEUE_DEFAULT_BATCH_TIMEOUT, RciQueue} from './queue';
import {RciBackgroundProcess, RciBackgroundProcessOptions, RciBackgroundTaskQueue} from './background-process';
import {RciPayloadHelper} from './payload';
import type {GenericResponse, QueueOptions} from './rci.manager.types';
import {DEFAULT_QUEUE_OPTIONS, RCI_QUERY_TIMEOUT} from './rci.manager.constants';

export class RciManager<
  QueryPath extends string = string,
  BackgroundQueryPath extends string = string,
> {
  protected readonly batchQueue: RciQueue<BaseHttpResponse>;
  protected readonly priorityQueue: RciQueue<BaseHttpResponse>;
  protected readonly backgroundQueues: Record<string, RciBackgroundTaskQueue<BackgroundQueryPath>> = {};

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

  public execute(query: RciTask<QueryPath>): GenericResponse {
    const isSingleQuery = !Array.isArray(query);
    const queryList: Array<RciQuery<QueryPath>> = isSingleQuery
      ? [query]
      : query;

    const {
      queryArray,
      queryMap,
    } = RciPayloadHelper.compactQueries(queryList);

    // Moving catchError to the outer pipe
    // will cancel the batch$ Observable if an error occurs
    return this.httpTransport.sendQueryArray(this.rciPath, queryArray)
      .pipe(
        timeout(RCI_QUERY_TIMEOUT),
        map((batchedResponse) => {
          const allResponses = RciPayloadHelper.inflateResponse(batchedResponse, queryMap);

          return isSingleQuery
            ? allResponses[0]!
            : allResponses;
        }),
      );
  }

  public queue(
    query: RciTask<QueryPath>,
    options: QueueOptions = DEFAULT_QUEUE_OPTIONS,
  ): GenericResponse {
    if (options.isPriorityTask) {
      return this.priorityQueue.addTask(query, options.saveConfiguration);
    } else {
      return this.batchQueue.addTask(query, options.saveConfiguration);
    }
  }

  public initBackgroundProcess(
    query: RciQuery<BackgroundQueryPath>,
    options: RciBackgroundProcessOptions = {},
  ): RciBackgroundProcess<BackgroundQueryPath> {
    return new RciBackgroundProcess<BackgroundQueryPath>(
      query.path,
      query.data || {},
      options,
      this.rciPath,
      this.httpTransport,
    );
  }

  public queueBackgroundProcess(
    query: RciQuery<BackgroundQueryPath>,
    options: RciBackgroundProcessOptions = {},
  ): RciBackgroundProcess<BackgroundQueryPath> {
    const {path} = query;
    const key = String(path);
    const data = query.data || {};

    if (!this.backgroundQueues[key]) {
      this.backgroundQueues[key] = new RciBackgroundTaskQueue<BackgroundQueryPath>(
        this.rciPath,
        path,
        this.httpTransport,
      );
    }

    return this.backgroundQueues[key].push(data, options);
  }
}
