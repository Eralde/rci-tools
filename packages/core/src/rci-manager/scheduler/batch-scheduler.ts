import type {Observable} from 'rxjs';
import type {BatchSnapshot} from './batch-snapshot';

export interface BatchScheduler<QueryPath extends string = string> {
  schedule(batch$: Observable<BatchSnapshot<QueryPath>>): Observable<void>;
}
