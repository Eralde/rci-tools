import {BehaviorSubject, Subject, Subscription} from 'rxjs';
import type {Values} from '../../type.utils';
import {RciQuery} from '../query';
import {BaseHttpResponse, HttpTransport} from '../../transport';
import {
  DEFAULT_BACKGROUND_PROCESS_OPTIONS,
  RciBackgroundProcess,
  RciBackgroundProcessOptions,
} from './rci.background-process';

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
  protected currentProcess: RciBackgroundProcess<QueryPath> | null = null;
  protected readonly nextProcess$ = new Subject<QueuedProcess<QueryPath>>();
  protected readonly subscription = new Subscription();
  protected readonly stateSub$ = new BehaviorSubject<RciBackgroundTaskQueueState>(
    RCI_BACKGROUND_TASK_QUEUE_STATE.READY,
  );

  private isDestroyed = false;

  public readonly state$ = this.stateSub$.asObservable();

  constructor(
    public readonly rciPath: string,
    public readonly command: QueryPath,
    protected readonly httpTransport: HttpTransport<BaseHttpResponse>,
  ) {
    this.subscription.add(this.initializePendingTasksQueueSubscription());
  }

  public push(
    data: RciQuery['data'],
    options: RciBackgroundProcessOptions = DEFAULT_BACKGROUND_PROCESS_OPTIONS,
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
    } else {
      this.nextProcess$.next(queuedProcess);
    }

    return process;
  }

  protected initializePendingTasksQueueSubscription(): Subscription {
    return this.nextProcess$
      .subscribe((queuedProcess) => {
        this.currentProcess = queuedProcess.process;

        this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.AWAITING_RESPONSE);

        queuedProcess.trigger.next();
        queuedProcess.trigger.complete();

        const doneSub = queuedProcess.process.done$
          .subscribe(() => {
            this.currentProcess = null;

            this.stateSub$.next(RCI_BACKGROUND_TASK_QUEUE_STATE.READY);

            const head = this.queuedProcesses[0];

            if (head) {
              this.queuedProcesses = this.queuedProcesses.slice(1);

              this.nextProcess$.next(head);
            }
          });

        this.subscription.add(doneSub);
      });
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    this.subscription.unsubscribe();
    this.currentProcess?.destroy();
    this.queuedProcesses.forEach(({process, trigger}) => {
      process.destroy();
      trigger.complete();
    });
    this.queuedProcesses = [];
    this.nextProcess$.complete();
    this.stateSub$.complete();
  }
}
