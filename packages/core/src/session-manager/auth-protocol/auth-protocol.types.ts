import {BaseHttpResponse, HttpTransport} from '../../transport';
import {Observable} from 'rxjs';

export interface SessionAuthContext<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  isAuthenticated(): Observable<boolean>;
  errorToResponse(error: unknown): ResponseType;
  logError(error: unknown): void;
}

export interface SessionAuthProtocol<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  readonly host: string;
  readonly httpTransport: HttpTransport<ResponseType>;

  isSupported(response: ResponseType): boolean;

  authenticate(
    initialResponse: ResponseType,
    context: SessionAuthContext<ResponseType>,
    username: string,
    password: string,
  ): Observable<boolean>;
}
