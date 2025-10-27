import {
  BehaviorSubject,
  delayWhen,
  map,
  merge,
  NEVER,
  Observable,
  of,
  race,
  repeat,
  ReplaySubject,
  skipWhile,
  Subject,
  Subscription,
  switchMap,
  take,
  timer,
} from 'rxjs';
import * as _ from 'lodash';
import type {GenericObject, ObjectOrArray, Values} from '../../type.utils';
import {RciQuery} from '../query';
import {BaseHttpResponse, HttpTransport} from '../../transport';
import type {ExecuteContinuedOptions, GenericResponse$} from '../rci.manager.types';
import {DEFAULT_EXECUTE_CONTINUED_OPTIONS} from '../rci.manager.constants';
import {DEFAULT_CONTINUED_TASK_OPTIONS, RciContinuedTask} from './rci.continued-task';
import type {RciContinuedTaskOptions} from './rci.continued-task';
import {RciContinuedQuery} from './rci.continued-query';
import {RCI_CONTINUED_QUERY_FINISH_REASON} from './rci.continued-query.types';

export const RCI_CONTINUED_QUEUE_STATE = {
  // the queue is ready to process tasks
  READY: 'READY',

  // the queue has sent an HTTP query and is awaiting response
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
} as const;

export type RciContinuedQueueState = Values<typeof RCI_CONTINUED_QUEUE_STATE>;

export class RciContinuedQueue<QueryPath extends string = string> {
  protected tasks: RciContinuedTask<QueryPath>[] = [];
  protected readonly pendingQueries$: ReplaySubject<RciQuery<QueryPath>[]> = new ReplaySubject<RciQuery<QueryPath>[]>(1);
  protected readonly nextQuery$: Subject<RciContinuedTask> = new Subject<RciContinuedTask>();
  protected readonly stateSub$: BehaviorSubject<RciContinuedQueueState> = new BehaviorSubject<RciContinuedQueueState>(
    RCI_CONTINUED_QUEUE_STATE.READY,
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
    options: RciContinuedTaskOptions = DEFAULT_CONTINUED_TASK_OPTIONS,
  ): RciContinuedQuery {
    const task = new RciContinuedTask(this.command, data, options);

    return this.addTask(task);
  }

  protected addTask(task: RciContinuedTask<QueryPath>): RciContinuedQuery<QueryPath> {
    if (this.stateSub$.value === RCI_CONTINUED_QUEUE_STATE.AWAITING_RESPONSE) {
      this.tasks.push(task);
      this.updatePendingQueries();
    } else {
      this.nextQuery$.next(task);
    }

    return new RciContinuedQuery(task);
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
    return this.nextQuery$
      .pipe(
        switchMap((task) => {
          this.stateSub$.next(RCI_CONTINUED_QUEUE_STATE.AWAITING_RESPONSE);

          const {command, data, options} = task;

          // Condition for optional abort of an ongoing task
          const cancelTrigger$ = options.duration
            ? timer(options.duration)
            : NEVER;

          const cancel$ = cancelTrigger$.pipe(map(() => RCI_CONTINUED_QUERY_FINISH_REASON.TIMED_OUT));
          const abort$ = task.abortSub$.pipe(map(() => RCI_CONTINUED_QUERY_FINISH_REASON.ABORTED));

          const query: RciQuery = {path: command, data};
          const task$ = this.executeContinued(
            query,
            {
              onDataUpdate: (data) => task.responseSub$.next(data),
            },
          ) as Observable<GenericObject>;

          const race$: Observable<GenericObject | RCI_CONTINUED_QUERY_FINISH_REASON> = race(task$, cancel$, abort$);

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
        this.stateSub$.next(RCI_CONTINUED_QUEUE_STATE.READY);

        if (_.isString(result)) {
          if (Object.values(RCI_CONTINUED_QUERY_FINISH_REASON).includes(result as RCI_CONTINUED_QUERY_FINISH_REASON)) {
            task.responseSub$.next(null);
            task.doneSub$.next(result as RCI_CONTINUED_QUERY_FINISH_REASON);
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

          this.nextQuery$.next(head);
          this.updatePendingQueries();
        }
      });
  }

  protected executeContinued(
    query: RciQuery,
    options: ExecuteContinuedOptions = {},
  ): GenericResponse$ {
    const _options = {
      ...DEFAULT_EXECUTE_CONTINUED_OPTIONS,
      ...options,
    };

    const queryTimeout = Math.max(1, _options.timeout ?? 0);
    const {path, data = {}} = query;
    const url = `${this.rciPath}${path.replace(/\./g, '/')}`;
    const onDataUpdate = _options.onDataUpdate ?? (() => {});

    const isNotContinued = (response: BaseHttpResponse) => !response?.data?.['continued'];

    const postQuery = () => this.httpTransport.post(url, data);
    const getQuery = () => this.httpTransport.get(url);

    const initialQuery = _options.skipPostQuery
      ? getQuery()
      : postQuery();

    return initialQuery.pipe(
      switchMap((response) => {
        if (isNotContinued(response)) {
          return of(response.data as ObjectOrArray);
        }

        const queryPipe$ = of(null)
          .pipe(
            switchMap(() => getQuery()),
            map((getResponse) => {
              onDataUpdate(getResponse.data);

              return getResponse;
            }),
            delayWhen((getResponse) => timer(isNotContinued(getResponse) ? 0 : queryTimeout)),
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
            skipWhile((getResponse) => !isNotContinued(getResponse)),
            map((finalResponse) => finalResponse.data as ObjectOrArray),
            take(1),
          );
      }),
    );
  }
}
