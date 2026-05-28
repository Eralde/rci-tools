import {Observable} from 'rxjs';
import {filter, map, take} from 'rxjs/operators';
import type {BatchInfo} from './batch-info';
import type {BatchScheduler} from './batch-scheduler';

export type ConfigurableSchedulerRule = (batchInfo: BatchInfo) => boolean;
export type ConfigurableSchedulerRules = readonly ConfigurableSchedulerRule[];

export class ConfigurableScheduler implements BatchScheduler {
  constructor(
    protected readonly rules: ConfigurableSchedulerRules,
  ) {

  }

  public scheduleBatch(batch$: Observable<BatchInfo>): Observable<void> {
    return batch$.pipe(
      filter((batchInfo) => this.rules.some((rule) => rule(batchInfo))),
      map(() => undefined),
      take(1),
    );
  }

  public reset(): void {
    // No-op: subscriptions are managed by returned observable chains.
  }

  public destroy(): void {
    this.reset();
  }
}
