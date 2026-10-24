import {Observable, defer, finalize, from, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import axios, {type AxiosInstance, AxiosResponse, AxiosResponseHeaders} from 'axios';
import {CookieJar} from 'tough-cookie';
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http';
import type {AuthErrorSuspension, HttpTransport} from '@rci-tools/core';
import {AuthErrorHandler, RciHttpError} from '@rci-tools/core';

export class AxiosTransport implements HttpTransport<AxiosResponse> {
  protected readonly jar: CookieJar;
  protected readonly client: AxiosInstance;
  protected readonly authHandler = new AuthErrorHandler();
  public readonly authError$: Observable<void> = this.authHandler.authError$;
  public readonly authErrorSuspension: AuthErrorSuspension = this.authHandler;

  constructor(client?: AxiosInstance) {
    this.jar = new CookieJar();
    this.client = client ?? axios.create({
      httpAgent: new HttpCookieAgent({cookies: {jar: this.jar}}),
      httpsAgent: new HttpsCookieAgent({cookies: {jar: this.jar}}),
    });
  }

  public onAuthRequest(): void {
    // noop; cookies are handled by the CookieJar
  }

  public clearAuthData(): void {
    // noop; cookies are handled by the CookieJar
  }

  public getHeader(response: AxiosResponse, name: string): string | null {
    const header = (response.headers as AxiosResponseHeaders)?.get(name) as string | undefined;

    return header ?? null;
  }

  public get(url: string): Observable<AxiosResponse> {
    return this.request((signal) => this.client.get(url, this.requestConfig(signal)));
  }

  public post(url: string, data: unknown): Observable<AxiosResponse> {
    return this.request((signal) => this.client.post(url, data, this.requestConfig(signal)));
  }

  public delete(url: string): Observable<AxiosResponse> {
    return this.request((signal) => this.client.delete(url, this.requestConfig(signal)));
  }

  protected requestConfig(signal: AbortSignal) {
    return {
      withCredentials: true,
      signal,
      validateStatus: (status: number) => status >= 200 && status < 300,
    };
  }

  // the request is sent on subscription; unsubscribing before completion aborts it
  protected request(send: (signal: AbortSignal) => Promise<AxiosResponse>): Observable<AxiosResponse> {
    return defer(() => {
      const controller = new AbortController();

      return from(send(controller.signal))
        .pipe(
          finalize(() => controller.abort()),
        );
    })
      .pipe(
        catchError((error: unknown) => {
          const axiosError = axios.isAxiosError(error) ? error : null;
          const response = axiosError?.response ?? null;

          return throwError(() =>
            new RciHttpError(
              error instanceof Error ? error.message : 'HTTP request failed',
              {
                status: response?.status ?? null,
                response,
                cause: error,
              },
            )
          );
        }),
        this.authHandler.handleAuthError<AxiosResponse>(),
      );
  }
}
