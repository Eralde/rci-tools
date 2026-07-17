import {Observable, defer, throwError} from 'rxjs';
import {filter, finalize, map, shareReplay, take, tap, timeout} from 'rxjs/operators';
import {BaseHttpResponse, HttpTransport} from '../transport';
import {RciQuery, RciTask} from './query';
import {RCI_QUEUE_DEFAULT_BATCH_TIMEOUT, RCI_QUEUE_STATE, RciQueue, clampNonNegativeTimeout} from './queue';
import {BatchScheduler} from './scheduler';
import {RciBackgroundProcess, RciBackgroundProcessOptions, RciBackgroundTaskQueue} from './background-process';
import {RciPayloadHelper} from './payload';
import type {GenericObject, TaskResult} from '../type.utils';
import type {QueueOptions, RciManagerOptions} from './rci.manager.types';
import {DEFAULT_QUEUE_OPTIONS, RCI_QUERY_TIMEOUT, RCI_SCHEDULER_SWAP_DEFAULT_TIMEOUT_MS} from './rci.manager.constants';
import {QueryStats, QueryStatsCollector} from './stats';

export class SchedulerReplacementInProgressError extends Error {
  constructor() {
    super('A scheduler replacement is already in progress.');

    this.name = 'SchedulerReplacementInProgressError';
  }
}

export class RciManager<
  QueryPath extends string = string,
  BackgroundQueryPath extends string = string,
> {
  protected readonly batchQueue: RciQueue<BaseHttpResponse, QueryPath>;
  protected readonly priorityQueue: RciQueue<BaseHttpResponse, QueryPath>;
  protected readonly backgroundQueues: Record<string, RciBackgroundTaskQueue<BackgroundQueryPath>> = {};
  protected readonly statsCollector = new QueryStatsCollector();
  protected currentSchedulerSwapToken: symbol | null = null;

  protected readonly rciPath: string;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<BaseHttpResponse>,
    private options: RciManagerOptions<QueryPath> = {},
  ) {
    const batchTimeout = this.options.batchTimeout ?? RCI_QUEUE_DEFAULT_BATCH_TIMEOUT;

    this.rciPath = `${this.host}/rci/`;

    this.priorityQueue = new RciQueue<BaseHttpResponse, QueryPath>(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout: 0,
        queueName: 'priority',
        statsCollector: this.statsCollector,
      },
    );

    this.batchQueue = new RciQueue<BaseHttpResponse, QueryPath>(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout: clampNonNegativeTimeout(batchTimeout),
        // the priority queue preempts the batch queue whenever it is busy:
        // an in-flight batch query is abandoned and re-sent afterward
        // (see "Blocker queue semantics" in docs/QUEUE.md)
        blockerQueue: this.priorityQueue,
        queueName: 'batch',
        scheduler: this.options.batchScheduler,
        statsCollector: this.statsCollector,
      },
    );
  }

  public get stats$(): Observable<QueryStats<QueryPath>> {
    return this.statsCollector.stats$ as Observable<QueryStats<QueryPath>>;
  }

  public toggleStats(enabled: boolean): void {
    this.statsCollector.toggle(enabled);
  }

  public replaceBatchScheduler(
    scheduler: BatchScheduler<QueryPath>,
    options: {waitIdleFor?: number} = {},
  ): Observable<void> {
    const waitIdleFor = options.waitIdleFor ?? RCI_SCHEDULER_SWAP_DEFAULT_TIMEOUT_MS;

    // Each call to replaceBatchScheduler returns a cold observable. The inner `defer`
    // performs the real swap once, then `shareReplay` multicasts that single execution
    // to every subscriber of *that* returned observable. It does NOT deduplicate
    // across multiple separate calls to `replaceBatchScheduler()`.
    let sharedSwap$: Observable<void> | null = null;

    return defer(() => {
      if (sharedSwap$) {
        return sharedSwap$;
      }

      sharedSwap$ = defer(() => {
        if (this.currentSchedulerSwapToken) {
          return throwError(() => new SchedulerReplacementInProgressError());
        }

        const token = Symbol('scheduler-swap');
        this.currentSchedulerSwapToken = token;

        return this.batchQueue.state$
          .pipe(
            filter((state) => state === RCI_QUEUE_STATE.READY),
            take(1),
            timeout(waitIdleFor),
            tap(() => {
              this.batchQueue.setScheduler(scheduler);
            }),
            map(() => undefined),
            finalize(() => {
              if (this.currentSchedulerSwapToken === token) {
                this.currentSchedulerSwapToken = null;
              }
            }),
          );
      })
        .pipe(
          shareReplay({bufferSize: 1, refCount: false}),
        );

      return sharedSwap$;
    });
  }

  public execute(query: RciQuery<QueryPath>): Observable<GenericObject | undefined>;
  public execute(query: Array<RciQuery<QueryPath>>): Observable<Array<GenericObject | undefined>>;
  public execute(query: RciTask<QueryPath>): Observable<GenericObject | Array<GenericObject | undefined> | undefined> {
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
          const extracted = allResponses.map((response, index) => {
            return RciPayloadHelper.prepareResponseData(response, queryList[index]!);
          });

          return isSingleQuery
            ? extracted[0]
            : extracted;
        }),
      );
  }

  public queue(query: RciQuery<QueryPath>, options?: QueueOptions): Observable<GenericObject | undefined>;
  public queue(query: Array<RciQuery<QueryPath>>, options?: QueueOptions): Observable<Array<GenericObject | undefined>>;
  public queue(
    query: RciQuery<QueryPath> | Array<RciQuery<QueryPath>>,
    options?: QueueOptions,
  ): Observable<TaskResult>;
  public queue(
    query: RciTask<QueryPath>,
    options: QueueOptions = DEFAULT_QUEUE_OPTIONS,
  ): Observable<TaskResult> {
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

  public destroy(): void {
    this.batchQueue.destroy();
    this.priorityQueue.destroy();

    Object.values(this.backgroundQueues).forEach((queue) => queue.destroy());

    this.statsCollector.destroy();
  }
}
