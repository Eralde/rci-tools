import {ReplaySubject, Subject} from 'rxjs';
import type {GenericObject} from '../../type.utils';
import {RCI_BACKGROUND_PROCESS_FINISH_REASON} from './rci.background-process';

export interface RciBackgroundTaskOptions {
  duration?: number;
}

export const DEFAULT_BACKGROUND_TASK_OPTIONS: RciBackgroundTaskOptions = {duration: 0};

export class RciBackgroundTask<CommandType extends string = string> {
  public readonly responseSub$: Subject<GenericObject | null> = new Subject<GenericObject | null>();
  public readonly doneSub$: Subject<RCI_BACKGROUND_PROCESS_FINISH_REASON> = new Subject<
    RCI_BACKGROUND_PROCESS_FINISH_REASON
  >();
  public readonly abortSub$: ReplaySubject<void> = new ReplaySubject<void>(1);

  constructor(
    public readonly command: CommandType,
    public readonly data: GenericObject,
    public readonly options: RciBackgroundTaskOptions,
  ) {
  }

  public markDone(): void {
    this.doneSub$.next(RCI_BACKGROUND_PROCESS_FINISH_REASON.DONE);
    this.doneSub$.complete();
  }

  public abort(): void {
    this.abortSub$.next();
    this.abortSub$.complete();
  }
}
