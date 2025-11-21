import {Observable} from 'rxjs';
import {
  FetchTransport,
  RciContinuedQuery,
  type RciContinuedTaskOptions,
  RciManager,
  RciQuery,
  SessionManager,
} from 'rci-manager';

export class RciService {
  protected transport: FetchTransport;
  protected auth: SessionManager;
  protected driver: RciManager;

  public readonly authError$: Observable<void>;

  constructor() {
    this.transport = new FetchTransport();
    this.authError$ = this.transport.authError$;

    this.driver = new RciManager(window.origin, this.transport);
    this.auth = new SessionManager(window.origin, this.transport);
  }

  public getDeviceName(): Observable<string> {
    return this.auth.getRealmHeader();
  }

  public isAuthenticated(): Observable<boolean> {
    return this.auth.isAuthenticated();
  }

  public login(username: string, password: string): Observable<boolean> {
    return this.auth.login(username, password);
  }

  public logout(): Observable<unknown> {
    return this.auth.logout();
  }

  public execute(queries: RciQuery | RciQuery[]): Observable<unknown> {
    return this.driver.execute(queries);
  }

  public executeContinued(
    query: RciQuery,
    options: RciContinuedTaskOptions = {},
  ): RciContinuedQuery {
    return this.driver.executeContinued(query, options);
  }
}

// Legacy export for backward compatibility
// Use DI container to get RciService instance instead
export const rciService = new RciService();
