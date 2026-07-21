import {Observable, defer, exhaustMap, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {md5} from 'hash-wasm';
import jsSha from 'jssha';
import type {BaseHttpResponse, HttpTransport} from '../../transport';
import type {SessionAuthContext, SessionAuthProtocol} from './auth-protocol.types';

interface PasswordData {
  token: string;
  login: string;
  realm: string;
  password: string;
}

export class Ndw2InteractiveAuthProtocol<ResponseType extends BaseHttpResponse = BaseHttpResponse>
  implements SessionAuthProtocol<ResponseType> {
  public readonly schema = 'x-ndw2-interactive';
  public readonly authEndpoint: string;

  constructor(
    public readonly host: string,
    public readonly httpTransport: HttpTransport<ResponseType>,
  ) {
    this.authEndpoint = `${this.host}/auth`;
  }

  public isSupported(response: ResponseType): boolean {
    const header = this.httpTransport.getHeader(response, 'WWW-Authenticate');

    return header.includes(this.schema);
  }

  public authenticate(
    initialResponse: ResponseType,
    context: SessionAuthContext<ResponseType>,
    username: string,
    password: string,
  ): Observable<boolean> {
    const token = this.httpTransport.getHeader(initialResponse, 'X-NDM-Challenge');
    const realm = this.httpTransport.getHeader(initialResponse, 'X-NDM-Realm');

    if (!token || !realm) {
      context.logError('One of the requried headers ("X-NDM-Challenge", "X-NDM-Realm") is missing');

      return of(false);
    }

    return this.getEncryptedPassword({token, realm, login: username, password})
      .pipe(
        exhaustMap((encryptedPassword) => this.doAuth(context, username, encryptedPassword)),
      );
  }

  private getEncryptedPassword(passwordData: PasswordData): Observable<string> {
    const {
      token,
      login,
      realm,
      password,
    } = passwordData;

    return defer(() => md5(`${login}:${realm}:${password}`))
      .pipe(
        map((md5Hash) => {
          const sha = new jsSha('SHA-256', 'TEXT');

          sha.update(token + String(md5Hash));

          return sha.getHash('HEX');
        }),
      );
  }

  private doAuth(
    context: SessionAuthContext<ResponseType>,
    username: string,
    encryptedPassword: string,
  ): Observable<boolean> {
    const requestData = {
      login: username,
      password: encryptedPassword,
    };

    return this.httpTransport.post(this.authEndpoint, requestData)
      .pipe(
        catchError((error) => {
          context.logError(error);

          return of(context.errorToResponse(error));
        }),
        exhaustMap(() => context.isAuthenticated()),
      );
  }
}
