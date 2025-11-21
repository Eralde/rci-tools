<script lang="ts">
import {onDestroy} from 'svelte';
import type {Subscription} from 'rxjs';
import {Button, Terminal} from './index.ts';
import type {TerminalInstance} from '../services/cli.service.ts';

interface Props {
  onTerminalReady?: (instance: TerminalInstance) => void;
}

let {onTerminalReady}: Props = $props();

let isStarted = $state(false);
let closeSubscription: Subscription | null = null;

const handleStart = (): void => {
  isStarted = true;
};

const handleTerminalReady = (instance: TerminalInstance): void => {
  if (onTerminalReady) {
    onTerminalReady(instance);
  }

  closeSubscription = instance.onClose
    .subscribe(() => {
      isStarted = false;
    });
};

onDestroy(() => {
  if (closeSubscription) {
    closeSubscription.unsubscribe();
  }
});
</script>

{#if !isStarted}
  <div class="start-container">
    <Button
      variant="primary"
      size="large"
      onclick={handleStart}
    >
      Start
    </Button>
  </div>
{:else}
  <Terminal onTerminalReady={handleTerminalReady} />
{/if}

<style>
.start-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
