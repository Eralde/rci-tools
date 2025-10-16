import {RciManager, RciQuery, SessionManager, FetchTransport} from 'rci-manager';
import {catchError, Observable, of} from 'rxjs';

class RciService {
  protected transport: FetchTransport;
  protected auth: SessionManager;
  protected driver: RciManager;

  constructor() {
    this.transport = new FetchTransport();
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
    return this.driver.execute(queries);
  }
}

export const rciService = new RciService();
