import {Observable, catchError, exhaustMap, of} from 'rxjs';
import {AxiosTransport} from '@rci-tools/adapter-axios';
import {RciBackgroundProcess, RciManager, RciQuery, SessionManager} from '@rci-tools/core';

export interface DeviceCredentials {
  address: string;
  username: string;
  password: string;
}

export class RciService {
  protected transport: AxiosTransport;
  protected auth: SessionManager;
  protected manager: RciManager;

  constructor(
    protected credentials: DeviceCredentials,
  ) {
    const {address} = credentials;

    this.transport = new AxiosTransport();
    this.manager = new RciManager(address, this.transport);
    this.auth = new SessionManager(address, this.transport);
  }

  public execute(query: RciQuery | RciQuery[]): Observable<any> {
    return this.ensureAuth()
      .pipe(
        exhaustMap(() => this.manager.queue(query)),
        catchError((error) => {
          console.log('Failed to execute an RCI query', error);

          return of({});
        }),
      );
  }

  public queueBackgroundProcess(
    path: string,
    data: RciQuery['data'],
    options?: {timeout?: number},
  ): RciBackgroundProcess {
    console.log('Adding a "continued" task to the queue', path, data);

    const query: RciQuery = {path, data: data || {}};
    const process = this.manager.queueBackgroundProcess(query, options);

    process.done$
      .subscribe((done) => {
        console.warn('"continued" task done', {path, data, done});
      });

    return process;
  }

  public ensureAuth(): Observable<boolean> {
    return this.auth.isAuthenticated()
      .pipe(
        exhaustMap((isAuthenticated) => {
          if (!isAuthenticated) {
            return this.auth.login(this.credentials.username, this.credentials.password);
          }

          return of(true);
        }),
      );
  }
}
