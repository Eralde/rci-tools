import type {Observable} from 'rxjs';
import {race} from 'rxjs';
import {BatchScheduler, BatchSnapshot} from './scheduler.types';

class CompositeRaceScheduler<QueryPath extends string = string> implements BatchScheduler<QueryPath> {
  constructor(
    private readonly schedulers: readonly BatchScheduler<QueryPath>[],
  ) {}

  public schedule(batch$: Observable<BatchSnapshot<QueryPath>>): Observable<void> {
    return race(...this.schedulers.map((scheduler) => scheduler.schedule(batch$)));
  }
}

export const raceSchedulers = <QueryPath extends string = string>(
  first: BatchScheduler<QueryPath>,
  ...rest: readonly BatchScheduler<QueryPath>[]
): BatchScheduler<QueryPath> => {
  return new CompositeRaceScheduler([first, ...rest]);
};
