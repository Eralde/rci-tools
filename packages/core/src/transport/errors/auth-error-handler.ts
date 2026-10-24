import {Observable, OperatorFunction, Subject, catchError, throwError} from 'rxjs';
import {isRciHttpError} from './rci-http-error';

export class AuthErrorHandler {
  protected readonly authErrorSub$ = new Subject<void>();
  public readonly authError$: Observable<void> = this.authErrorSub$.asObservable();

  protected suspendDepth = 0;

  public suspend(): void {
    this.suspendDepth += 1;
  }

  public resume(): void {
    this.suspendDepth = Math.max(0, this.suspendDepth - 1);
  }

  public static is401Error(error: unknown): boolean {
    return isRciHttpError(error) && error.status === 401;
  }

  public handleAuthError<T>(): OperatorFunction<T, T> {
    return catchError((error) => {
      if (AuthErrorHandler.is401Error(error) && this.suspendDepth === 0) {
        this.authErrorSub$.next();
      }

      return throwError(() => error);
    });
  }

  public destroy(): void {
    this.authErrorSub$.complete();
  }
}
