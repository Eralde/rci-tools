import {Observable, exhaustMap, from, map} from 'rxjs';
import {GenericObject} from '../../type.utils';
import type {BaseHttpResponse, HttpTransport} from '../http.transport';
import {AuthErrorHandler} from '../errors';

export interface FetchTransportResponse extends BaseHttpResponse {
  headers: Headers;
}

export class FetchTransport implements HttpTransport<FetchTransportResponse> {
  protected readonly authHandler = new AuthErrorHandler();
  public readonly authError$: Observable<void> = this.authHandler.authError$;

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
    return from(fetch(url))
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
        this.authHandler.handleAuthError<FetchTransportResponse>(),
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

    return from(fetch(url, options))
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
        this.authHandler.handleAuthError<FetchTransportResponse>(),
      );
  }

  public delete(url: string): Observable<FetchTransportResponse> {
    return from(fetch(url, {method: 'DELETE'}))
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
        this.authHandler.handleAuthError<FetchTransportResponse>(),
      );
  }

  public sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]> {
    return this.post(url, queryArray)
      .pipe(
        map((response) => (response.data as GenericObject[])),
      );
  }

  protected processResponse(fetchResponse: Response): Observable<FetchTransportResponse> {
    if (fetchResponse?.status !== 200) {
      throw fetchResponse;
    }

    return from(fetchResponse.text())
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
}
