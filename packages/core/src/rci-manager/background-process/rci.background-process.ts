import {
  NEVER,
  Observable,
  ReplaySubject,
  delayWhen,
  filter,
  map,
  merge,
  of,
  race,
  repeat,
  skipWhile,
  Subject,
  Subscription,
  switchMap,
  take,
  timer,
} from 'rxjs';
import type {GenericObject, ObjectOrArray} from '../../type.utils';
import {BaseHttpResponse, HttpTransport} from '../../transport';
import {BackgroundTaskOptions} from '../rci.manager.types';
import {RciQuery} from '../query';

export interface RciBackgroundTaskOptions {
  duration?: number;
}

export const DEFAULT_BACKGROUND_TASK_OPTIONS: RciBackgroundTaskOptions = {duration: 0};

export const DEFAULT_BACKGROUND_TASK_EXECUTION_OPTIONS: BackgroundTaskOptions = {
  timeout: 1000,
  skipPostQuery: false,
  isInfinite: false,
  onDataUpdate: () => {},
};

export enum RCI_BACKGROUND_PROCESS_FINISH_REASON {
  DONE = 'DONE',
  ABORTED = 'ABORTED',
  TIMED_OUT = 'TIMED_OUT',
}

export enum RCI_BACKGROUND_PROCESS_STATE {
  INIT = 'INIT',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ABORTING = 'ABORTING',
  ABORTED = 'ABORTED',
  TIMED_OUT = 'TIMED_OUT',
}

export class RciBackgroundProcess<CommandType extends string = string> {
  public readonly data$: Observable<GenericObject | null>;
  public readonly done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;
  public readonly start$: Observable<this>;

  public readonly command: CommandType;
  public readonly data: RciQuery['data'];
  public readonly options: RciBackgroundTaskOptions;

  public readonly responseSub$: Subject<GenericObject | null> = new Subject<GenericObject | null>();
  public readonly doneSub$: Subject<RCI_BACKGROUND_PROCESS_FINISH_REASON> = new Subject<
    RCI_BACKGROUND_PROCESS_FINISH_REASON
  >();
  public readonly abortSub$: ReplaySubject<void> = new ReplaySubject<void>(1);

  protected readonly rciPath: string;
  protected readonly httpTransport: HttpTransport<BaseHttpResponse>;

  private state: RCI_BACKGROUND_PROCESS_STATE = RCI_BACKGROUND_PROCESS_STATE.INIT;
  private readonly startTrigger$: Subject<void> = new Subject<void>();
  private startSubscription?: Subscription;

  constructor(
    command: CommandType,
    data: RciQuery['data'],
    options: RciBackgroundTaskOptions,
    rciPath: string,
    httpTransport: HttpTransport<BaseHttpResponse>,
  ) {
    this.command = command;
    this.data = data;
    this.options = options;
    this.rciPath = rciPath;
    this.httpTransport = httpTransport;

    this.data$ = this.responseSub$.asObservable().pipe(filter(Boolean));
    this.done$ = this.doneSub$.asObservable();
    this.start$ = this.startTrigger$
      .pipe(
        filter(() => this.state === RCI_BACKGROUND_PROCESS_STATE.INIT || this.state === RCI_BACKGROUND_PROCESS_STATE.QUEUED),
        map(() => {
          this.state = RCI_BACKGROUND_PROCESS_STATE.RUNNING;

          return this;
        }),
      );

    // subscribe to start$ to execute HTTP requests when process starts
    this.start$
      .subscribe(() => {
        this.execute();
      });

    // subscribe to done$ to update state
    this.done$.subscribe((reason: RCI_BACKGROUND_PROCESS_FINISH_REASON) => {
      if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.COMPLETED;
      } else if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.ABORTED;
      } else if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT;
      }
    });
  }

  public getState(): RCI_BACKGROUND_PROCESS_STATE {
    return this.state;
  }

  public start(): boolean {
    if (this.state !== RCI_BACKGROUND_PROCESS_STATE.INIT) {
      console.error(`Cannot start process: current state is ${this.state}`);

      return false;
    }

    this.startTrigger$.next();

    return true;
  }

  public abort(): boolean {
    if (this.state !== RCI_BACKGROUND_PROCESS_STATE.RUNNING) {
      console.error(`Cannot abort process: current state is ${this.state}`);

      return false;
    }

    this.state = RCI_BACKGROUND_PROCESS_STATE.ABORTING;

    this.abortSub$.next();
    this.abortSub$.complete();

    return true;
  }

  public setQueued(trigger: Subject<void>): void {
    if (this.state !== RCI_BACKGROUND_PROCESS_STATE.INIT) {
      console.error(`Cannot queue process: current state is ${this.state}`);

      return;
    }

    this.state = RCI_BACKGROUND_PROCESS_STATE.QUEUED;

    // unsubscribe from previous trigger and subscribe to queue trigger
    if (this.startSubscription) {
      this.startSubscription.unsubscribe();
    }

    this.startSubscription = trigger.subscribe(() => {
      this.startTrigger$.next();
    });
  }

  protected markDone(): void {
    this.doneSub$.next(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
    this.doneSub$.complete();
  }

  protected execute(): void {
    // Condition for optional abort of an ongoing task
    const cancelTrigger$ = this.options.duration
      ? timer(this.options.duration)
      : NEVER;

    const cancel$ = cancelTrigger$.pipe(map(() => RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT));
    const abort$ = this.abortSub$.pipe(map(() => RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED));

    const task$ = this.executeTask(
      this.command,
      this.data,
      {
        timeout: 1000, // default timeout
        skipPostQuery: false,
        isInfinite: false,
        onDataUpdate: (data) => this.responseSub$.next(data),
      },
    );

    const race$: Observable<GenericObject | RCI_BACKGROUND_PROCESS_FINISH_REASON> = race(task$, cancel$, abort$);

    race$.subscribe((result) => {
      if (typeof result === 'string') {
        if (Object.values(RCI_BACKGROUND_PROCESS_FINISH_REASON).includes(result)) {
          this.responseSub$.next(null);
          this.doneSub$.next(result as RCI_BACKGROUND_PROCESS_FINISH_REASON);
          this.doneSub$.complete();
        } else {
          this.markDone();
        }
      } else {
        this.responseSub$.next(result as GenericObject);
        this.markDone();
      }

      this.responseSub$.complete();
    });
  }

  protected executeTask(
    path: string,
    data: RciQuery['data'],
    options: BackgroundTaskOptions = {},
  ): Observable<GenericObject> {
    const _options = {
      ...DEFAULT_BACKGROUND_TASK_EXECUTION_OPTIONS,
      ...options,
    };

    const queryTimeout = Math.max(1, _options.timeout ?? 0);
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
    ) as Observable<GenericObject>;
  }
}
