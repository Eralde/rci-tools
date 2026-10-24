import type {Observable} from 'rxjs';
import type {RciHttpError} from './errors/rci-http-error';

export interface BaseHttpResponse<Data = unknown> {
  status: number;
  data: Data;
}

export interface AuthErrorSuspension {
  suspend(): void;
  resume(): void;
}

/**
 * HTTP requests are cold and abort when unsubscribed. Any 2xx response is successful; failed requests error with
 * {@link RciHttpError}, whose status is `null` when no HTTP response exists. Timeouts added by core in `execute()` and
 * `queue()` remain RxJS `TimeoutError`.
 */
export interface HttpTransport<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  readonly authErrorSuspension?: AuthErrorSuspension;
  /** Emits when a 401 happens outside a login handshake (an expired session). */
  readonly authError$?: Observable<void>;

  get(url: string): Observable<ResponseType>;
  post(url: string, data: unknown): Observable<ResponseType>;
  delete(url: string): Observable<ResponseType>;

  getHeader(response: ResponseType, name: string): string | null;

  onAuthRequest(response: ResponseType): void;
  clearAuthData(): void;
}
