import {firstValueFrom} from 'rxjs';
import {rciService} from './rci.service';

// DOM elements
const loginView = document.getElementById('login-view')!;
const loginForm = document.querySelector<HTMLFormElement>('#login-form')!;
const usernameInput = document.querySelector<HTMLFormElement>('#username')!;
const passwordInput = document.querySelector<HTMLFormElement>('#password')!;
const loginError = document.getElementById('login-error')!;

const infoView = document.getElementById('info-view')!;
const infoLoading = document.getElementById('info-loading')!;
const infoError = document.getElementById('info-error')!;
const infoContent = document.getElementById('info-content')!;
const logoutButton = document.getElementById('logout-button')!;

const showElements = (...elements: HTMLElement[]): void => {
  elements.forEach((el) => el.classList.remove('hidden'));
};

const hideElements = (...elements: HTMLElement[]): void => {
  elements.forEach((el) => el.classList.add('hidden'));
};

const clearLoginError = (): void => {
  loginError.textContent = '';

  hideElements(loginError);
};

const showLoginError = (message: string): void => {
  loginError.textContent = message;

  showElements(loginError);
};

const showLoginForm = (): void => {
  showElements(loginView);
  hideElements(infoView);
  clearLoginError();

  passwordInput.value = '';
};

const showInfo = async (): Promise<void> => {
  hideElements(loginView);
  showElements(infoView);

  await loadDeviceInfo();
};

loginForm.addEventListener(
  'submit',
  (event) => {
    event.preventDefault();
    clearLoginError();

    const username = usernameInput.value;
    const password = passwordInput.value;

    rciService.login(username, password)
      .subscribe(async (success) => {
        if (success) {
          await showInfo();
        } else {
          showLoginError('Login failed. Please try again.');
        }
      });
  },
);

logoutButton.addEventListener(
  'click',
  () => {
    rciService.logout()
      .subscribe(() => {
        showLoginForm();
      });
  },
);

const loadDeviceInfo = async (): Promise<void> => {
  showElements(infoLoading);
  hideElements(infoError, infoContent);

  infoError.textContent = '';
  infoContent.textContent = '';

  const showVersion = await firstValueFrom(rciService.execute({path: 'show.version'}));

  infoContent.textContent = JSON.stringify(showVersion, null, 2);

  hideElements(infoLoading);
  showElements(infoContent);
};

showLoginForm();
