import {Observable, OperatorFunction, from, map, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import axios, {type AxiosInstance, AxiosResponse, AxiosResponseHeaders} from 'axios';
import {CookieJar} from 'tough-cookie';
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http';
import type {GenericObject, HttpTransport} from '@rci-tools/core';

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'EHOSTDOWN',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  'ENETUNREACH',
]);

const getNetworkErrorHandler = (
  predicate: (error: unknown) => boolean,
): OperatorFunction<AxiosResponse, AxiosResponse> => {
  return (source$: Observable<AxiosResponse>): Observable<AxiosResponse> => {
    return source$
      .pipe(
        catchError((error: unknown) => {
          if (predicate(error)) {
            return throwError(() => ({
              ...(error as Record<string, unknown>),
              response: {status: 503, statusText: 'Service Unavailable'},
            }));
          }

          return throwError(() => error);
        }),
      );
  };
};

export class AxiosTransport implements HttpTransport<AxiosResponse> {
  protected readonly jar: CookieJar;
  protected readonly client: AxiosInstance;
  protected readonly handleNetworkError: OperatorFunction<AxiosResponse, AxiosResponse>;

  constructor(client?: AxiosInstance) {
    this.jar = new CookieJar();
    this.client = client ?? axios.create({
      httpAgent: new HttpCookieAgent({cookies: {jar: this.jar}}),
      httpsAgent: new HttpsCookieAgent({cookies: {jar: this.jar}}),
    });

    this.handleNetworkError = getNetworkErrorHandler((error) => this.isNetworkError(error));
  }

  public onAuthRequest(): void {
    // noop; cookies are handled by the CookieJar
  }

  public clearAuthData(): void {
    // noop; cookies are handled by the CookieJar
  }

  public isNetworkError(error: unknown): boolean {
    return axios.isAxiosError(error) && NETWORK_ERROR_CODES.has(error.code ?? '');
  }

  public getHeader(response: AxiosResponse, name: string): string {
    const header = (response.headers as AxiosResponseHeaders)?.get(name) as string | undefined;

    return header ?? '';
  }

  public get(url: string): Observable<AxiosResponse> {
    return from(this.client.get(url, {withCredentials: true}))
      .pipe(this.handleNetworkError);
  }

  public post(url: string, data: unknown): Observable<AxiosResponse> {
    return from(this.client.post(url, data, {withCredentials: true}))
      .pipe(this.handleNetworkError);
  }

  public delete(url: string): Observable<AxiosResponse> {
    return from(this.client.delete(url, {withCredentials: true}))
      .pipe(this.handleNetworkError);
  }

  public sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]> {
    return this.post(url, queryArray)
      .pipe(
        map((httpResponse: AxiosResponse) => httpResponse.data),
      );
  }
}
