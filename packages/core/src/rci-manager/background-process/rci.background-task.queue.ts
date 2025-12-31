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
  takeUntil,
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

interface QueuedProcess<QueryPath extends string = string> {
  process: RciBackgroundProcess<QueryPath>;
  trigger: Subject<void>;
  task: RciBackgroundTask<QueryPath>;
}

export class RciBackgroundTaskQueue<QueryPath extends string = string> {
  protected queuedProcesses: QueuedProcess<QueryPath>[] = [];
  protected readonly pendingQueries$: ReplaySubject<RciQuery<QueryPath>[]> = new ReplaySubject<RciQuery<QueryPath>[]>(
    1,
  );
  protected readonly nextProcess$: Subject<QueuedProcess<QueryPath>> = new Subject<QueuedProcess<QueryPath>>();
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
  ): RciBackgroundProcess<QueryPath> {
    const task = new RciBackgroundTask(this.command, data, options);
    const trigger = new Subject<void>();

    const process = new RciBackgroundProcess(task);

    process.setQueued(trigger);

    // subscribe to start$ to execute the process when it starts
    process.start$
      .pipe(takeUntil(process.done$))
      .subscribe((processInstance) => {
        this.executeProcess(processInstance);
      });

    const queuedProcess: QueuedProcess<QueryPath> = {
      process,
      trigger,
      task,
    };

    if (this.stateSub$.value === RCI_BACKGROUND_TASK_QUEUE_STATE.AWAITING_RESPONSE) {
      this.queuedProcesses.push(queuedProcess);
      this.updatePendingQueries();
    } else {
      this.nextProcess$.next(queuedProcess);
    }

    return process;
  }

  protected updatePendingQueries(): void {
    const pendingQueries = this.queuedProcesses
      .map((item) => {
        return {
          path: item.task.command,
          data: item.task.data,
        };
      });

    this.pendingQueries$.next(pendingQueries);
  }

  protected initializePendingTasksQueueSubscription(): Subscription {
    return this.nextProcess$
      .subscribe((queuedProcess) => {
        this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.AWAITING_RESPONSE);

        // Fire the trigger to start the process.
        // The process will call executeProcess via its startExecutor
        queuedProcess.trigger.next();
        queuedProcess.trigger.complete();

        // Wait for the process to complete, then start the next one
        queuedProcess.process.done$.subscribe(() => {
          this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.READY);

          const head = this.queuedProcesses?.[0];

          if (head) {
            this.queuedProcesses = this.queuedProcesses.slice(1);

            this.nextProcess$.next(head);
            this.updatePendingQueries();
          }
        });
      });
  }

  public executeProcess(process: RciBackgroundProcess<QueryPath>): void {
    const task = process.getTask();
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

    race$.subscribe((result) => {
      if (typeof result === 'string') {
        if (Object.values(RCI_BACKGROUND_PROCESS_FINISH_REASON).includes(result)) {
          task.responseSub$.next(null);
          task.doneSub$.next(result as RCI_BACKGROUND_PROCESS_FINISH_REASON);
          task.doneSub$.complete();
        } else {
          task.markDone();
        }
      } else {
        task.responseSub$.next(result as GenericObject);
        task.markDone();
      }

      task.responseSub$.complete();
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
