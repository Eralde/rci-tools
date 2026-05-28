import {BehaviorSubject, EMPTY, Observable, Subject, Subscription, of, race} from 'rxjs';
import {buffer, catchError, exhaustMap, filter, map, switchMap, take, takeUntil, timeout} from 'rxjs/operators';
import {RciPayloadHelper} from '../payload';
import type {BaseHttpResponse, HttpTransport} from '../../transport';
import type {GenericObject, ObjectOrArray} from '../../type.utils';
import {RCI_QUERY_TIMEOUT} from '../rci.manager.constants';
import {RciQuery, RciTask} from '../query';
import {BatchInfo, BatchScheduler, TimerScheduler} from '../scheduler';
import {QueryStatsCollector} from '../stats';
import {RCI_QUEUE_STATE, RciQueueOptions, RciQueueState, Task} from './rci.queue.types';
import {RCI_QUEUE_BUSY_STATES, RCI_QUEUE_DEFAULT_OPTIONS, SAVE_CONFIGURATION_QUERY} from './rci.queue.constants';
import {QueueNotIdleError} from './queue-not-idle.error';

export class RciQueue<ResponseType extends BaseHttpResponse> {
  // @dprint-ignore
  private readonly stateSub$: BehaviorSubject<RciQueueState> = new BehaviorSubject<RciQueueState>(RCI_QUEUE_STATE.READY);

  public readonly state$ = this.stateSub$.asObservable();

  public readonly isBusy$ = this.state$
    .pipe(
      map((state) => {
        return RCI_QUEUE_BUSY_STATES.includes(state);
      }),
    );

  // a stream to emit batch tasks to;
  // multiple tasks will be sent as a single HTTP query
  private readonly tasks$ = new Subject<Task>();

  // each emitted value will cause a next batch of tasks to be processed
  private readonly batchFinish$ = new Subject<void>();

  // tasks batched for the next HTTP query
  private readonly batch$: Observable<Task[]> = this.tasks$
    .pipe(buffer(this.batchFinish$));

  private readonly blockerQueue: RciQueue<ResponseType> | null;
  private scheduler: BatchScheduler;
  private readonly queueName: string;
  private readonly statsCollector: QueryStatsCollector | null;

  private pendingTasksCount = 0;
  private batchSubscription: Subscription | null = null;
  private batchCreatedAt = 0;
  private currentBatch: Task[] = [];
  private currentBatchSub$: Subject<BatchInfo> | null = null;
  private currentSchedulerSub: Subscription | null = null;
  private isDestroyed = false;

  constructor(
    private rciPath: string,
    private httpTransport: HttpTransport<ResponseType>,
    private options: Partial<RciQueueOptions<ResponseType>> = {},
    scheduler?: BatchScheduler,
    statsCollector?: QueryStatsCollector | null,
  ) {
    const _options = {
      ...RCI_QUEUE_DEFAULT_OPTIONS,
      ...this.options,
    };

    this.blockerQueue = _options.blockerQueue;
    this.queueName = _options.queueName ?? 'unknown';
    this.scheduler = scheduler ?? new TimerScheduler(Math.max(_options.batchTimeout, 0));
    this.statsCollector = statsCollector ?? null;

    this.batchSubscription = this.initializeBatchSubscription();
  }

  public static createImpossibleApiResponse(): ObjectOrArray {
    return [[]]; // `[[]]` is a valid JSON, but this particular JSON is never returned by the RCI API
  }

  public static isImpossibleApiResponse(obj: ObjectOrArray): boolean {
    return Array.isArray(obj)
      && Array.isArray(obj?.[0])
      && obj?.[0].length === 0;
  }

  public addTask(query: RciTask, saveConfiguration: boolean = false): Observable<any> {
    const task$ = this.processTask(query, saveConfiguration);

    if (!this.blockerQueue) {
      return task$;
    }

    const retry$ = new Subject<ObjectOrArray>();

    this.blockerQueue.isBusy$
      .pipe(takeUntil(task$))
      .subscribe(() => retry$.next(RciQueue.createImpossibleApiResponse()));

    // If the 'blocker queue' becomes busy while the current task is being processed
    return race(task$, retry$)
      .pipe(
        exhaustMap((winner) => {
          // ... then we set this queue state to PENDING,
          if (RciQueue.isImpossibleApiResponse(winner)) {
            this.setState(RCI_QUEUE_STATE.PENDING);
            retry$.complete();

            if (!this.blockerQueue) {
              return this.addTask(query, saveConfiguration);
            }

            // ... and wait until the blocker queue is free,
            // to process the current task again
            return this.blockerQueue.state$
              .pipe(
                filter((state) => state === RCI_QUEUE_STATE.READY),
                take(1),
                exhaustMap(() => this.addTask(query, saveConfiguration)),
              );
          }

          return of(winner);
        }),
      );
  }

