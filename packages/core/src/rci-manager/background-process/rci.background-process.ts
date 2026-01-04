import {
  BehaviorSubject,
  NEVER,
  Observable,
  ReplaySubject,
  Subject,
  delayWhen,
  filter,
  map,
  of,
  race,
  repeat,
  skipWhile,
  switchMap,
  take,
  timer,
} from 'rxjs';
import type {GenericObject, ObjectOrArray} from '../../type.utils';
import {BaseHttpResponse, HttpTransport} from '../../transport';
import {RciQuery} from '../query';

export interface RciBackgroundProcessOptions {
  pollInterval?: number; // time between polling requests to check for updates
  timeout?: number; // timeout that will abort the background process
}

export const DEFAULT_BACKGROUND_PROCESS_OPTIONS: Required<RciBackgroundProcessOptions> = {
  pollInterval: 1000,
  timeout: 0,
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
  public readonly state$: Observable<RCI_BACKGROUND_PROCESS_STATE>;

  public readonly command: CommandType;
  public readonly data: RciQuery['data'];
  public readonly options: RciBackgroundProcessOptions;

  private readonly responseSub$ = new Subject<GenericObject | null>();
  private readonly doneSub$ = new Subject<RCI_BACKGROUND_PROCESS_FINISH_REASON>();
  private readonly abortSub$ = new ReplaySubject<void>(1);

  private readonly rciPath: string;
  private readonly httpTransport: HttpTransport<BaseHttpResponse>;

  private readonly stateSub$ = new BehaviorSubject<RCI_BACKGROUND_PROCESS_STATE>(RCI_BACKGROUND_PROCESS_STATE.INIT);
  private readonly startTrigger$: Subject<void> = new Subject<void>();

  constructor(
    command: CommandType,
    data: RciQuery['data'],
    options: RciBackgroundProcessOptions,
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
    this.state$ = this.stateSub$.asObservable();

    this.startTrigger$
      .pipe(
        filter(() =>
          this.stateSub$.value === RCI_BACKGROUND_PROCESS_STATE.INIT
          || this.stateSub$.value === RCI_BACKGROUND_PROCESS_STATE.QUEUED
        ),
        map(() => {
          this.stateSub$.next(RCI_BACKGROUND_PROCESS_STATE.RUNNING);

          return this;
        }),
      )
      .subscribe(() => {
        this.execute();
      });

    // subscribe to done$ to update state
    this.done$.subscribe((reason: RCI_BACKGROUND_PROCESS_FINISH_REASON) => {
      if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE) {
        this.stateSub$.next(RCI_BACKGROUND_PROCESS_STATE.COMPLETED);
      } else if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED) {
        this.stateSub$.next(RCI_BACKGROUND_PROCESS_STATE.ABORTED);
      } else if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT) {
        this.stateSub$.next(RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT);
      }
    });
  }

  public getState(): RCI_BACKGROUND_PROCESS_STATE {
    return this.stateSub$.value;
  }

  public start(): boolean {
    if (this.stateSub$.value !== RCI_BACKGROUND_PROCESS_STATE.INIT) {
      console.error(`Cannot start process: current state is ${this.stateSub$.value}`);

      return false;
    }

    this.startTrigger$.next();

    return true;
  }

  public abort(): boolean {
    if (this.stateSub$.value !== RCI_BACKGROUND_PROCESS_STATE.RUNNING) {
      console.error(`Cannot abort process: current state is ${this.stateSub$.value}`);

      return false;
    }

    this.stateSub$.next(RCI_BACKGROUND_PROCESS_STATE.ABORTING);

    this.abortSub$.next();
    this.abortSub$.complete();

    return true;
  }

  public setQueued(trigger: Observable<unknown>): boolean {
    if (this.stateSub$.value !== RCI_BACKGROUND_PROCESS_STATE.INIT) {
      console.error(`Cannot queue process: current state is ${this.stateSub$.value}`);

      return false;
    }

    this.stateSub$.next(RCI_BACKGROUND_PROCESS_STATE.QUEUED);

    trigger
      .pipe(
        take(1),
      )
      .subscribe(() => {
        this.startTrigger$.next();
      });

    return true;
  }

  protected markDone(): void {
    this.doneSub$.next(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
    this.doneSub$.complete();
  }

  protected execute(): void {
    const timeoutTrigger$ = this.options.timeout
      ? timer(this.options.timeout)
      : NEVER;

    const timeout$ = timeoutTrigger$.pipe(map(() => RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT));
    const abort$ = this.abortSub$.pipe(map(() => RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED));

    const task$ = this.executeTask(
      this.command,
      this.data,
    );

    const race$: Observable<GenericObject | RCI_BACKGROUND_PROCESS_FINISH_REASON> = race(task$, timeout$, abort$);

    race$.subscribe((result: GenericObject | RCI_BACKGROUND_PROCESS_FINISH_REASON) => {
      if (typeof result === 'string') {
        if (Object.values(RCI_BACKGROUND_PROCESS_FINISH_REASON).includes(result)) {
          this.responseSub$.next(null);
          this.doneSub$.next(result);
          this.doneSub$.complete();
        } else {
          this.markDone();
        }
      } else {
        this.responseSub$.next(result);
        this.markDone();
      }

      this.responseSub$.complete();
    });
  }

  protected executeTask(
    path: string,
    data: RciQuery['data'],
  ): Observable<GenericObject> {
    const pollInterval = Math.max(1, this.options.pollInterval ?? DEFAULT_BACKGROUND_PROCESS_OPTIONS.pollInterval);
    const url = `${this.rciPath}${path.replace(/\./g, '/')}`;

    const onDataUpdate: (data: GenericObject) => void = (data) => this.responseSub$.next(data);
    const isFinished = (response: BaseHttpResponse) => !response?.data?.['continued'];
    const getQuery = () => this.httpTransport.get(url);

    return this.httpTransport.post(url, data)
      .pipe(
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
              delayWhen((getResponse) => timer(isFinished(getResponse) ? 0 : pollInterval)),
              repeat(),
            );

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
