import {Observable, defer, throwError} from 'rxjs';
import {filter, finalize, map, shareReplay, take, tap, timeout} from 'rxjs/operators';
import type {BaseHttpResponse, HttpTransport} from '../transport/http.transport';
import {sendQueryArray} from '../transport/send-query-array';
import type {RciQuery, RciResponseOf, RciResultsOf} from './query/rci.query';
import {RCI_QUEUE_DEFAULT_BATCH_TIMEOUT} from './queue/rci.queue.constants';
import {RCI_QUEUE_STATE} from './queue/rci.queue.types';
import {RciQueue} from './queue/rci.queue';
import type {BatchScheduler} from './scheduler/scheduler.types';
import {RciBackgroundProcess, type RciBackgroundProcessOptions} from './background-process/rci.background-process';
import {RciBackgroundTaskQueue} from './background-process/rci.background-task.queue';
import {RciPayloadHelper} from './payload/rci.payload.helper';
import type {GenericObject, TaskResult} from '../type.utils';
import type {QueueOptions, RciBatchResultsConstraint, RciManagerOptions} from './rci.manager.types';
import {DEFAULT_QUEUE_OPTIONS, RCI_QUERY_TIMEOUT, RCI_SCHEDULER_SWAP_DEFAULT_TIMEOUT_MS} from './rci.manager.constants';
import type {QueryStats} from './stats/query-stats';
import {QueryStatsCollector} from './stats/query-stats-collector';
import {resolveDuration, withRequestTimeout} from './rci.timing';

const isQueryList = <P extends string>(
  query: RciQuery<P> | readonly RciQuery<P>[],
): query is readonly RciQuery<P>[] => {
  return Array.isArray(query);
};

export class SchedulerReplacementInProgressError extends Error {
  constructor() {
    super('A scheduler replacement is already in progress.');

    this.name = 'SchedulerReplacementInProgressError';
  }
}

export class RciManagerDestroyedError extends Error {
  constructor() {
    super('RciManager is destroyed.');

    this.name = 'RciManagerDestroyedError';
  }
}

export class RciManager<
  QueryPath extends string = string,
  BackgroundQueryPath extends string = string,
