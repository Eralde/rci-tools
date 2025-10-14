import {ReplaySubject, Subject} from 'rxjs';
import type {GenericObject} from '../../type.utils';
import {RCI_CONTINUED_QUERY_FINISH_REASON} from './rci.continued-query.types';

export interface RciContinuedTaskOptions {
  duration?: number;
}

export const DEFAULT_CONTINUED_TASK_OPTIONS: RciContinuedTaskOptions = {duration: 0};

export class RciContinuedTask {
  public readonly responseSub$: Subject<GenericObject | null> = new Subject<GenericObject | null>();
  public readonly doneSub$: Subject<RCI_CONTINUED_QUERY_FINISH_REASON> = new Subject<
    RCI_CONTINUED_QUERY_FINISH_REASON
  >();
  public readonly abortSub$: ReplaySubject<void> = new ReplaySubject<void>(1);

  constructor(
    public readonly command: string,
    public readonly data: GenericObject,
    public readonly options: RciContinuedTaskOptions,
  ) {
  }

  public markDone(): void {
    this.doneSub$.next(RCI_CONTINUED_QUERY_FINISH_REASON.DONE);
    this.doneSub$.complete();
  }

  public abort(): void {
    this.abortSub$.next();
    this.abortSub$.complete();
  }
}
