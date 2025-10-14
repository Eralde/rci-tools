import {exhaustMap, Observable, of} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {Md5} from 'ts-md5';
import jsSha from 'jssha';
import type {BaseHttpResponse, HttpTransport} from '../transport';

const AUTH_URI = '/auth';

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
    return this.sendAuthRequest()
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
    return this.sendAuthRequest()
      .pipe(
        catchError((error) => error?.response ? of(error.response) : of(error)),
        switchMap((response): Observable<boolean> => {
          this.httpTransport.onAuthRequest(response);

          if (response.status === 200) {
            return of(true);
          }

          const encryptedPassword = this.getEncryptedPassword({
            token: this.httpTransport.getHeader(response, 'X-NDM-Challenge'),
            realm: this.httpTransport.getHeader(response, 'X-NDM-Realm'),
            login: username,
            password,
          });

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

  private getEncryptedPassword(props: {token: string; login: string; realm: string; password: string}) {
    const {
      token,
      login,
      realm,
      password,
    } = props;

    const sha = new jsSha('SHA-256', 'TEXT');
    const md5 = Md5.hashStr(`${login}:${realm}:${password}`);

    sha.update(token + String(md5));

    return sha.getHash('HEX');
  }

  private sendAuthRequest(): Observable<ResponseType> {
    return this.httpTransport.get(this.authUri);
  }
}
