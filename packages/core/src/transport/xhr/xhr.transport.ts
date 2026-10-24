import {Observable} from 'rxjs';
import type {AuthErrorSuspension, BaseHttpResponse, HttpTransport} from '../http.transport';
import {AuthErrorHandler} from '../errors/auth-error-handler';
import {RciHttpError} from '../errors/rci-http-error';

export interface XHRTransportResponse extends BaseHttpResponse {
  headers: XHRHeaders;
}

export class XHRHeaders {
  private readonly entries = new Map<string, string>();

  public static fromRaw(raw: string): XHRHeaders {
    const headers = new XHRHeaders();

    for (const line of raw.split(/\r?\n/)) {
      const separator = line.indexOf(':');

      if (separator <= 0) {
        continue;
      }

      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();

      if (name) {
        headers.append(name, value);
      }
    }

    return headers;
  }

  public append(name: string, value: string): void {
    const key = name.toLowerCase();
    const existing = this.entries.get(key);

    this.entries.set(key, existing ? `${existing}\n${value}` : value);
  }

  public get(name: string): string | null {
    return this.entries.get(name.toLowerCase()) ?? null;
  }
}

export class XHRTransport implements HttpTransport<XHRTransportResponse> {
  protected readonly authHandler = new AuthErrorHandler();
  public readonly authError$: Observable<void> = this.authHandler.authError$;
  public readonly authErrorSuspension: AuthErrorSuspension = this.authHandler;

  public onAuthRequest(): void {
    // noop; handled by the browser
  }

  public clearAuthData(): void {
    // noop; handled by the browser
  }

  public getHeader(response: XHRTransportResponse, name: string): string | null {
    return response?.headers?.get(name) ?? null;
  }

  public get(url: string): Observable<XHRTransportResponse> {
    return this.request('GET', url, undefined, undefined);
  }

  public post(url: string, data: unknown): Observable<XHRTransportResponse> {
    return this.request(
      'POST',
      url,
      JSON.stringify(data),
      {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    );
  }

  public delete(url: string): Observable<XHRTransportResponse> {
    return this.request('DELETE', url, undefined, undefined);
  }

  protected request(
    method: string,
    url: string,
    body: string | undefined,
    headers: Record<string, string> | undefined,
  ): Observable<XHRTransportResponse> {
    return this.sendRequest(method, url, body, headers)
      .pipe(this.authHandler.handleAuthError<XHRTransportResponse>());
  }

  private sendRequest(
    method: string,
    url: string,
    body: string | undefined,
    headers: Record<string, string> | undefined,
  ): Observable<XHRTransportResponse> {
    // the request is sent on subscription; unsubscribing before completion aborts it
    return new Observable<XHRTransportResponse>((subscriber) => {
      const xhr = new XMLHttpRequest();

      xhr.open(method, url, true);

      xhr.withCredentials = true;

      if (headers) {
        for (const [name, value] of Object.entries(headers)) {
          xhr.setRequestHeader(name, value);
        }
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return;
        }

        if (xhr.status === 0) {
          subscriber.error(new RciHttpError('Network request failed', {status: null}));
          return;
        }

        const response = this.toResponse(xhr);

        if (response.status >= 200 && response.status < 300) {
          subscriber.next(response);
          subscriber.complete();
        } else {
          const rciHttpError = new RciHttpError(
            `HTTP ${response.status}`,
            {
              status: response.status,
              response,
            },
          );

          subscriber.error(rciHttpError);
        }
      };

      xhr.onerror = () => {
        const cause = new Error('XMLHttpRequest request failed');

        subscriber.error(new RciHttpError('Network request failed', {status: null, cause}));
      };

      xhr.send(body);

      return () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          return;
        }

        xhr.onreadystatechange = null;
        xhr.onerror = null;
        xhr.abort();
      };
    });
  }

  private toResponse(xhr: XMLHttpRequest): XHRTransportResponse {
    let data: unknown;

    try {
      data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
    } catch {
      data = {};
    }

    return {
      status: xhr.status,
      headers: XHRHeaders.fromRaw(xhr.getAllResponseHeaders()),
      data,
    };
  }
}
