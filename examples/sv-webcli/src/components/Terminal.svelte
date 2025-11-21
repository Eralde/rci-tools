<script lang="ts">
import {onMount} from 'svelte';
import {firstValueFrom, timer} from 'rxjs';
import {
  type TerminalInstance,
  connectToCli,
  spawnCli,
} from '../services/cli.service.ts';

interface Props {
  onTerminalReady?: (instance: TerminalInstance) => void;
}

let {onTerminalReady}: Props = $props();

onMount(() => {
  const element = document.querySelector('div#terminal') as HTMLDivElement;

  if (!element) {
    return;
  }

  let terminalInstance: TerminalInstance | null = null;

  void (async () => {
    await spawnCli();
    await firstValueFrom(timer(1000));

    terminalInstance = connectToCli(element);

    if (onTerminalReady) {
      onTerminalReady(terminalInstance);
    }
  })();

  return () => {
    if (terminalInstance) {
      terminalInstance.dispose();
    }
  };
});
</script>

<div id="terminal"></div>

<style>
#terminal {
  width: 100%;
  height: 100%;
}
</style>
