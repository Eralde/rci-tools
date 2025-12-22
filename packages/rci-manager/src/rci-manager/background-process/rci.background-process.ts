import {Observable, filter} from 'rxjs';
import type {GenericObject} from '../../type.utils';
import {RciBackgroundTask} from './rci.background-task';

export enum RCI_BACKGROUND_PROCESS_FINISH_REASON {
  DONE = 'DONE',
  ABORTED = 'ABORTED',
  TIMED_OUT = 'TIMED_OUT',
}

export class RciBackgroundProcess<CommandType extends string = string> {
  public readonly data$: Observable<GenericObject | null>;
  public readonly done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;

  constructor(
    protected readonly task: RciBackgroundTask<CommandType>,
  ) {
    this.data$ = task.responseSub$.asObservable().pipe(filter(Boolean));
    this.done$ = task.doneSub$.asObservable();
  }

  public abort(): void {
    this.task.abort();
  }
}
