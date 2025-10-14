import {from, map, Observable, OperatorFunction, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import axios, {AxiosResponse, AxiosResponseHeaders} from 'axios';
import {CookieJar} from 'tough-cookie';
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http';
import type {GenericObject, HttpTransport} from 'rci-manager';

const NETWORK_ERRORS = ['ECONNREFUSED', 'EHOSTDOWN', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ENETUNREACH'];

const getNetworkErrorHandler = (
  predicate: (response: unknown) => boolean,
): OperatorFunction<AxiosResponse, AxiosResponse> => {
  return (source$: Observable<AxiosResponse>): Observable<AxiosResponse> => {
    return source$
      .pipe(
        catchError((error: any) => {
          if (predicate(error)) {
            return throwError(() => ({
              ...error,
              response: {status: 503, statusText: 'Service Unavailable'},
            }));
          }

          return throwError(() => error);
        }),
      );
  };
};

export class AxiosTransport implements HttpTransport<AxiosResponse> {
  protected jar: CookieJar;
  protected client: axios.AxiosInstance;

  protected handleNetworkError: OperatorFunction<AxiosResponse, AxiosResponse>;

  constructor() {
    this.jar = new CookieJar();
    this.client = axios.create({
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

  public isNetworkError(error: any): boolean {
    if (!error) {
      return false;
    }

    const message = error?.message ?? '';

    return NETWORK_ERRORS.includes(message);
  }

  public getHeader(response: AxiosResponse, name: string): string {
    const header = (response.headers as AxiosResponseHeaders)?.get(name) as string;

    return header ?? '';
  }

  public get(url: string): Observable<AxiosResponse> {
    return from(this.client.get(url, {withCredentials: true}))
      .pipe(
        this.handleNetworkError,
      );
  }

  public post(url: string, data: unknown): Observable<AxiosResponse> {
    return from(this.client.post(url, data, {withCredentials: true}))
      .pipe(
        this.handleNetworkError,
      );
  }

  public delete(url: string): Observable<AxiosResponse> {
    return from(this.client.delete(url, {withCredentials: true}))
      .pipe(
        this.handleNetworkError,
      );
  }

  public sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]> {
    return this.post(url, queryArray)
      .pipe(
        map((httpResponse: AxiosResponse) => httpResponse.data),
        catchError((error) => throwError(() => error)),
      );
  }
}