> {
  protected readonly batchQueue: RciQueue<BaseHttpResponse, QueryPath>;
  protected readonly priorityQueue: RciQueue<BaseHttpResponse, QueryPath>;
  protected readonly backgroundQueues: Record<string, RciBackgroundTaskQueue<BackgroundQueryPath>> = {};
  protected readonly statsCollector = new QueryStatsCollector<QueryPath>();
  private readonly requestTimeout: number;
  protected currentSchedulerSwapToken: symbol | null = null;
  protected isDestroyed = false;

  protected readonly rciPath: string;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<BaseHttpResponse>,
    private options: RciManagerOptions<QueryPath> = {},
  ) {
    const batchTimeout = resolveDuration(
      'batchTimeout',
      this.options.batchTimeout,
      {
        fallback: RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
      },
    );

    this.requestTimeout = resolveDuration(
      'requestTimeout',
      this.options.requestTimeout,
      {
        fallback: RCI_QUERY_TIMEOUT,
      },
    );

    this.rciPath = `${this.host}/rci/`;

    this.priorityQueue = new RciQueue<BaseHttpResponse, QueryPath>(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout: 0,
        requestTimeout: this.requestTimeout,
        queueName: 'priority',
        statsCollector: this.statsCollector,
      },
    );

    this.batchQueue = new RciQueue<BaseHttpResponse, QueryPath>(
      this.rciPath,
      this.httpTransport,
      {
        batchTimeout,
        requestTimeout: this.requestTimeout,
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
    return this.statsCollector.stats$;
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
        if (this.isDestroyed) {
          return throwError(() => new RciManagerDestroyedError());
        }

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

  /**
   * `T` is asserted, not runtime-validated; validate at runtime (e.g. with a schema) if needed.
   */
  public execute<
    T extends object = never,
    Q extends RciQuery<QueryPath> = RciQuery<QueryPath>,
    R = [T] extends [never] ? RciResponseOf<Q> : T,
  >(query: Q): Observable<R | undefined>;
  public execute<
    T extends object = never,
    Q extends readonly [] | readonly RciQuery<QueryPath>[] = readonly RciQuery<QueryPath>[],
    R extends RciBatchResultsConstraint<T, Q> = [T] extends [never] ? RciResultsOf<Q> : Array<T | undefined>,
  >(query: Q): Observable<R>;
  public execute(
    query: RciQuery<QueryPath> | readonly RciQuery<QueryPath>[],
  ): Observable<GenericObject | Array<GenericObject | undefined> | undefined> {
    const isSingleQuery = !isQueryList(query);
    const queryList: Array<RciQuery<QueryPath>> = isSingleQuery
      ? [query]
      : [...query];

    const {
      queryArray,
      queryMap,
    } = RciPayloadHelper.compactQueries(queryList);

    // The destroyed check runs on each subscription: a deferred subscribe or a retry() after destroy() sends nothing
    return defer(() => {
      if (this.isDestroyed) {
        return throwError(() => new RciManagerDestroyedError());
      }

      return sendQueryArray(this.httpTransport, this.rciPath, queryArray);
    })
      .pipe(
        withRequestTimeout(this.requestTimeout),
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

  /**
   * `T` is asserted, not runtime-validated; validate at runtime (e.g. with a schema) if needed.
   */
  public queue<
    T extends object = never,
    Q extends RciQuery<QueryPath> = RciQuery<QueryPath>,
    R = [T] extends [never] ? RciResponseOf<Q> : T,
  >(query: Q, options?: QueueOptions): Observable<R | undefined>;
  public queue<
    T extends object = never,
    Q extends readonly [] | readonly RciQuery<QueryPath>[] = readonly RciQuery<QueryPath>[],
    R extends RciBatchResultsConstraint<T, Q> = [T] extends [never] ? RciResultsOf<Q> : Array<T | undefined>,
  >(query: Q, options?: QueueOptions): Observable<R>;
  public queue(
    query: RciQuery<QueryPath> | Array<RciQuery<QueryPath>>,
    options?: QueueOptions,
  ): Observable<TaskResult>;
  public queue(
    query: RciQuery<QueryPath> | readonly RciQuery<QueryPath>[],
    options: QueueOptions = DEFAULT_QUEUE_OPTIONS,
  ): Observable<TaskResult> {
    const task = isQueryList(query) ? [...query] : query;

    return defer(() => {
      if (this.isDestroyed) {
        return throwError(() => new RciManagerDestroyedError());
      }

      if (options.isPriorityTask) {
        return this.priorityQueue.addTask(task, options.saveConfiguration);
      } else {
        return this.batchQueue.addTask(task, options.saveConfiguration);
      }
    });
  }

  public initBackgroundProcess(
    query: RciQuery<BackgroundQueryPath>,
    options: RciBackgroundProcessOptions = {},
  ): RciBackgroundProcess<BackgroundQueryPath> {
    if (this.isDestroyed) {
      throw new RciManagerDestroyedError();
    }

    return new RciBackgroundProcess<BackgroundQueryPath>(
      query.path,
      query.data ?? {},
      options,
      this.rciPath,
      this.httpTransport,
    );
  }

  public queueBackgroundProcess(
    query: RciQuery<BackgroundQueryPath>,
    options: RciBackgroundProcessOptions = {},
  ): RciBackgroundProcess<BackgroundQueryPath> {
    if (this.isDestroyed) {
      throw new RciManagerDestroyedError();
    }

    const {path} = query;
    const key = String(path);
    const data = query.data ?? {};

    if (!this.backgroundQueues[key]) {
      this.backgroundQueues[key] = new RciBackgroundTaskQueue<BackgroundQueryPath>(
        this.rciPath,
        path,
        this.httpTransport,
      );
    }

    return this.backgroundQueues[key].push(data, options);
  }

  // Processes created by `initBackgroundProcess` are owned by the caller and are not destroyed here.
  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    this.batchQueue.destroy();
    this.priorityQueue.destroy();

    Object.values(this.backgroundQueues).forEach((queue) => queue.destroy());

    this.statsCollector.destroy();
  }
}
