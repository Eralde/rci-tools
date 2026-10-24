import {Observable, catchError, defer, exhaustMap, finalize, from, map, throwError} from 'rxjs';
import type {AuthErrorSuspension, BaseHttpResponse, HttpTransport} from '../http.transport';
import {AuthErrorHandler} from '../errors/auth-error-handler';
import {RciHttpError} from '../errors/rci-http-error';

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

  public getHeader(response: FetchTransportResponse, name: string): string | null {
    return response?.headers?.get(name) ?? null;
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

  // `fetch` starts on subscription; unsubscribing before completion aborts the request
  protected request(url: string, init: RequestInit): Observable<FetchTransportResponse> {
    return defer(() => {
      const controller = new AbortController();
      const promise = fetch(url, {...init, signal: controller.signal});

      return defer(() => from(promise))
        .pipe(
          catchError((cause: unknown) => {
            return throwError(() => {
              return new RciHttpError(
                'Network request failed',
                {
                  status: null,
                  cause,
                },
              );
            });
          }),
          exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
          finalize(() => controller.abort()),
        );
    })
      .pipe(
        this.authHandler.handleAuthError<FetchTransportResponse>(),
      );
  }

  protected processResponse(fetchResponse: Response): Observable<FetchTransportResponse> {
    return from(fetchResponse.text())
      .pipe(
        catchError((cause: unknown) => {
          return throwError(() => {
            return new RciHttpError(
              'Failed to read the response body',
              {
                status: fetchResponse.status,
                cause,
              },
            );
          });
        }),
        map((text: string) => {
          let data: any;

          try {
            data = JSON.parse(text);
          } catch (err) {
            data = {};
          }

          const response: FetchTransportResponse = {
            status: fetchResponse.status,
            headers: fetchResponse.headers,
            data,
          };

          if (response.status >= 200 && response.status < 300) {
            return response;
          }

          throw new RciHttpError(
            `HTTP ${response.status}`,
            {
              status: response.status,
              response,
            },
          );
        }),
      );
  }
}
