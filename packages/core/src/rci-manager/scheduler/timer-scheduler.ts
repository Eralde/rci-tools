import {Observable, timer} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {BatchScheduler, BatchSnapshot} from './scheduler.types';

export class TimerScheduler<QueryPath extends string = string> implements BatchScheduler<QueryPath> {
  constructor(
    private readonly timeoutMs: number,
  ) {}

  public schedule(_batch$: Observable<BatchSnapshot<QueryPath>>): Observable<void> {
    return timer(this.timeoutMs)
      .pipe(
        take(1),
        map(() => undefined),
      );
  }
}
