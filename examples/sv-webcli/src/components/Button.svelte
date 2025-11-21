<script lang="ts">
import type {Snippet} from 'svelte';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'regular' | 'small' | 'large';

let {
  variant = 'primary' satisfies ButtonVariant,
  size = 'regular' satisfies ButtonSize,
  children,
  type = 'button',
  ...restProps
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: Snippet;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: unknown;
} = $props();
</script>

<button
  class="button"
  class:button--primary={variant === 'primary'}
  class:button--secondary={variant === 'secondary'}
  class:button--danger={variant === 'danger'}
  class:button--regular={size === 'regular'}
  class:button--small={size === 'small'}
  class:button--large={size === 'large'}
  type={type}
  {...restProps}
>
  {@render children()}
</button>

<style>
.button {
  border: none;
  border-radius: var(--space-xs);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.button--primary {
  background-color: var(--color-primary);
  color: var(--color-text-white);
  border: 1px solid var(--color-primary);

  &:hover:not(:disabled) {
    background-color: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
  }

  &:active:not(:disabled) {
    background-color: var(--color-primary-darker);
    border-color: var(--color-primary-darker);
  }
}

.button--secondary {
  background-color: var(--color-bg-white);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);

  &:hover:not(:disabled) {
    background-color: var(--color-bg-light-alt);
    border-color: var(--color-border-dark);
  }

  &:active:not(:disabled) {
    background-color: var(--color-bg-light-active);
  }
}

.button--danger {
  background-color: var(--color-danger);
  color: var(--color-text-white);
  border: 1px solid var(--color-danger);

  &:hover:not(:disabled) {
    background-color: var(--color-danger-dark);
    border-color: var(--color-danger-dark);
  }

  &:active:not(:disabled) {
    background-color: #a71e2a;
    border-color: #a71e2a;
  }
}

.button--regular {
  font-size: var(--button-font-regular);
  padding: var(--button-padding-regular);
}

.button--small {
  font-size: var(--button-font-small);
  padding: var(--button-padding-small);
}

.button--large {
  font-size: var(--button-font-large);
  padding: var(--button-padding-large);
}
</style>
