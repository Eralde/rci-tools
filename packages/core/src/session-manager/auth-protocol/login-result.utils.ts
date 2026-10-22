import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import type {BaseHttpResponse} from '../../transport/http.transport';
import {
  LOGIN_FAILURE_REASON,
  type LoginFailureReason,
  type LoginResult,
  type SessionAuthContext,
} from './auth-protocol.types';

export const toLoginSuccess = (): LoginResult => ({success: true});

export const toLoginFailure = (reason: LoginFailureReason): LoginResult => ({success: false, reason});

// The final `GET /auth` check: the handshake went through, but there may be no session
export const checkFinalLoginResult = <ResponseType extends BaseHttpResponse>(
  context: SessionAuthContext<ResponseType>,
): Observable<LoginResult> => {
  return context.isAuthenticated()
    .pipe(
      map((isAuthenticated) => {
        return isAuthenticated
          ? toLoginSuccess()
          : toLoginFailure(LOGIN_FAILURE_REASON.UNAVAILABLE);
      }),
    );
};
