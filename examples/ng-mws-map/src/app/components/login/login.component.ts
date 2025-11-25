import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {finalize} from 'rxjs';

@Component({
  selector: 'nmm-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected username = '';
  protected password = '';
  protected isLoading = false;
  protected errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
  }

  protected onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password';

      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.username, this.password)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe((success) => {
        if (success) {
          this.router.navigate(['/main']);
        } else {
          this.errorMessage = 'Login failed. Please check your credentials.';
        }
      });
  }
}
