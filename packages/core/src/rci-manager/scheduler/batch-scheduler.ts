import type {Observable} from 'rxjs';
import type {BatchInfo} from './batch-info';

export interface BatchScheduler {
  scheduleBatch(batch$: Observable<BatchInfo>): Observable<void>;
  reset(): void;
  destroy(): void;
}
