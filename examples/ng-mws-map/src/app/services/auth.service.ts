import {Injectable} from '@angular/core';
import {SessionManager, FetchTransport} from 'rci-manager';
import {Observable, catchError, of} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private transport: FetchTransport;
  private sessionManager: SessionManager;

  constructor() {
    this.transport = new FetchTransport();
    // Using window.origin as the host, similar to simple-browser-demo
    this.sessionManager = new SessionManager(window.origin, this.transport);
  }

  public login(username: string, password: string): Observable<boolean> {
    return this.sessionManager.login(username, password)
      .pipe(
        catchError((err) => {
          console.error('Login failed:', err);
          return of(false);
        }),
      );
  }

  public logout(): Observable<unknown> {
    return this.sessionManager.logout();
  }

  public isAuthenticated(): Observable<boolean> {
    return this.sessionManager.isAuthenticated();
  }
}

