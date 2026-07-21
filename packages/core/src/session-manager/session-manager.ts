import {Observable, of} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import type {BaseHttpResponse, HttpTransport} from '../transport';
import {Ndw2InteractiveAuthProtocol, SessionAuthContext, SessionAuthProtocol} from './auth-protocol';
import {Ndw4InteractiveAuthProtocol} from './auth-protocol/ndw4-interactive-auth.protocol';

export class SessionManager<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  private readonly authProtocols: Array<SessionAuthProtocol<ResponseType>> = [];
  private readonly authUri: string;

  private isLoggingErrors: boolean = false;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<ResponseType>,
  ) {
    this.authUri = `${this.host}/auth`;

    this.authProtocols.push(
      new Ndw4InteractiveAuthProtocol(this.host, this.httpTransport), // prefer if available
      new Ndw2InteractiveAuthProtocol(this.host, this.httpTransport),
    );
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
    return this.httpTransport.get(this.authUri)
      .pipe(
        catchError((error) => of(this.errorToResponse(error))),
        switchMap((response): Observable<boolean> => {
          this.httpTransport.onAuthRequest(response);

          if (response.status === 200) {
            return of(true);
          }

          const protocol = this.authProtocols.find((candidate) => {
            return candidate.isSupported(response);
          });

          if (!protocol) {
            this.logError(`No supported authentication protocol found for response with status ${response.status}`);

            return of(false);
          }

          const context = this.getAuthContext();

          return protocol.authenticate(
            response,
            context,
            username,
            password,
          );
        }),
      );
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
