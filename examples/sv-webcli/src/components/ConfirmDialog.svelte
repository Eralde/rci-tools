<script lang="ts">
import {Button} from './index.ts';

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

let {
  open = $bindable(false),
  title = '',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props & {open?: boolean} = $props();

const handleConfirm = () => {
  onConfirm();
  open = false;
};

const handleCancel = () => {
  onCancel();
  open = false;
};

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    handleCancel();
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleCancel();
  }
};
</script>

{#if open}
  <div
    class="dialog-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeyDown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
    tabindex="-1"
  >
    <div class="dialog-container">
      {#if title}
        <div class="dialog-header">
          <h3 id="dialog-title" class="dialog-title">{title}</h3>
        </div>
      {/if}
      <div class="dialog-body">
        <p class="dialog-message">{message}</p>
      </div>
      <div class="dialog-footer">
        <Button
          variant="secondary"
          size="regular"
          onclick={handleCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          size="regular"
          onclick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-container {
  background-color: var(--color-bg-white);
  border-radius: var(--space-xs);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  max-width: 500px;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.dialog-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: bold;
  color: var(--color-text-primary);
}

.dialog-body {
  padding: var(--space-lg);
}

.dialog-message {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.dialog-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
}
</style>
