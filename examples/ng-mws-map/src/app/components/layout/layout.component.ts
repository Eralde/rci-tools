import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterModule, RouterOutlet} from '@angular/router';
import {AuthService} from '../../core/transport';

@Component({
  selector: 'nmm-layout',
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  protected readonly menuItems = [
    {label: 'Page 1', route: '/main/page1'},
    {label: 'Page 2', route: '/main/page2'},
    {label: 'Page 3', route: '/main/page3'},
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {
  }

  protected logout(): void {
    this.authService.logout()
      .subscribe(() => {
        void this.router.navigate(['/login']);
      });
  }
}
