import {Observable, exhaustMap, from, of} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {md5} from 'hash-wasm';
import jsSha from 'jssha';
import type {BaseHttpResponse, HttpTransport} from '../transport';

const AUTH_URI = '/auth';

interface PasswordData {
  token: string;
  login: string;
  realm: string;
  password: string;
}

export class SessionManager<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  private readonly authUri: string;

  private isLoggingAuthErrors: boolean = false;

  constructor(
    private host: string,
    private httpTransport: HttpTransport<ResponseType>,
  ) {
    this.authUri = `${this.host}${AUTH_URI}`;
  }

  public isAuthenticated(): Observable<boolean> {
    return this.httpTransport.get(this.authUri)
      .pipe(
        catchError((error) => {
          if (this.isLoggingAuthErrors) {
            console.warn(error);
          }

          return error?.response ? of(error.response) : of(error);
        }),
        map((response) => {
          this.httpTransport.onAuthRequest(response);

          return response?.status === 200;
        }),
      );
  }

  public login(username: string, password: string): Observable<boolean> {
    return this.httpTransport.get(this.authUri)
      .pipe(
        catchError((error) => error?.response ? of(error.response) : of(error)),
        switchMap((response): Observable<boolean> => {
          this.httpTransport.onAuthRequest(response);

          if (response.status === 200) {
            return of(true);
          }

          const passwordData: PasswordData = {
            token: this.httpTransport.getHeader(response, 'X-NDM-Challenge'),
            realm: this.httpTransport.getHeader(response, 'X-NDM-Realm'),
            login: username,
            password,
          };

          return this.getEncryptedPassword(passwordData)
            .pipe(
              exhaustMap((encryptedPassword) => this.doAuth(username, encryptedPassword)),
            );
        }),
      );
  }

  public logout(): Observable<unknown> {
    return this.httpTransport.delete(this.authUri)
      .pipe(
        catchError((error) => of(error)),
        tap(() => {
          this.httpTransport.clearAuthData();
        }),
      );
  }

  public toggleAuthErrorLogging(isEnabled: boolean): void {
    this.isLoggingAuthErrors = isEnabled;
  }

  private getEncryptedPassword(props: PasswordData): Observable<string> {
    const {
      token,
      login,
      realm,
      password,
    } = props;

    const sha = new jsSha('SHA-256', 'TEXT');

    return from(md5(`${login}:${realm}:${password}`))
      .pipe(
        map((md5Hash) => {
          sha.update(token + String(md5Hash));

          return sha.getHash('HEX');
        }),
      );
  }

  private doAuth(username: string, encryptedPassword: string): Observable<boolean> {
    const requestData = {
      login: username,
      password: encryptedPassword,
    };

    return this.httpTransport.post(this.authUri, requestData)
      .pipe(
        catchError((error) => {
          if (this.isLoggingAuthErrors) {
            console.warn(error);
          }

          return error?.response
            ? of(error.response)
            : of({status: -1, error: 'Unknown error'});
        }),
        exhaustMap(() => this.isAuthenticated()),
      );
  }
}
