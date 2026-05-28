import {Subject} from 'rxjs';
import type {QueryStats} from './query-stats';

export class QueryStatsCollector {
  private readonly subject$ = new Subject<QueryStats>();
  private enabled = false;

  public readonly stats$ = this.subject$.asObservable();

  public collect(stats: QueryStats): void {
    if (this.enabled && !this.subject$.closed) {
      this.subject$.next(stats);
    }
  }

  public toggle(enabled: boolean): void {
    this.enabled = enabled;
  }

  public destroy(): void {
    if (!this.subject$.closed) {
      this.subject$.complete();
    }
  }
}