  private processTask(query: RciTask, saveConfiguration: boolean = false): Observable<any> {
    // Outer Observable is required to avoid adding a new task
    // until returned Observable is actually subscribed to
    return of(true)
      .pipe(
        exhaustMap(() => {
          const task = this.prepareTask(query, saveConfiguration);

          if (this.stateSub$.value === RCI_QUEUE_STATE.READY) {
            this.startBatch();
          }

          this.currentBatch.push(task);
          this.currentBatchSub$?.next({
            tasks: [...this.currentBatch],
            createdAt: this.batchCreatedAt,
            elapsedMs: Date.now() - this.batchCreatedAt,
          });
          this.tasks$.next(task);
          this.pendingTasksCount++;

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
    this.scheduler.destroy();
    this.batchSubscription?.unsubscribe();

    this.batchSubscription = null;

    this.stateSub$.complete();
    this.tasks$.complete();
    this.batchFinish$.complete();
  }

  public setScheduler(scheduler: BatchScheduler): void {
    if (this.stateSub$.value !== RCI_QUEUE_STATE.READY) {
      throw new QueueNotIdleError(this.stateSub$.value);
    }

    this.scheduler.destroy();
    this.scheduler = scheduler;
  }

  private provideDataToTasks(chunkedResponses: GenericObject[][], tasks: Task[]): void {
    tasks.forEach(({subject, isSingleQuery}, index) => {
      const taskData = isSingleQuery
        ? chunkedResponses[index]![0]!
        : chunkedResponses[index]!;

      subject.next(taskData);
      subject.complete();
    });
  }

  private provideErrorDataToTasks(error: unknown, tasks: Task[]): void {
    tasks.forEach(({subject}) => {
      subject.error(error);
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

          // Moving catchError to the outer pipe
          // will cancel the batch$ Observable if an error occurs
          return this.httpTransport.sendQueryArray(this.rciPath, queryArray)
            .pipe(
              timeout(RCI_QUERY_TIMEOUT),
              map((batchedResponse) => [batchedResponse, null]), // null is a placeholder for possible httpClientError
              catchError((httpClientError) => of([[], httpClientError])),
              map(([batchedResponse, httpClientError]) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return [batchedResponse, httpClientError, queryMap, tasks, sentAt];
              }),
            );
        }),
      )
      .subscribe((data) => {
        const [batchedResponse, httpClientError, queryMap, tasks, sentAt] = data;

        if (httpClientError) {
          this.provideErrorDataToTasks(httpClientError, tasks);
        } else {
          const chunkedResponses = RciPayloadHelper.splitResponsesPerTask(batchedResponse, tasks, queryMap);

          this.provideDataToTasks(chunkedResponses, tasks);
        }

        const durationMs = Date.now() - sentAt;

        try {
          this.statsCollector?.collect({
            queueName: this.queueName,
            taskCount: tasks.length,
            queryCount: tasks.reduce((sum, task) => sum + task.queries.length, 0),
            sentAt,
            durationMs,
            success: !httpClientError,
            error: httpClientError ?? undefined,
          });
        } catch {
          // stats collection must not affect queue flow
        }

        this.onResponseProcessingFinish();
      });
  }

  private prepareTask(query: RciTask, saveConfiguration: boolean): Task {
    const subject = new Subject<ObjectOrArray>();
    const isSingleQuery = !Array.isArray(query);
    const queriesList = isSingleQuery
      ? [query] as RciQuery[]
      : query as RciQuery[];

    if (saveConfiguration) {
      queriesList.push({path: SAVE_CONFIGURATION_QUERY, data: {}});
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

    this.currentBatchSub$ = new Subject<BatchInfo>();

    this.currentSchedulerSub = this.scheduler
      .scheduleBatch(this.currentBatchSub$.asObservable())
      .pipe(
        take(1),
        catchError((error) => {
          console.error('[RciQueue] Scheduler error, forcing batch flush:', error);
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
    this.currentBatch = [];

    this.scheduler.reset();
  }

  private onResponseProcessingFinish(): void {
    if (this.pendingTasksCount === 0) {
      this.setState(RCI_QUEUE_STATE.READY);
    } else {
      this.startBatch();
    }
  }
}
