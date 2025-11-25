import {Component, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {RciService} from '../../core/rci.service';
import {GenericObject} from 'rci-manager';

@Component({
  selector: 'nmm-main',
  imports: [CommonModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent {
  public readonly showVersion = signal<GenericObject | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
    private rciService: RciService,
  ) {
    this.rciService.execute({path: 'show.version'})
      .subscribe((data) => this.showVersion.set(data));
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
