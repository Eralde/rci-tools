import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'nmm-layout',
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  currentRoute = '';

  menuItems = [
    { label: 'Page 1', route: '/main/page1' },
    { label: 'Page 2', route: '/main/page2' },
    { label: 'Page 3', route: '/main/page3' },
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {
    // Track current route
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => event as NavigationEnd)
      )
      .subscribe(event => {
        this.currentRoute = event.urlAfterRedirects;
      });
    
    // Set initial route
    this.currentRoute = this.router.url;
  }

  logout(): void {
    this.authService.logout()
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (err) => {
          console.error('Logout error:', err);
          // Navigate to login even if logout fails
          this.router.navigate(['/login']);
        },
      });
  }
}
