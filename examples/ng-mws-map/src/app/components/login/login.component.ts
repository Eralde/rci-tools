import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'nmm-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    this.authService.isAuthenticated()
      .subscribe(console.log);
  }

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.username, this.password)
      .subscribe({
        next: (success) => {
          this.isLoading = false;
          if (success) {
            this.router.navigate(['/main']);
          } else {
            this.errorMessage = 'Login failed. Please check your credentials.';
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'An error occurred during login. Please try again.';
          console.error('Login error:', err);
        },
      });
  }
}
