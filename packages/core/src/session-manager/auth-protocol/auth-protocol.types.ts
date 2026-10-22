import {Observable} from 'rxjs';
import type {BaseHttpResponse, HttpTransport} from '../../transport/http.transport';
import type {Values} from '../../type.utils';

// Built-in auth protocols, named after their `WWW-Authenticate` schema
export const AUTH_PROTOCOL = {
  NDW4: 'x-ndw4-interactive',
  NDW2: 'x-ndw2-interactive',
} as const;

export type AuthProtocolName = Values<typeof AUTH_PROTOCOL>;

export const LOGIN_FAILURE_REASON = {
  // the device answered the handshake and did not accept the credentials
  REJECTED: 'rejected',
  // the handshake could not be completed: network error, unexpected HTTP status, malformed reply, etc.
  UNAVAILABLE: 'unavailable',
} as const;

export type LoginFailureReason = Values<typeof LOGIN_FAILURE_REASON>;

export type LoginResult =
  | {success: true}
  | {success: false; reason: LoginFailureReason};

export interface SessionAuthContext<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  isAuthenticated(): Observable<boolean>;
  errorToResponse(error: unknown): ResponseType;
  logError(error: unknown): void;
}

export interface SessionAuthProtocol<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  // the `WWW-Authenticate` schema the protocol handles
  readonly schema: string;
  readonly host: string;
  readonly httpTransport: HttpTransport<ResponseType>;

  isSupported(response: ResponseType): boolean;

  authenticate(
    initialResponse: ResponseType,
    context: SessionAuthContext<ResponseType>,
    username: string,
    password: string,
  ): Observable<LoginResult>;
}
