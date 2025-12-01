import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {finalize} from 'rxjs';

@Component({
  selector: 'nmm-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected loginForm: FormGroup;
  protected isLoading = false;
  protected errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please enter both username and password';
      this.loginForm.markAllAsTouched();

      return;
    }

    const {username, password} = this.loginForm.value;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(username, password)
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
