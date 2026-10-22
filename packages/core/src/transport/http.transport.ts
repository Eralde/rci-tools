import type {Observable} from 'rxjs';
import type {GenericObject} from '../type.utils';

export interface BaseHttpResponse<Data = unknown> {
  status: number;
  data: Data;
}

export interface AuthErrorSuspension {
  suspend(): void;
  resume(): void;
}

export interface HttpTransport<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  readonly authErrorSuspension?: AuthErrorSuspension;

  get(url: string): Observable<ResponseType>;
  post(url: string, data: unknown): Observable<ResponseType>;
  delete(url: string): Observable<ResponseType>;

  getHeader(response: ResponseType, name: string): string;

  onAuthRequest(response: ResponseType): void;
  clearAuthData(): void;

  sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]>;
}
