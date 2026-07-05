import type {Observable} from 'rxjs';
import {merge, timer} from 'rxjs';
import {filter, map, take} from 'rxjs/operators';
import {BatchScheduler, BatchSnapshot} from './scheduler.types';

export type BatchRule<QueryPath extends string = string> = (
  batch$: Observable<BatchSnapshot<QueryPath>>,
) => Observable<unknown>;

export class RuleScheduler<QueryPath extends string = string> implements BatchScheduler<QueryPath> {
  constructor(
    private readonly rules: readonly BatchRule<QueryPath>[],
  ) {}

  public schedule(batch$: Observable<BatchSnapshot<QueryPath>>): Observable<void> {
    return merge(...this.rules.map((rule) => rule(batch$)))
      .pipe(
        take(1),
        map(() => undefined),
      );
  }
}

// --- Rule builders ---

export const when = <QueryPath extends string = string>(
  predicate: (snapshot: BatchSnapshot<QueryPath>) => boolean,
): BatchRule<QueryPath> => {
  return (batch$) => batch$.pipe(
    filter(predicate),
    take(1),
  );
};

export const after = <QueryPath extends string = string>(ms: number): BatchRule<QueryPath> => {
  return () => timer(ms).pipe(take(1));
};

export const queryCountAtLeast = <QueryPath extends string = string>(count: number): BatchRule<QueryPath> => {
  return when((s) => s.queryCount >= count);
};

export const pathIncluded = <QueryPath extends string = string>(path: QueryPath): BatchRule<QueryPath> => {
  return when((s) => s.queryPaths.includes(path));
};
