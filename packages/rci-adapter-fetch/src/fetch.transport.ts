import {exhaustMap, from, map, Observable} from 'rxjs';
import type {BaseHttpResponse, GenericObject, HttpTransport} from 'rci-manager';

export interface FetchTransportResponse extends BaseHttpResponse {
  headers: Headers;
}

export class FetchTransport implements HttpTransport<FetchTransportResponse> {
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
      );
  }

  public delete(url: string): Observable<FetchTransportResponse> {
    const req$ = from(fetch(url, {method: 'DELETE'}));

    return req$
      .pipe(
        exhaustMap((fetchResponse: Response) => this.processResponse(fetchResponse)),
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
}
