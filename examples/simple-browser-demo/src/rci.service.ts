import {HttpTransport, RciManager, RciQuery, SessionManager} from '@rci-tools/core';
import {Observable, catchError, of} from 'rxjs';
import {createTransport} from './transport.factory';

class RciService {
  protected transport: HttpTransport;
  protected auth: SessionManager;
  protected driver: RciManager;

  constructor() {
    this.transport = createTransport(import.meta.env.VITE_TRANSPORT);
    this.driver = new RciManager(window.origin, this.transport);
    this.auth = new SessionManager(window.origin, this.transport);
  }

  public login(username: string, password: string): Observable<boolean> {
    return this.auth.login(username, password)
      .pipe(
        catchError((err) => {
          console.error('Login failed:', err);

          return of(false);
        }),
      );
  }

  public logout(): Observable<unknown> {
    return this.auth.logout();
  }

  public isAuthenticated(): Observable<boolean> {
    return this.auth.isAuthenticated();
  }

  public execute(queries: RciQuery | RciQuery[]): Observable<unknown> {
    return this.driver.queue(queries);
  }
}

export const rciService = new RciService();
