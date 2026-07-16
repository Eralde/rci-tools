import {BehaviorSubject, Observable, ReplaySubject, Subject, Subscription, defer, of} from 'rxjs';
import {catchError, distinctUntilChanged, map, take, timeout} from 'rxjs/operators';
import {RciPayloadHelper} from '../payload';
import type {QueryMap} from '../payload';
import type {BaseHttpResponse, HttpTransport} from '../../transport';
import type {GenericObject, ObjectOrArray} from '../../type.utils';
import {RCI_QUERY_TIMEOUT} from '../rci.manager.constants';
import type {RciQuery, RciTask} from '../query';
import type {BatchScheduler, BatchSnapshot} from '../scheduler';
import {TimerScheduler} from '../scheduler';
import type {QueryStatsCollector} from '../stats';
import type {RciQueueOptions, RciQueueState, Task} from './rci.queue.types';
import {RCI_QUEUE_STATE} from './rci.queue.types';
import {
  RCI_QUEUE_BUSY_STATES,
  RCI_QUEUE_DEFAULT_BATCH_TIMEOUT,
  SAVE_CONFIGURATION_QUERY,
  clampNonNegativeTimeout,
} from './rci.queue.constants';
import {QueueNotIdleError} from './queue-not-idle.error';

interface InFlightBatch<QueryPath extends string = string> {
  tasks: Task<QueryPath>[];
  subscription: Subscription;
}

