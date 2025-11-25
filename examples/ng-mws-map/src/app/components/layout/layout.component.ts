import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NavigationEnd, Router, RouterModule, RouterOutlet} from '@angular/router';
import {filter, map} from 'rxjs/operators';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'nmm-layout',
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  protected currentRoute = '';

  protected menuItems = [
    {label: 'Page 1', route: '/main/page1'},
    {label: 'Page 2', route: '/main/page2'},
    {label: 'Page 3', route: '/main/page3'},
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {
    // Track current route
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => event as NavigationEnd),
      )
      .subscribe(event => {
        this.currentRoute = event.urlAfterRedirects;
      });

    this.currentRoute = this.router.url;
  }

  protected logout(): void {
    this.authService.logout()
      .subscribe(() => {
        this.router.navigate(['/login']);
      });
  }
}
