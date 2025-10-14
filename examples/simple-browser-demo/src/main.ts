import {map} from 'rxjs';
import {rciService} from './rci.service';

// Get DOM elements
const loginView = document.getElementById('login-view')!;
const infoView = document.getElementById('info-view')!;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginError = document.getElementById('login-error')!;
const infoLoading = document.getElementById('info-loading')!;
const infoError = document.getElementById('info-error')!;
const infoContent = document.getElementById('info-content')!;
const logoutButton = document.getElementById('logout-button')!;

// Navigation functions
function showLogin() {
  loginView.classList.remove('hidden');
  infoView.classList.add('hidden');
  loginError.classList.add('hidden');
  loginError.textContent = '';
  passwordInput.value = '';
}

function showInfo() {
  loginView.classList.add('hidden');
  infoView.classList.remove('hidden');
  loadDeviceInfo();
}

// Login handler
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  loginError.textContent = '';

  const username = usernameInput.value;
  const password = passwordInput.value;

  rciService.login(username, password).subscribe({
    next: (success) => {
      if (success) {
        showInfo();
      } else {
        loginError.textContent = 'Login failed. Please try again.';
        loginError.classList.remove('hidden');
      }
    },
    error: (err) => {
      console.error('Login error:', err);
      loginError.textContent = 'Login failed. Please try again.';
      loginError.classList.remove('hidden');
    },
  });
});

// Logout handler
logoutButton.addEventListener('click', () => {
  rciService.logout().subscribe({
    next: () => {
      showLogin();
    },
    error: (err) => {
      console.error('Logout error:', err);
      showLogin();
    },
  });
});

// Load device info
function loadDeviceInfo() {
  infoLoading.classList.remove('hidden');
  infoError.classList.add('hidden');
  infoContent.classList.add('hidden');
  infoError.textContent = '';
  infoContent.textContent = '';

  rciService.execute([{path: 'show.version'}])
    .pipe(
      map((data) => (Array.isArray(data) ? data[0] : data)),
    )
    .subscribe({
      next: (data) => {
        infoLoading.classList.add('hidden');
        infoContent.textContent = JSON.stringify(data, null, 2);
        infoContent.classList.remove('hidden');
      },
      error: (err) => {
        console.error('Failed to get version info:', err);
        infoLoading.classList.add('hidden');

        // If 401 error, redirect to login
        if (err?.status === 401) {
          showLogin();
        } else {
          infoError.textContent = 'Failed to load device info.';
          infoError.classList.remove('hidden');
        }
      },
    });
}

// Initialize app - show login by default
showLogin();
