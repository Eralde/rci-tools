import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  Subscription,
} from 'rxjs';
import type {Values} from '../../type.utils';
import {RciQuery} from '../query';
import {BaseHttpResponse, HttpTransport} from '../../transport';
import {RciBackgroundProcess, RciBackgroundTaskOptions, DEFAULT_BACKGROUND_TASK_OPTIONS} from './rci.background-process';

export const RCI_BACKGROUND_TASK_QUEUE_STATE = {
  // the queue is ready to process tasks
  READY: 'READY',

  // the queue has sent an HTTP query and is awaiting response
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
} as const;

export type RciBackgroundTaskQueueState = Values<typeof RCI_BACKGROUND_TASK_QUEUE_STATE>;


interface QueuedProcess<QueryPath extends string = string> {
  process: RciBackgroundProcess<QueryPath>;
  trigger: Subject<void>;
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
    data: RciQuery['data'],
    options: RciBackgroundTaskOptions = DEFAULT_BACKGROUND_TASK_OPTIONS,
  ): RciBackgroundProcess<QueryPath> {
    const trigger = new Subject<void>();

    const process = new RciBackgroundProcess(
      this.command,
      data,
      options,
      this.rciPath,
      this.httpTransport,
    );

    process.setQueued(trigger);

    const queuedProcess: QueuedProcess<QueryPath> = {
      process,
      trigger,
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
    const pendingQueries: Array<RciQuery<QueryPath>> = this.queuedProcesses
      .map((item) => {
        return {
          path: this.command,
          data: item.process.data || {},
        };
      });

    this.pendingQueries$.next(pendingQueries);
  }

  protected initializePendingTasksQueueSubscription(): Subscription {
    return this.nextProcess$
      .subscribe((queuedProcess) => {
        this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.AWAITING_RESPONSE);

        // Fire the trigger to start the process.
        // The process will execute HTTP requests itself when it receives the trigger
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

}
