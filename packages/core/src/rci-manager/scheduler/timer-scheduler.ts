import {Observable, Subscription, timer} from 'rxjs';
import {map, take} from 'rxjs/operators';
import type {BatchInfo} from './batch-info';
import type {BatchScheduler} from './batch-scheduler';

export class TimerScheduler implements BatchScheduler {
  protected sub$: Subscription | null = null;

  constructor(
    private readonly timeoutMs: number,
  ) {
  }

  public scheduleBatch(_batch$: Observable<BatchInfo>): Observable<void> {
    return new Observable<void>((subscriber) => {
      this.sub$ = timer(this.timeoutMs)
        .pipe(take(1), map(() => undefined))
        .subscribe({
          next: (value) => subscriber.next(value),
          complete: () => {
            this.sub$ = null;
            subscriber.complete();
          },
          error: (error) => subscriber.error(error),
        });

      return () => this.sub$?.unsubscribe();
    });
  }

  public reset(): void {
    this.sub$?.unsubscribe();
    this.sub$ = null;
  }

  public destroy(): void {
    this.reset();
  }
}
