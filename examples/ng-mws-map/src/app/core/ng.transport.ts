import {HttpClient, HttpHeaders, HttpResponse} from '@angular/common/http';
import type {BaseHttpResponse, GenericObject, HttpTransport} from 'rci-manager';
import {Observable, map} from 'rxjs';

export interface NgTransportResponse extends BaseHttpResponse {
  headers: HttpHeaders;
  data: GenericObject;
}

export class NgTransport implements HttpTransport<NgTransportResponse> {
  constructor(
    private httpClient: HttpClient,
  ) {
  }

  public onAuthRequest(): void {
    console.warn('NgTransport.onAuthRequest');
  }

  public clearAuthData(): void {
    console.warn('NgTransport.clearAuthData');
  }

  public getHeader(response: NgTransportResponse, name: string): string {
    return response?.headers?.get(name) ?? '';
  }

  public get(url: string): Observable<NgTransportResponse> {
    return this.httpClient.get(url, {observe: 'response'})
      .pipe(
        map((httpResponse: HttpResponse<unknown>) => this.processResponse(httpResponse)),
      );
  }

  public post(url: string, data: unknown): Observable<NgTransportResponse> {
    return this.httpClient.post(url, data, {observe: 'response'})
      .pipe(
        map((httpResponse: HttpResponse<unknown>) => this.processResponse(httpResponse)),
      );
  }

  public delete(url: string): Observable<any> {
    return this.httpClient.delete(url);
    // .pipe(
    //   map((httpResponse: HttpResponse<unknown>) => this.processResponse(httpResponse)),
    // );
  }

  public sendQueryArray(url: string, queryArray: GenericObject[]): Observable<GenericObject[]> {
    return this.httpClient.post(url, queryArray, {observe: 'response'})
      .pipe(
        map((httpResponse: HttpResponse<Object>) => httpResponse.body as GenericObject[]),
      );
  }

  protected processResponse(httpResponse: HttpResponse<unknown>): NgTransportResponse {
    return {
      status: httpResponse.status,
      headers: httpResponse.headers,
      data: httpResponse.body as GenericObject,
    };
  }
}
