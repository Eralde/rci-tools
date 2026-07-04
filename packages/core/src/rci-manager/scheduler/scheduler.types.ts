import type {Observable} from 'rxjs';

export interface BatchSnapshot<QueryPath extends string = string> {
  readonly taskCount: number;
  readonly queryCount: number;
  readonly createdAt: number;
  readonly elapsedMs: number;
  readonly queryPaths: readonly QueryPath[];
}

export interface BatchScheduler<QueryPath extends string = string> {
  schedule(batch$: Observable<BatchSnapshot<QueryPath>>): Observable<void>;
}
