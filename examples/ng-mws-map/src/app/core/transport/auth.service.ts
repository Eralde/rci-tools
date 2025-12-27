import {Injectable} from '@angular/core';
import {SessionManager} from '@rci-tools/core';
import {Observable, catchError, of} from 'rxjs';
import {NgTransport} from './ng.transport';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private sessionManager: SessionManager;

  constructor(
    private ngTransport: NgTransport,
  ) {
    this.sessionManager = new SessionManager(window.origin, this.ngTransport);
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
