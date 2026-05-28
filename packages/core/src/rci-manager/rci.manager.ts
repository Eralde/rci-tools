import {Observable, throwError} from 'rxjs';
import {filter, finalize, map, shareReplay, take, tap, timeout} from 'rxjs/operators';
import {BaseHttpResponse, HttpTransport} from '../transport';
import {RciQuery, RciTask} from './query';
import {RCI_QUEUE_DEFAULT_BATCH_TIMEOUT, RCI_QUEUE_STATE, RciQueue} from './queue';
import {BatchScheduler, TimerScheduler} from './scheduler';
import {RciBackgroundProcess, RciBackgroundProcessOptions, RciBackgroundTaskQueue} from './background-process';
import {RciPayloadHelper} from './payload';
import type {QueueOptions, RciManagerOptions} from './rci.manager.types';
import {DEFAULT_QUEUE_OPTIONS, RCI_QUERY_TIMEOUT} from './rci.manager.constants';
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
  protected readonly batchQueue: RciQueue<BaseHttpResponse>;
  protected readonly priorityQueue: RciQueue<BaseHttpResponse>;
  protected readonly backgroundQueues: Record<string, RciBackgroundTaskQueue<BackgroundQueryPath>> = {};
  private readonly statsCollector = new QueryStatsCollector();
  private currentSchedulerSwap$: Observable<void> | null = null;

  protected readonly rciPath: string;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<BaseHttpResponse>,
    private options: RciManagerOptions = {},
  ) {
    const batchTimeout = this.options.batchTimeout ?? RCI_QUEUE_DEFAULT_BATCH_TIMEOUT;

    this.rciPath = `${this.host}/rci/`;

    this.priorityQueue = new RciQueue(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout: 0,
        queueName: 'priority',
      },
      new TimerScheduler(0),
      this.statsCollector,
    );

    this.batchQueue = new RciQueue(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout: Math.max(batchTimeout, 0),
        // the batch queue will be blocked any time the priority queue is used to execute something
        blockerQueue: this.priorityQueue,
        queueName: 'batch',
      },
      this.options.batchScheduler ?? new TimerScheduler(Math.max(batchTimeout, 0)),
      this.statsCollector,
    );
  }

  public get stats$(): Observable<QueryStats> {
    return this.statsCollector.stats$;
  }

  public toggleStats(enabled: boolean): void {
    this.statsCollector.toggle(enabled);
  }

  public setBatchScheduler(scheduler: BatchScheduler, timeoutMs: number = 30_000): Observable<void> {
    if (this.currentSchedulerSwap$) {
      return throwError(() => new SchedulerReplacementInProgressError());
    }

    const swap$ = this.batchQueue.state$
      .pipe(
        filter((state) => state === RCI_QUEUE_STATE.READY),
        take(1),
        timeout(timeoutMs),
        tap(() => {
          this.batchQueue.setScheduler(scheduler);
        }),
        map(() => undefined),
        finalize(() => {
          this.currentSchedulerSwap$ = null;
        }),
        shareReplay({bufferSize: 1, refCount: false}),
      );

    this.currentSchedulerSwap$ = swap$;
    swap$.subscribe({
      error: () => undefined,
    });

    return swap$;
  }

  public execute(query: RciTask<QueryPath>): Observable<any> {
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
  ): Observable<any> {
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
    this.statsCollector.destroy();
  }
}
