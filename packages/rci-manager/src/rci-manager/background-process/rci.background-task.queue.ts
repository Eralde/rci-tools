import {
  BehaviorSubject,
  NEVER,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  delayWhen,
  map,
  merge,
  of,
  race,
  repeat,
  skipWhile,
  switchMap,
  take,
  timer,
} from 'rxjs';
import type {GenericObject, ObjectOrArray, Values} from '../../type.utils';
import {RciQuery} from '../query';
import {BaseHttpResponse, HttpTransport} from '../../transport';
import {BackgroundTaskOptions, GenericResponse} from '../rci.manager.types';
import type {RciBackgroundTaskOptions} from './rci.background-task';
import {DEFAULT_BACKGROUND_TASK_OPTIONS, RciBackgroundTask} from './rci.background-task';
import {RCI_BACKGROUND_PROCESS_FINISH_REASON, RciBackgroundProcess} from './rci.background-process';

export const RCI_BACKGROUND_TASK_QUEUE_STATE = {
  // the queue is ready to process tasks
  READY: 'READY',

  // the queue has sent an HTTP query and is awaiting response
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
} as const;

export type RciBackgroundTaskQueueState = Values<typeof RCI_BACKGROUND_TASK_QUEUE_STATE>;

export const DEFAULT_QUEUE_BACKGROUND_TASK_OPTIONS: BackgroundTaskOptions = {
  timeout: 1000,
  skipPostQuery: false,
  isInfinite: false,
  onDataUpdate: () => {},
};

export class RciBackgroundTaskQueue<QueryPath extends string = string> {
  protected tasks: RciBackgroundTask<QueryPath>[] = [];
  protected readonly pendingQueries$: ReplaySubject<RciQuery<QueryPath>[]> = new ReplaySubject<RciQuery<QueryPath>[]>(
    1,
  );
  protected readonly nextTask$: Subject<RciBackgroundTask> = new Subject<RciBackgroundTask>();
  protected readonly stateSub$: BehaviorSubject<RciBackgroundTaskQueueState> = new BehaviorSubject<
    RciBackgroundTaskQueueState
  >(
    RCI_BACKGROUND_TASK_QUEUE_STATE.READY,
  );

  public readonly state$ = this.stateSub$.asObservable();

  constructor(
    public readonly rciPath: string,
    public readonly command: QueryPath,
    protected readonly httpTransport: HttpTransport<BaseHttpResponse>,
  ) {
    this.initializePendingTasksQueueSubscription();
  }

  public push(
    data: GenericObject,
    options: RciBackgroundTaskOptions = DEFAULT_BACKGROUND_TASK_OPTIONS,
  ): RciBackgroundProcess {
    const task = new RciBackgroundTask(this.command, data, options);

    return this.addTask(task);
  }

  protected addTask(task: RciBackgroundTask<QueryPath>): RciBackgroundProcess<QueryPath> {
    if (this.stateSub$.value === RCI_BACKGROUND_TASK_QUEUE_STATE.AWAITING_RESPONSE) {
      this.tasks.push(task);
      this.updatePendingQueries();
    } else {
      this.nextTask$.next(task);
    }

    return new RciBackgroundProcess(task);
  }

  protected updatePendingQueries(): void {
    const pendingQueries = this.tasks
      .map((item) => {
        return {
          path: item.command,
          data: item.data,
        };
      });

    this.pendingQueries$.next(pendingQueries);
  }

  protected initializePendingTasksQueueSubscription(): Subscription {
    return this.nextTask$
      .pipe(
        switchMap((task) => {
          this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.AWAITING_RESPONSE);

          const {command, data, options} = task;

          // Condition for optional abort of an ongoing task
          const cancelTrigger$ = options.duration
            ? timer(options.duration)
            : NEVER;

          const cancel$ = cancelTrigger$.pipe(map(() => RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT));
          const abort$ = task.abortSub$.pipe(map(() => RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED));

          const query: RciQuery = {path: command, data};
          const task$ = this.executeNextTask(
            query,
            {
              onDataUpdate: (data) => task.responseSub$.next(data),
            },
          ) as Observable<GenericObject>;

          const race$: Observable<GenericObject | RCI_BACKGROUND_PROCESS_FINISH_REASON> = race(task$, cancel$, abort$);

          return race$
            .pipe(
              map((result) => {
                return {
                  result,
                  task,
                };
              }),
            );
        }),
      )
      .subscribe(({result, task}) => {
        this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.READY);

        if (typeof result === 'string') {
          if (Object.values(RCI_BACKGROUND_PROCESS_FINISH_REASON).includes(result)) {
            task.responseSub$.next(null);
            task.doneSub$.next(result as RCI_BACKGROUND_PROCESS_FINISH_REASON);
            task.doneSub$.complete();
          } else {
            // task.responseSub$.next(result);
            task.markDone();
          }
        } else {
          task.responseSub$.next(result as GenericObject);
          task.markDone();
        }

        task.responseSub$.complete();

        const head = this.tasks?.[0];

        if (head) {
          this.tasks = this.tasks.slice(1);

          this.nextTask$.next(head);
          this.updatePendingQueries();
        }
      });
  }

  protected executeNextTask(
    query: RciQuery,
    options: BackgroundTaskOptions = {},
  ): GenericResponse {
    const _options = {
      ...DEFAULT_QUEUE_BACKGROUND_TASK_OPTIONS,
      ...options,
    };

    const queryTimeout = Math.max(1, _options.timeout ?? 0);
    const {path, data = {}} = query;
    const url = `${this.rciPath}${path.replace(/\./g, '/')}`;
    const onDataUpdate = _options.onDataUpdate ?? (() => {});

    const isFinished = (response: BaseHttpResponse) => !response?.data?.['continued'];

    const postQuery = () => this.httpTransport.post(url, data);
    const getQuery = () => this.httpTransport.get(url);

    const initialQuery = _options.skipPostQuery
      ? getQuery()
      : postQuery();

    return initialQuery.pipe(
      switchMap((response) => {
        if (isFinished(response)) {
          return of(response.data as ObjectOrArray);
        }

        const queryPipe$ = of(null)
          .pipe(
            switchMap(() => getQuery()),
            map((getResponse) => {
              onDataUpdate(getResponse.data);

              return getResponse;
            }),
            delayWhen((getResponse) => timer(isFinished(getResponse) ? 0 : queryTimeout)),
            repeat(),
          );

        if (_options.isInfinite) {
          return merge(
            of(response.data as ObjectOrArray),
            queryPipe$.pipe(map((currentResponse) => currentResponse.data as ObjectOrArray)),
          );
        }

        onDataUpdate(response.data);

        return queryPipe$
          .pipe(
            skipWhile((getResponse) => !isFinished(getResponse)),
            map((finalResponse) => finalResponse.data as ObjectOrArray),
            take(1),
          );
      }),
    );
  }
}
