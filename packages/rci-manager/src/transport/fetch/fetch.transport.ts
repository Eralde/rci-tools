import {Observable, OperatorFunction, Subject, catchError, exhaustMap, from, map, throwError} from 'rxjs';
import {GenericObject} from '../../type.utils';
import type {BaseHttpResponse, HttpTransport} from '../http.transport';

export interface FetchTransportResponse extends BaseHttpResponse {
  headers: Headers;
}

export class FetchTransport implements HttpTransport<FetchTransportResponse> {
  protected readonly authErrorSub$: Subject<void>;
  public readonly authError$: Observable<void>;

  constructor() {
    this.authErrorSub$ = new Subject<void>();
    this.authError$ = this.authErrorSub$.asObservable();
  }

  public onAuthRequest(): void {
    // noop; handled by the browser
  }

  public clearAuthData(): void {
    // noop; handled by the browser
  }

  public getHeader(response: FetchTransportResponse, name: string): string {
    return response?.headers?.get(name) ?? '';
  }

  public get(url: string): Observable<FetchTransportResponse> {
    const req$ = from(fetch(url));

    return req$
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
        this.handleAuthError(),
      );
  }

  public post(url: string, data: unknown): Observable<FetchTransportResponse> {
    const options = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };

    const req$ = from(fetch(url, options));

    return req$
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
        this.handleAuthError(),
      );
  }

  public delete(url: string): Observable<FetchTransportResponse> {
    const req$ = from(fetch(url, {method: 'DELETE'}));

    return req$
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
        this.handleAuthError(),
      );
  }

  public sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]> {
    return this.post(url, queryArray)
      .pipe(
        map((response) => (response.data as GenericObject[])),
        this.handleAuthError(),
      );
  }

  protected processResponse(fetchResponse: Response): Observable<FetchTransportResponse> {
    if (fetchResponse?.status !== 200) {
      throw fetchResponse;
    }

    const text$ = from(fetchResponse.text());

    return text$
      .pipe(
        map((text: string) => {
          let data: any;

          try {
            data = JSON.parse(text);
          } catch (err) {
            data = {};
          }

          return {
            status: fetchResponse.status,
            headers: fetchResponse.headers,
            data,
          };
        }),
      );
  }

  protected handleAuthError<T>(): OperatorFunction<T, T> {
    return catchError((error) => {
      if (this.is401Error(error)) {
        this.authErrorSub$.next();

        return throwError(() => error);
      }

      return throwError(() => error);
    });
  }

  protected is401Error(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as {status: number}).status === 401;
    }

    return false;
  }
}
