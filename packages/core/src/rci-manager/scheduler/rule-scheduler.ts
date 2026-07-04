import type {Observable} from 'rxjs';
import {filter, map, take} from 'rxjs/operators';
import type {BatchScheduler} from './batch-scheduler';
import type {BatchSnapshot} from './batch-snapshot';

export type BatchRule<QueryPath extends string = string> =
  (snapshot: BatchSnapshot<QueryPath>) => boolean;

export class RuleScheduler<QueryPath extends string = string> implements BatchScheduler<QueryPath> {
  constructor(
    private readonly rules: readonly BatchRule<QueryPath>[],
  ) {}

  public schedule(batch$: Observable<BatchSnapshot<QueryPath>>): Observable<void> {
    return batch$.pipe(
      filter((snapshot) => this.rules.some((rule) => rule(snapshot))),
      map(() => undefined),
      take(1),
    );
  }
}
