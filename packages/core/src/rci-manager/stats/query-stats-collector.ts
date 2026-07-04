import {Subject} from 'rxjs';
import type {QueryStats} from './query-stats';

export class QueryStatsCollector {
  private readonly subject$ = new Subject<QueryStats>();
  private isEnabled = false;

  public readonly stats$ = this.subject$.asObservable();

  public collect(stats: QueryStats): void {
    if (this.isEnabled && !this.subject$.closed) {
      this.subject$.next(stats);
    }
  }

  public toggle(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
  }

  public destroy(): void {
    if (!this.subject$.closed) {
      this.subject$.complete();
    }
  }
}
