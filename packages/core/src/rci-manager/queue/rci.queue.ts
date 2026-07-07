import {BehaviorSubject, EMPTY, Observable, Subject, Subscription, defer, of, race} from 'rxjs';
import {buffer, catchError, exhaustMap, filter, map, switchMap, take, timeout} from 'rxjs/operators';
import {RciPayloadHelper} from '../payload';
import type {BaseHttpResponse, HttpTransport} from '../../transport';
import type {GenericObject, ObjectOrArray} from '../../type.utils';
import {RCI_QUERY_TIMEOUT} from '../rci.manager.constants';
import type {RciQuery, RciTask} from '../query';
import type {BatchScheduler, BatchSnapshot} from '../scheduler';
import {TimerScheduler} from '../scheduler';
import type {QueryStatsCollector} from '../stats';
import type {RciQueueOptions, RciQueueState, Task} from './rci.queue.types';
import {BatchHttpResult, BlockerRaceResult, RCI_QUEUE_STATE} from './rci.queue.types';
import {
  RCI_QUEUE_BUSY_STATES,
  RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
  SAVE_CONFIGURATION_QUERY,
  clampNonNegativeTimeout,
} from './rci.queue.constants';
import {QueueNotIdleError} from './queue-not-idle.error';

export class RciQueue<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  private readonly stateSub$ = new BehaviorSubject<RciQueueState>(RCI_QUEUE_STATE.READY);

  public readonly state$ = this.stateSub$.asObservable();

  public readonly isBusy$ = this.state$
    .pipe(
      map((state) => {
        return RCI_QUEUE_BUSY_STATES.includes(state);
      }),
    );

  // a stream to emit batch tasks to;
  // multiple tasks will be sent as a single HTTP query
  private readonly tasks$ = new Subject<Task<QueryPath>>();

  private readonly batchFinish$ = new Subject<void>();

  // tasks batched for the next HTTP query
  private readonly batch$: Observable<Task<QueryPath>[]> = this.tasks$.pipe(buffer(this.batchFinish$));

  private readonly blockerQueue: RciQueue<ResponseType, QueryPath> | null;
  private scheduler: BatchScheduler<QueryPath>;
  private readonly queueName: string;
  private readonly statsCollector: QueryStatsCollector | null;
  private readonly pendingTaskSubjects = new Set<Subject<ObjectOrArray>>();

  private pendingTasksCount = 0;
  private batchSubscription: Subscription | null = null;
  private batchCreatedAt = 0;
  private currentTaskCount = 0;
  private currentQueryCount = 0;
  private currentQueryPaths: QueryPath[] = [];
  private currentBatchSub$: Subject<BatchSnapshot<QueryPath>> | null = null;
  private currentSchedulerSub: Subscription | null = null;
  private isDestroyed = false;

  constructor(
    private rciPath: string,
    private httpTransport: HttpTransport<ResponseType>,
    private options: Partial<RciQueueOptions<ResponseType, QueryPath>> = {},
  ) {
    const _options: RciQueueOptions<ResponseType, QueryPath> = {
      ...this.options,
      batchTimeout: this.options.batchTimeout ?? RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
      blockerQueue: this.options.blockerQueue ?? null,
    } as RciQueueOptions<ResponseType, QueryPath>;

    this.blockerQueue = _options.blockerQueue;
    this.queueName = _options.queueName ?? 'unknown';
    this.scheduler = _options.scheduler
      ?? new TimerScheduler<QueryPath>(clampNonNegativeTimeout(_options.batchTimeout));
    this.statsCollector = _options.statsCollector ?? null;

    this.batchSubscription = this.initializeBatchSubscription();
  }

  public addTask(query: RciQuery<QueryPath>, saveConfiguration?: boolean): Observable<GenericObject | undefined>;
  public addTask(query: RciQuery<QueryPath>[], saveConfiguration?: boolean): Observable<GenericObject[]>;
  public addTask(
    query: RciTask<QueryPath>,
    saveConfiguration?: boolean,
  ): Observable<GenericObject | GenericObject[] | undefined>;
  public addTask(query: RciTask<QueryPath>, saveConfiguration: boolean = false): Observable<any> {
    return defer(() => this.addTaskWhenSubscribed(query, saveConfiguration));
  }

  private addTaskWhenSubscribed(query: RciTask<QueryPath>, saveConfiguration: boolean): Observable<any> {
    const task$ = this.processTask(query, saveConfiguration);

    if (!this.blockerQueue) {
      return task$;
    }

    const blocked$ = this.blockerQueue.isBusy$
      .pipe(
        filter(Boolean),
        take(1),
        map((): BlockerRaceResult => ({type: 'blocked'})),
      );

    const race$ = race(
      task$.pipe(map((data): BlockerRaceResult => ({type: 'task', data}))),
      blocked$,
    );

    return race$
      .pipe(
        exhaustMap((winner) => {
          if (winner.type === 'task') {
            return of(winner.data);
          }

          this.setState(RCI_QUEUE_STATE.PENDING);

          return this.blockerQueue!.state$
            .pipe(
              filter((state) => state === RCI_QUEUE_STATE.READY),
              take(1),
              exhaustMap(() => this.addTask(query, saveConfiguration)),
            );
        }),
      );
  }

  private processTask(query: RciTask<QueryPath>, saveConfiguration: boolean = false): Observable<any> {
    // Outer Observable is required to avoid adding a new task
    // until returned Observable is actually subscribed to
    return of(true)
      .pipe(
        exhaustMap(() => {
          const task = this.prepareTask(query, saveConfiguration);

          if (this.stateSub$.value === RCI_QUEUE_STATE.READY) {
            this.startBatch();
          }

          this.pendingTasksCount++;

          for (const q of task.queries) {
            this.currentQueryPaths.push(q.path);
          }

          this.currentTaskCount += 1;
          this.currentQueryCount += task.queries.length;

          this.tasks$.next(task);

          this.currentBatchSub$?.next({
            taskCount: this.currentTaskCount,
            queryCount: this.currentQueryCount,
            createdAt: this.batchCreatedAt,
            elapsedMs: Date.now() - this.batchCreatedAt,
            queryPaths: [...this.currentQueryPaths],
          });

          return task.subject.asObservable();
        }),
      );
  }

  private setState(state: RciQueueState): void {
    this.stateSub$.next(state);
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    this.closeCurrentWindow();
    this.batchSubscription?.unsubscribe();

    this.batchSubscription = null;

    for (const subject of this.pendingTaskSubjects) {
      subject.error(new Error('Queue destroyed'));
    }

    this.stateSub$.complete();
    this.tasks$.complete();
    this.batchFinish$.complete();
  }

  public setScheduler(scheduler: BatchScheduler<QueryPath>): void {
    if (this.stateSub$.value !== RCI_QUEUE_STATE.READY) {
      throw new QueueNotIdleError(this.stateSub$.value);
    }

    this.scheduler = scheduler;
  }

  private provideDataToTasks(chunkedResponses: GenericObject[][], tasks: Task<QueryPath>[]): void {
    tasks.forEach(({subject, isSingleQuery}, index) => {
      const taskData = isSingleQuery
        ? chunkedResponses[index]![0]!
        : chunkedResponses[index]!;

      subject.next(taskData);
      subject.complete();
      this.pendingTaskSubjects.delete(subject);
    });
  }

  private provideErrorDataToTasks(error: unknown, tasks: Task<QueryPath>[]): void {
    tasks.forEach(({subject}) => {
      subject.error(error);
      this.pendingTaskSubjects.delete(subject);
    });
  }

  private initializeBatchSubscription(): Subscription {
    return this.batch$
      .pipe(
        switchMap((tasks) => {
          this.setState(RCI_QUEUE_STATE.AWAITING_RESPONSE);

          this.pendingTasksCount -= tasks.length;

          const {
            queryArray,
            queryMap,
          } = RciPayloadHelper.batchTasks(tasks);

          const sentAt = Date.now();
          const statsQueryPaths = tasks.flatMap((task) => {
            return task.queries.map((q) => q.path);
          });

          return this.httpTransport.sendQueryArray(this.rciPath, queryArray)
            .pipe(
              timeout(RCI_QUERY_TIMEOUT),
              map((batchedResponse): [GenericObject[], null] => [batchedResponse, null]),
              catchError((httpClientError) => of([[], httpClientError] as [GenericObject[], unknown])),
              map(([batchedResponse, httpClientError]): BatchHttpResult<QueryPath> => {
                return {
                  batchedResponse,
                  httpClientError,
                  queryMap,
                  tasks,
                  sentAt,
                  statsQueryPaths,
                };
              }),
            );
        }),
      )
      .subscribe((result) => {
        const {batchedResponse, httpClientError, queryMap, tasks, sentAt, statsQueryPaths} = result;

        if (httpClientError) {
          this.provideErrorDataToTasks(httpClientError, tasks);
        } else {
          const chunkedResponses = RciPayloadHelper.splitResponsesPerTask(batchedResponse, tasks, queryMap);

          this.provideDataToTasks(chunkedResponses, tasks);
        }

        const durationMs = Date.now() - sentAt;
        const queryCount = tasks.reduce((sum: number, task: Task<QueryPath>) => sum + task.queries.length, 0);

        try {
          this.statsCollector?.collect({
            queueName: this.queueName,
            taskCount: tasks.length,
            queryCount,
            queryPaths: statsQueryPaths,
            sentAt,
            durationMs,
            success: !httpClientError,
            error: httpClientError ?? undefined,
          });
        } catch (error) {
          console.warn('Stats collection failed:', error);
        }

        this.onResponseProcessingFinish();
      });
  }

  private prepareTask(query: RciTask<QueryPath>, saveConfiguration: boolean): Task<QueryPath> {
    const subject = new Subject<ObjectOrArray>();

    this.pendingTaskSubjects.add(subject);
    const isSingleQuery = !Array.isArray(query);
    const queriesList: RciQuery<QueryPath>[] = isSingleQuery
      ? [query]
      : [...query];

    if (saveConfiguration) {
      queriesList.push({path: SAVE_CONFIGURATION_QUERY as QueryPath, data: {}});
    }

    const queries = queriesList.map((query) => {
      return {
        ...query,
        extractData: query?.extractData ?? true,
      };
    });

    return {queries, subject, isSingleQuery};
  }

  private startBatch(): void {
    this.closeCurrentWindow();
    this.setState(RCI_QUEUE_STATE.BATCHING_TASKS);

    this.batchCreatedAt = Date.now();
    this.currentBatchSub$ = new Subject<BatchSnapshot<QueryPath>>();

    this.currentSchedulerSub = this.scheduler
      .schedule(this.currentBatchSub$.asObservable())
      .pipe(
        take(1),
        catchError((error) => {
          console.error('Scheduler error, forcing batch flush:', error);
          this.batchFinish$.next();
          this.closeCurrentWindow();

          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.batchFinish$.next();
        this.closeCurrentWindow();
      });
  }

  private closeCurrentWindow(): void {
    this.currentSchedulerSub?.unsubscribe();

    this.currentSchedulerSub = null;

    this.currentBatchSub$?.complete();

    this.currentBatchSub$ = null;
    this.currentTaskCount = 0;
    this.currentQueryCount = 0;
    this.currentQueryPaths = [];
  }

  private onResponseProcessingFinish(): void {
    if (this.pendingTasksCount === 0) {
      this.setState(RCI_QUEUE_STATE.READY);
    } else {
      this.startBatch();
    }
  }
}
