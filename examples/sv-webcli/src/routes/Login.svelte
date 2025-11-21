<script lang="ts">
import {onMount} from 'svelte';
import {finalize, firstValueFrom} from 'rxjs';
import {rciService} from '../api/rci.service.ts';
import {MAIN_URL, navigate} from '../router';
import {Button} from '../components';

let username = $state('');
let password = $state('');
let errorMessage = $state('');
let deviceName = $state('');
let isLoginInProgress = $state(false);

const handleSubmit = async (event: Event): Promise<void> => {
  event.preventDefault();

  errorMessage = '';
  isLoginInProgress = true;

  rciService.login(username, password)
    .pipe(
      finalize(() => {
        isLoginInProgress = false;
      }),
    )
    .subscribe((success) => {
      if (success) {
        navigate(MAIN_URL);
      } else {
        errorMessage = 'Login failed: Invalid username or password.';
      }
    });
};

onMount(async () => {
  deviceName = await firstValueFrom(rciService.getDeviceName());
});
</script>

<div class="login-container">
  <h1>WebCLI</h1>

  <form
    onsubmit={handleSubmit}
    class="login-form"
  >
    {#if deviceName === ''}
      <div class="loader-overlay">
        <div class="loader-spinner"></div>
      </div>
    {/if}
    <div class="device-name">{deviceName}</div>
    <div class="form-inputs">
      <div class="form-group">
        <label for="username">Username</label>
        <input
          type="text"
          id="username"
          bind:value={username}
          autofocus
          required
        />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          required
        />
      </div>
    </div>

    <div class="login-button-wrapper">
      <Button
        variant="primary"
        size="large"
        type="submit"
        disabled={isLoginInProgress}
      >
        Login
      </Button>
    </div>

    {#if errorMessage}
      <p class="error-message">{errorMessage}</p>
    {/if}
  </form>
</div>

<style>
* {
  font-family: var(--font-mono);
}

.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--color-bg-light-alt);

  h1 {
    color: var(--color-text-primary);
    margin-bottom: var(--space-lg);
  }
}

.login-form {
  background-color: var(--color-bg-white);
  padding: var(--space-3xl);
  border-radius: var(--space-sm);
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 20rem;
  position: relative;

  .device-name {
    font-size: var(--font-size-lg);
    text-align: center;
    margin-bottom: var(--space-3xl);
    min-height: 1lh;
  }

  .form-inputs {
    margin-bottom: var(--space-3xl);
  }

  .form-group {
    margin-bottom: var(--space-2xl);

    label {
      display: block;
      margin-bottom: var(--space-sm);
      font-weight: bold;
      color: var(--color-text-secondary);
    }

    input[type="text"],
    input[type="password"] {
      width: calc(100% - var(--space-xl));
      padding: var(--space-md);
      border: 0.0625rem solid var(--color-border);
      border-radius: var(--space-xs);
      font-size: var(--font-size-base);

      &:focus {
        border-color: var(--color-primary);
        outline: none;
        box-shadow: 0 0 0 0.125rem rgba(0, 123, 255, 0.25);
      }
    }
  }

  .login-button-wrapper {
    width: 100%;

    :global(button) {
      width: 100%;
    }
  }

  .error-message {
    color: var(--color-danger);
    margin-top: var(--space-lg);
    text-align: center;
    font-size: var(--font-size-sm);
  }

  .loader-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-bg-white);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--space-sm);
    z-index: 10;
  }

  .loader-spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 0.25rem solid var(--color-bg-light-active);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
