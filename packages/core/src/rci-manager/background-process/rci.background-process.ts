import {Observable, filter, Subject, Subscription} from 'rxjs';
import type {GenericObject} from '../../type.utils';
import {RciBackgroundTask} from './rci.background-task';

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
  ABORTED = 'ABORTED',
  TIMED_OUT = 'TIMED_OUT',
}

export type RciBackgroundProcessStartExecutor = (process: RciBackgroundProcess<any>) => void;

export class RciBackgroundProcess<CommandType extends string = string> {
  public readonly data$: Observable<GenericObject | null>;
  public readonly done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;

  private state: RCI_BACKGROUND_PROCESS_STATE = RCI_BACKGROUND_PROCESS_STATE.INIT;
  private readonly startTrigger$: Subject<void> = new Subject<void>();
  private startSubscription?: Subscription;
  private readonly startExecutor: RciBackgroundProcessStartExecutor | undefined;

  constructor(
    protected readonly task: RciBackgroundTask<CommandType>,
    startExecutor?: RciBackgroundProcessStartExecutor,
  ) {
    this.data$ = task.responseSub$.asObservable().pipe(filter(Boolean));
    this.done$ = task.doneSub$.asObservable();

    this.startExecutor = startExecutor;

    // Subscribe to done$ to update state
    this.done$.subscribe((reason) => {
      if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.COMPLETED;
      } else if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.ABORTED) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.ABORTED;
      } else if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.TIMED_OUT) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.TIMED_OUT;
      }
    });

    // Subscribe to start trigger
    this.startSubscription = this.startTrigger$.subscribe(() => {
      if (this.startExecutor) {
        this.state = RCI_BACKGROUND_PROCESS_STATE.RUNNING;

        this.startExecutor(this);
      }
    });
  }

  public getState(): RCI_BACKGROUND_PROCESS_STATE {
    return this.state;
  }

  public start(): void {
    if (this.state !== RCI_BACKGROUND_PROCESS_STATE.INIT) {
      console.error(`Cannot start process: current state is ${this.state}, expected ${RCI_BACKGROUND_PROCESS_STATE.INIT}`);
      return;
    }

    this.startTrigger$.next();
  }

  public abort(): void {
    this.task.abort();
  }

  public setQueued(trigger: Subject<void>): void {
    if (this.state !== RCI_BACKGROUND_PROCESS_STATE.INIT) {
      console.error(`Cannot queue process: current state is ${this.state}, expected ${RCI_BACKGROUND_PROCESS_STATE.INIT}`);
      return;
    }

    this.state = RCI_BACKGROUND_PROCESS_STATE.QUEUED;

    // Unsubscribe from previous trigger and subscribe to queue trigger
    if (this.startSubscription) {
      this.startSubscription.unsubscribe();
    }

    this.startSubscription = trigger.subscribe(() => {
      this.startTrigger$.next();
    });
  }

  public getTask(): RciBackgroundTask<CommandType> {
    return this.task;
  }
}
