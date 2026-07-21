import {Observable, of} from 'rxjs';
import type {BaseHttpResponse, HttpTransport} from '../../transport';
import type {SessionAuthContext, SessionAuthProtocol} from './auth-protocol.types';

export class Ndw4InteractiveAuthProtocol<ResponseType extends BaseHttpResponse = BaseHttpResponse>
  implements SessionAuthProtocol<ResponseType> {
  public readonly schema = 'x-ndw4-interactive';

  constructor(
    public readonly host: string,
    public readonly httpTransport: HttpTransport<ResponseType>,
  ) {
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
    console.warn([
      initialResponse?.headers,
      context,
      username,
      password,
    ]);

    return of(false);
  }
}
