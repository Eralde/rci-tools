import {BehaviorSubject, Observable, Subject, Subscription, of, race, timer} from 'rxjs';
import {buffer, catchError, exhaustMap, filter, map, switchMap, take, takeUntil, timeout} from 'rxjs/operators';
import {RciTaskHelper} from '../task';
import type {Task} from '../task';
import type {BaseHttpResponse, HttpTransport} from '../../transport';
import type {GenericObject, ObjectOrArray} from '../../type.utils';
import type {GenericResponse$} from '../rci.manager.types';
import {RciQuery, RciTask} from '../query';
import {RCI_QUEUE_STATE} from './rci.queue.types';
import type {RciQueueOptions, RciQueueState} from './rci.queue.types';
import {RCI_QUEUE_DEFAULT_OPTIONS, RCI_QUEUE_HTTP_TIMEOUT, SAVE_CONFIGURATION_QUERY} from './rci.queue.constants';

export class RciQueue<ResponseType extends BaseHttpResponse> {
  private readonly stateSub$: BehaviorSubject<RciQueueState> = new BehaviorSubject<RciQueueState>(
    RCI_QUEUE_STATE.READY,
  );

  public readonly state$ = this.stateSub$.asObservable();

  public readonly isBusy$ = this.state$
    .pipe(
      map((state) => {
        return [RCI_QUEUE_STATE.AWAITING_RESPONSE, RCI_QUEUE_STATE.PENDING].includes(state);
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
  private pendingTasksCount = 0;
  private batchTimeout: number;

  constructor(
    private rciPath: string,
    private httpTransport: HttpTransport<ResponseType>,
    private options: Partial<RciQueueOptions<ResponseType>> = {},
  ) {
    const _options = {
      ...RCI_QUEUE_DEFAULT_OPTIONS,
      ...this.options,
    };

    this.batchTimeout = _options.batchTimeout;
    this.blockerQueue = _options.blockerQueue;

    this.initializeBatchSubscription();
  }

  public static createImpossibleApiResponse(): ObjectOrArray {
    return [[]]; // `[[]]` is a valid JSON, but this particular JSON is never returned by the RCI API
  }

  public static isImpossibleApiResponse(obj: ObjectOrArray): boolean {
    return Array.isArray(obj)
      && Array.isArray(obj?.[0])
      && obj?.[0].length === 0;
  }

  public addTask(query: RciTask, saveConfiguration: boolean = false): GenericResponse$ {
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

  private processTask(query: RciTask, saveConfiguration: boolean = false): GenericResponse$ {
    // Outer Observable is required to avoid adding a new task
    // until returned Observable is actually subscribed to
    return of(true)
      .pipe(
        exhaustMap(() => {
          const task = this.prepareTask(query, saveConfiguration);

          if (this.stateSub$.value === RCI_QUEUE_STATE.READY) {
            this.startBatch();
          }

          this.tasks$.next(task);
          this.pendingTasksCount++;

          return task.subject.asObservable();
        }),
      );
  }

  private setState(state: RciQueueState): void {
    this.stateSub$.next(state);
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
          } = RciTaskHelper.mergeTaskQueries(tasks);

          // Moving catchError to the outer pipe
          // will cancel the batch$ Observable if an error occurs
          return this.httpTransport.sendQueryArray(this.rciPath, queryArray)
            .pipe(
              timeout(RCI_QUEUE_HTTP_TIMEOUT),
              map((batchedResponse) => [batchedResponse, null]), // null is a placeholder for possible httpClientError
              catchError((httpClientError) => of([[], httpClientError])),
              map(([batchedResponse, httpClientError]) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return [batchedResponse, httpClientError, queryMap, tasks];
              }),
            );
        }),
      )
      .subscribe((data) => {
        const [batchedResponse, httpClientError, queryMap, tasks] = data;

        if (httpClientError) {
          this.provideErrorDataToTasks(httpClientError, tasks);
        } else {
          const chunkedResponses = RciTaskHelper.splitResponses(batchedResponse, tasks, queryMap);

          this.provideDataToTasks(chunkedResponses, tasks);
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
        extractDataByPath: query?.extractDataByPath ?? true,
      };
    });

    return {queries, subject, isSingleQuery};
  }

  private startBatch(): void {
    this.setState(RCI_QUEUE_STATE.BATCHING_TASKS);

    timer(this.batchTimeout)
      .pipe(take(1))
      .subscribe(() => this.batchFinish$.next());
  }

  private onResponseProcessingFinish(): void {
    if (this.pendingTasksCount === 0) {
      this.setState(RCI_QUEUE_STATE.READY);
    } else {
      this.startBatch();
    }
  }
}
