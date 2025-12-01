import {Injectable} from '@angular/core';
import {CanActivate, Router, UrlTree} from '@angular/router';
import {Observable, map} from 'rxjs';
import {AuthService} from '../transport';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
  }

  public canActivate(): Observable<boolean | UrlTree> {
    return this.authService.isAuthenticated()
      .pipe(
        map((isAuthenticated) => {
          if (isAuthenticated) {
            return true;
          }

          return this.router.parseUrl('/login');
        }),
      );
  }
}
