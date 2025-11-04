import {Observable, catchError, exhaustMap, of} from 'rxjs';
import {AxiosTransport} from 'rci-adapter-axios';
import {RciManager, RciQuery, SessionManager} from 'rci-manager';

export interface DeviceCredentials {
  address: string;
  username: string;
  password: string;
}

export class RciService {
  protected transport: AxiosTransport;
  protected auth: SessionManager;
  protected manager: RciManager;
  protected host: string;
  protected credentials: DeviceCredentials;

  constructor(credentials: DeviceCredentials) {
    const {address} = credentials;

    this.host = address.startsWith('http://')
      ? address
      : `http://${address}`;

    this.credentials = credentials;

    this.transport = new AxiosTransport();
    this.manager = new RciManager(this.host, this.transport);
    this.auth = new SessionManager(this.host, this.transport);
  }

  public execute(query: RciQuery | RciQuery[]): Observable<unknown> {
    return this.ensureAuth()
      .pipe(
        exhaustMap(() => this.manager.execute(query)),
        catchError(() => {
          return of(null);
        }),
      );
  }


  public ensureAuth(): Observable<boolean> {
    return this.auth.isAuthenticated()
      .pipe(
        exhaustMap((isAuthenticated: boolean) => {
          if (!isAuthenticated) {
            return this.auth.login(this.credentials.username, this.credentials.password);
          }

          return of(true);
        }),
      );
  }
}
