import {Observable, defer, of} from 'rxjs';
import {catchError, finalize, map, shareReplay, switchMap, tap} from 'rxjs/operators';
import type {BaseHttpResponse, HttpTransport} from '../transport/http.transport';
import {AUTH_PROTOCOL, LOGIN_FAILURE_REASON} from './auth-protocol/auth-protocol.types';
import type {AuthProtocolName, SessionAuthContext, SessionAuthProtocol} from './auth-protocol/auth-protocol.types';
import {Ndw2AuthProtocol} from './auth-protocol/x-ndw2-interactive/ndw2-auth.protocol';
import {Ndw4AuthProtocol} from './auth-protocol/x-ndw4-interactive/ndw4-auth.protocol';
import {toLoginFailure, toLoginSuccess} from './auth-protocol/login-result.utils';
import type {LoginDetails, SessionManagerOptions} from './session-manager.types';

// NDW4 first: prefer it if the device offers it
const DEFAULT_AUTH_PROTOCOLS: readonly AuthProtocolName[] = [AUTH_PROTOCOL.NDW4, AUTH_PROTOCOL.NDW2];

type BuiltInAuthProtocol<ResponseType extends BaseHttpResponse> =
  & SessionAuthProtocol<ResponseType>
  & {readonly schema: AuthProtocolName};

export class SessionManager<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  private readonly authProtocols: Array<BuiltInAuthProtocol<ResponseType>>;
  private readonly authUri: string;

  private isLoggingErrors: boolean = false;
  private loginAttemptInProgress$: Observable<LoginDetails> | null = null;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<ResponseType>,
    options: SessionManagerOptions = {},
  ) {
    this.authUri = `${this.host}/auth`;

    const protocols = options.protocols ?? DEFAULT_AUTH_PROTOCOLS;

    if (protocols.length === 0) {
      throw new Error('SessionManager: at least one auth protocol is required.');
    }

    this.authProtocols = [...new Set(protocols)].map((name) => this.createAuthProtocol(name));
  }

  private createAuthProtocol(name: AuthProtocolName): BuiltInAuthProtocol<ResponseType> {
    switch (name) {
      case AUTH_PROTOCOL.NDW4:
        return new Ndw4AuthProtocol(this.host, this.httpTransport);
      case AUTH_PROTOCOL.NDW2:
        return new Ndw2AuthProtocol(this.host, this.httpTransport);
      default:
        throw new Error(`SessionManager: unknown auth protocol "${String(name)}".`);
    }
  }

  public isAuthenticated(): Observable<boolean> {
    return this.httpTransport.get(this.authUri)
      .pipe(
        catchError((error) => {
          this.logError(error);

          return of(this.errorToResponse(error));
        }),
        map((response) => {
          this.httpTransport.onAuthRequest(response);

          return response?.status === 200;
        }),
      );
  }

  public getRealmHeader(): Observable<string> {
    return this.httpTransport.get(this.authUri)
      .pipe(
        catchError((error) => of(this.errorToResponse(error))),
        map((response) => this.httpTransport.getHeader(response, 'X-NDM-Realm')),
      );
  }

  public login(username: string, password: string): Observable<boolean> {
    return this.loginDetailed(username, password)
      .pipe(
        map((result) => result.success),
      );
  }

  /**
   * Same as `login()` (and shares the same in-flight attempt with it), but reports the details:
   * the auth protocol used (see `LoginDetails`) and, on failure, the reason:
   * - `rejected`: the device refused the credentials (`401` on the NDW2 `POST /auth`;
   *   a server signature mismatch or an `error` in an NDW4 reply);
   * - `unavailable`: anything else — the handshake could not be completed
   *   (network error, unexpected HTTP status, malformed reply, no session after the handshake, etc.).
   *
   * Unsubscribing stops the handshake: no further requests are sent, and the next call starts a fresh one.
   */
  public loginDetailed(username: string, password: string): Observable<LoginDetails> {
    return defer(() => {
      if (this.loginAttemptInProgress$) {
        return this.loginAttemptInProgress$;
      }

      const flight = this.runLoginHandshake(username, password)
        .pipe(
          tap({
            next: () => this.onLoginAttemptEnd(flight),
            complete: () => this.onLoginAttemptEnd(flight),
            error: () => this.onLoginAttemptEnd(flight),
          }),
          finalize(() => this.onLoginAttemptEnd(flight)),
          shareReplay({bufferSize: 1, refCount: true}),
        );

      this.loginAttemptInProgress$ = flight;

      return flight;
    });
  }

  private runLoginHandshake(username: string, password: string): Observable<LoginDetails> {
    return defer(() => {
      this.httpTransport.authErrorSuspension?.suspend();

      return this.httpTransport.get(this.authUri)
        .pipe(
          catchError((error) => of(this.errorToResponse(error))),
          switchMap((response): Observable<LoginDetails> => {
            this.httpTransport.onAuthRequest(response);

            if (response.status === 200) {
              return of({...toLoginSuccess(), protocol: null});
            }

            const protocol = this.authProtocols.find((candidate) => {
              return candidate.isSupported(response);
            });

            if (!protocol) {
              this.logError(`No supported authentication protocol found for response with status ${response.status}`);

              return of({...toLoginFailure(LOGIN_FAILURE_REASON.UNAVAILABLE), protocol: null});
            }

            return this.authenticateWith(protocol, response, username, password);
          }),
          finalize(() => this.httpTransport.authErrorSuspension?.resume()),
        );
    });
  }

  // runs the handshake of the selected protocol and reports the protocol along with the result
  private authenticateWith(
    protocol: BuiltInAuthProtocol<ResponseType>,
    initialResponse: ResponseType,
    username: string,
    password: string,
  ): Observable<LoginDetails> {
    return protocol.authenticate(initialResponse, this.getAuthContext(), username, password)
      .pipe(
        map((result): LoginDetails => ({...result, protocol: protocol.schema})),
      );
  }

  private onLoginAttemptEnd(loginAttempt: Observable<LoginDetails>): void {
    if (this.loginAttemptInProgress$ === loginAttempt) {
      this.loginAttemptInProgress$ = null;
    }
  }

  public logout(): Observable<unknown> {
    return this.httpTransport.delete(this.authUri)
      .pipe(
        catchError((error) => of(this.errorToResponse(error))),
        tap(() => {
          this.httpTransport.clearAuthData();
        }),
      );
  }

  public toggleErrorLogging(isEnabled: boolean): void {
    this.isLoggingErrors = isEnabled;
  }

  protected logError(error: unknown): void {
    if (this.isLoggingErrors) {
      console.warn(error);
    }
  }

  private errorToResponse(error: unknown): ResponseType {
    if (
      error
      && typeof error === 'object'
      && 'response' in error
      && error.response
    ) {
      return error.response as ResponseType;
    }

    return error as ResponseType;
  }

  private getAuthContext(): SessionAuthContext<ResponseType> {
    return {
      isAuthenticated: () => this.isAuthenticated(),
      errorToResponse: (error) => this.errorToResponse(error),
      logError: (error) => this.logError(error),
    };
  }
}
