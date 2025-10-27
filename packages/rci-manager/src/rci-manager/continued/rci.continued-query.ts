import {filter, Observable} from 'rxjs';
import type {GenericObject} from '../../type.utils';
import {RCI_CONTINUED_QUERY_FINISH_REASON} from './rci.continued-query.types';
import {RciContinuedTask} from './rci.continued-task';

export class RciContinuedQuery<CommandType extends string = string> {
  public readonly data$: Observable<GenericObject | null>;
  public readonly done$: Observable<RCI_CONTINUED_QUERY_FINISH_REASON>;

  constructor(
    protected readonly task: RciContinuedTask<CommandType>,
  ) {
    this.data$ = task.responseSub$.asObservable().pipe(filter(Boolean));
    this.done$ = task.doneSub$.asObservable();
  }

  public abort(): void {
    this.task.abort();
  }
}
