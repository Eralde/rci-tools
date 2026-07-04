import {Observable, timer} from 'rxjs';
import {map, take} from 'rxjs/operators';
import type {BatchScheduler} from './batch-scheduler';
import type {BatchSnapshot} from './batch-snapshot';

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