export class RciQueue<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  private readonly stateSub$ = new BehaviorSubject<RciQueueState>(RCI_QUEUE_STATE.READY);

  public readonly state$ = this.stateSub$.asObservable();

  public readonly isBusy$ = this.state$
    .pipe(
      map((state) => {
        return RCI_QUEUE_BUSY_STATES.includes(state);
      }),
    );

  /**
   * Blocker queue semantics (see docs/QUEUE.md for the full contract):
   * when `options.blockerQueue` becomes busy, this queue is preempted —
   * an open batching window is closed, an in-flight HTTP query is abandoned
   * (its response will be IGNORED) and its tasks are put back at the head
   * of the pending list. The queue then stays PENDING until the blocker
   * queue is READY again, at which point all pending tasks are (re-)sent
   * as a single batch.
   *
   * NOTE: an abandoned in-flight query may still have been executed by the
   * device — preemption discards the response, it cannot recall the request.
   * The re-sent batch executes those queries again.
   */
  private readonly blockerQueue: RciQueue<ResponseType, QueryPath> | null;
  private scheduler: BatchScheduler<QueryPath>;
  private readonly queueName: string;
  private readonly statsCollector: QueryStatsCollector | null;

  // tasks waiting for the next HTTP query, in insertion order;
  // tasks recalled from a preempted in-flight query go back to the head
  private pendingTasks: Task<QueryPath>[] = [];
  private inFlight: InFlightBatch<QueryPath> | null = null;

  private blockerSubscription: Subscription | null = null;
  private batchCreatedAt = 0;
  private currentBatchSub$: Subject<BatchSnapshot<QueryPath>> | null = null;
  private currentSchedulerSub: Subscription | null = null;
  private isDestroyed = false;

  constructor(
    private rciPath: string,
    private httpTransport: HttpTransport<ResponseType>,
    private initOptions: Partial<RciQueueOptions<ResponseType, QueryPath>> = {},
  ) {
    const batchTimeout = clampNonNegativeTimeout(this.initOptions.batchTimeout ?? RCI_QUEUE_DEFAULT_BATCH_TIMEOUT);

    this.blockerQueue = this.initOptions.blockerQueue ?? null;
    this.queueName = this.initOptions.queueName ?? 'unknown';
    this.scheduler = this.initOptions.scheduler ?? new TimerScheduler<QueryPath>(batchTimeout);
    this.statsCollector = this.initOptions.statsCollector ?? null;

    if (this.blockerQueue) {
      this.blockerSubscription = this.blockerQueue.isBusy$
        .pipe(distinctUntilChanged())
        .subscribe((isBlockerBusy) => {
          if (isBlockerBusy) {
            this.preempt();
          } else {
            this.resume();
          }
        });
    }
  }

  public get isBusy(): boolean {
    return RCI_QUEUE_BUSY_STATES.includes(this.stateSub$.value);
  }

  public addTask(query: RciQuery<QueryPath>, saveConfiguration?: boolean): Observable<GenericObject | undefined>;
  public addTask(query: RciQuery<QueryPath>[], saveConfiguration?: boolean): Observable<GenericObject[]>;
  public addTask(
    query: RciTask<QueryPath>,
    saveConfiguration?: boolean,
  ): Observable<GenericObject | GenericObject[] | undefined>;
  public addTask(query: RciTask<QueryPath>, saveConfiguration: boolean = false): Observable<any> {
    // defer() postpones all side effects until the returned Observable is subscribed to
    return defer(() => this.enqueueTask(query, saveConfiguration));
  }

  public setScheduler(scheduler: BatchScheduler<QueryPath>): void {
    if (this.stateSub$.value !== RCI_QUEUE_STATE.READY) {
      throw new QueueNotIdleError(this.stateSub$.value);
    }

    this.scheduler = scheduler;
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    this.blockerSubscription?.unsubscribe();

    this.blockerSubscription = null;

    this.closeCurrentWindow();

    if (this.inFlight) {
      this.inFlight.subscription.unsubscribe();

      this.pendingTasks = [...this.inFlight.tasks, ...this.pendingTasks];
      this.inFlight = null;
    }

    const unresolvedTasks = this.pendingTasks;

    this.pendingTasks = [];

    for (const task of unresolvedTasks) {
      task.subject.error(new Error('Queue destroyed'));
    }

    this.stateSub$.complete();
  }

  private enqueueTask(query: RciTask<QueryPath>, saveConfiguration: boolean): Observable<any> {
    const task = this.prepareTask(query, saveConfiguration);
    const isQueueReady = this.stateSub$.value === RCI_QUEUE_STATE.READY;

    this.pendingTasks.push(task);

    if (isQueueReady) {
      // startBatch() emits the first snapshot itself
      this.startBatch();
    } else {
      this.emitBatchSnapshot();
    }

    return task.subject.asObservable();
  }

  private prepareTask(query: RciTask<QueryPath>, saveConfiguration: boolean): Task<QueryPath> {
    // A ReplaySubject so that a result produced synchronously
    // (e.g. by a scheduler that fires on subscribe) still reaches the caller
    const subject = new ReplaySubject<ObjectOrArray>(1);
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

  private setState(state: RciQueueState): void {
    this.stateSub$.next(state);
  }

  private isBlocked(): boolean {
    return this.blockerQueue?.isBusy ?? false;
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

          return of(undefined);
        }),
      )
      .subscribe(() => {
        this.onSchedulerFired();
      });

    this.emitBatchSnapshot();
  }

  private closeCurrentWindow(): void {
    this.currentSchedulerSub?.unsubscribe();

    this.currentSchedulerSub = null;

    this.currentBatchSub$?.complete();

    this.currentBatchSub$ = null;
  }

  private emitBatchSnapshot(): void {
    if (!this.currentBatchSub$) {
      return;
    }

    const queryPaths = this.pendingTasks.flatMap((task) => {
      return task.queries.map((query) => query.path);
    });

    this.currentBatchSub$.next({
      taskCount: this.pendingTasks.length,
      queryCount: queryPaths.length,
      createdAt: this.batchCreatedAt,
      elapsedMs: Date.now() - this.batchCreatedAt,
      queryPaths,
    });
  }

  private onSchedulerFired(): void {
    this.closeCurrentWindow();

    if (this.isBlocked()) {
      this.setState(RCI_QUEUE_STATE.PENDING);

      return;
    }

    this.sendPendingTasks();
  }

  private sendPendingTasks(): void {
    if (this.pendingTasks.length === 0) {
      this.setState(RCI_QUEUE_STATE.READY);

      return;
    }

    const tasks = this.pendingTasks;

    this.pendingTasks = [];

    this.setState(RCI_QUEUE_STATE.AWAITING_RESPONSE);

    const {
      queryArray,
      queryMap,
    } = RciPayloadHelper.batchTasks(tasks);

    const sentAt = Date.now();

    let isSettled = false;

    const subscription = this.httpTransport.sendQueryArray(this.rciPath, queryArray)
      .pipe(
        timeout(RCI_QUERY_TIMEOUT),
        map((batchedResponse): [GenericObject[], unknown] => [batchedResponse, null]),
        catchError((httpClientError) => of([[], httpClientError] as [GenericObject[], unknown])),
      )
      .subscribe(([batchedResponse, httpClientError]) => {
        isSettled = true;
        this.inFlight = null;

        this.handleBatchResponse(tasks, queryMap, sentAt, batchedResponse, httpClientError);
      });

    // the transport may respond synchronously, in which case the batch
    // is already settled and must not be recorded as in-flight
    if (!isSettled) {
      this.inFlight = {tasks, subscription};
    }
  }

  private handleBatchResponse(
    tasks: Task<QueryPath>[],
    queryMap: QueryMap,
    sentAt: number,
    batchedResponse: GenericObject[],
    httpClientError: unknown,
  ): void {
    if (httpClientError) {
      this.provideErrorDataToTasks(httpClientError, tasks);
    } else {
      const chunkedResponses = RciPayloadHelper.splitResponsesPerTask(batchedResponse, tasks, queryMap);

      this.provideDataToTasks(chunkedResponses, tasks);
    }

    const durationMs = Date.now() - sentAt;
    const queryCount = tasks.reduce((sum: number, task: Task<QueryPath>) => sum + task.queries.length, 0);
    const queryPaths = tasks.flatMap((task) => task.queries.map((query) => query.path));

    try {
      this.statsCollector?.collect({
        queueName: this.queueName,
        taskCount: tasks.length,
        queryCount,
        queryPaths,
        sentAt,
        durationMs,
        success: !httpClientError,
        error: httpClientError ?? undefined,
      });
    } catch (error) {
      console.warn('Stats collection failed:', error);
    }

    this.onSendFinished();
  }

  private onSendFinished(): void {
    if (this.isDestroyed) {
      return;
    }

    if (this.pendingTasks.length === 0) {
      this.setState(RCI_QUEUE_STATE.READY);
    } else if (this.isBlocked()) {
      this.setState(RCI_QUEUE_STATE.PENDING);
    } else {
      // tasks queued while the response was pending get a new batching window
      this.startBatch();
    }
  }

  private provideDataToTasks(chunkedResponses: GenericObject[][], tasks: Task<QueryPath>[]): void {
    tasks.forEach(({subject, isSingleQuery}, index) => {
      const taskData = isSingleQuery
        ? chunkedResponses[index]![0]!
        : chunkedResponses[index]!;

      subject.next(taskData);
      subject.complete();
    });
  }

  private provideErrorDataToTasks(error: unknown, tasks: Task<QueryPath>[]): void {
    tasks.forEach(({subject}) => {
      subject.error(error);
    });
  }

  // the blocker queue became busy: stop whatever this queue is doing
  // and wait (PENDING) until the blocker queue is READY again
  private preempt(): void {
    const state = this.stateSub$.value;

    if (state === RCI_QUEUE_STATE.AWAITING_RESPONSE) {
      this.recallInFlightTasks();
      this.setState(RCI_QUEUE_STATE.PENDING);
    } else if (state === RCI_QUEUE_STATE.BATCHING_TASKS) {
      this.closeCurrentWindow();
      this.setState(RCI_QUEUE_STATE.PENDING);
    }

    // READY: nothing to preempt (a later flush attempt re-checks the blocker);
    // PENDING: already waiting for the blocker queue
  }

  // the blocker queue is READY again: re-send everything that was preempted
  // (plus any tasks queued while waiting) as a single batch, immediately —
  // these tasks have already waited through at least one scheduling window
  private resume(): void {
    if (this.stateSub$.value !== RCI_QUEUE_STATE.PENDING) {
      return;
    }

    this.sendPendingTasks();
  }

  private recallInFlightTasks(): void {
    if (!this.inFlight) {
      return;
    }

    const {tasks, subscription} = this.inFlight;

    this.inFlight = null;

    // the response, if it ever arrives, is discarded;
    // the device may still have executed the query — see the class-level note
    subscription.unsubscribe();

    this.pendingTasks = [...tasks, ...this.pendingTasks];
  }
}
