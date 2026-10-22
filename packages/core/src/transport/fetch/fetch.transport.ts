import {Observable, defer, exhaustMap, finalize, from, map} from 'rxjs';
import {GenericObject} from '../../type.utils';
import type {AuthErrorSuspension, BaseHttpResponse, HttpTransport} from '../http.transport';
import {AuthErrorHandler} from '../errors';

export interface FetchTransportResponse extends BaseHttpResponse {
  headers: Headers;
}

export class FetchTransport implements HttpTransport<FetchTransportResponse> {
  protected readonly authHandler = new AuthErrorHandler();
  public readonly authError$: Observable<void> = this.authHandler.authError$;
  public readonly authErrorSuspension: AuthErrorSuspension = this.authHandler;

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
    return this.request(url, {});
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

    return this.request(url, options);
  }

  public delete(url: string): Observable<FetchTransportResponse> {
    return this.request(url, {method: 'DELETE'});
  }

  public sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]> {
    return this.post(url, queryArray)
      .pipe(
        map((response) => (response.data as GenericObject[])),
      );
  }

  // `fetch` starts on subscription; unsubscribing before completion aborts the request
  protected request(url: string, init: RequestInit): Observable<FetchTransportResponse> {
    return defer(() => {
      const controller = new AbortController();

      return from(fetch(url, {...init, signal: controller.signal}))
        .pipe(
          exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
          finalize(() => controller.abort()),
        );
    })
      .pipe(
        this.authHandler.handleAuthError<FetchTransportResponse>(),
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
