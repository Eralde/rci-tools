<script lang="ts">
import {onDestroy, onMount} from 'svelte';
import {Subscription} from 'rxjs';
import {
  type DockviewApi,
  type DockviewIDisposable,
  type IContentRenderer,
  type IDockviewPanel,
  type ITabRenderer,
  createDockview,
  themeLight,
} from 'dockview-core';
import 'dockview-core/dist/styles/dockview.css';
import LogSvg from '../assets/log.svg?raw';
import {
  LogRenderer,
  PersistentTabRenderer,
  RestApiRenderer,
  TerminalWrapperRenderer,
} from '../components/renderers';
import {deviceService} from '../services/';
import {
  CLI_PANEL_ID,
  HTTP_API_PANEL_ID,
  LOG_PANEL_ID,
  isLayoutSaved,
  loadLayout,
  saveLayout,
  shared,
} from '../state/shared.svelte.ts';

let dockviewContainer: HTMLDivElement;
let dockviewApi: DockviewApi;
let layoutDisposables: DockviewIDisposable[] = $state([]);

const createComponentFactory = (options: any): IContentRenderer => {
  switch (options.name) {
    case 'restApi':
      return new RestApiRenderer();
    case 'log':
      return new LogRenderer();
    case 'terminalWrapper':
      return new TerminalWrapperRenderer();
    default:
      throw new Error(`Component '${options.name}' not found`);
  }
};

const createTabFactory = (options: any): ITabRenderer => {
  switch (options.name) {
    case 'persistentTab':
      return new PersistentTabRenderer();
    default:
      throw new Error(`Tab '${options.name}' not found`);
  }
};

const lockPanelGroup = (panel?: IDockviewPanel): void => {
  if (!panel) {
    return;
  }

  // Using 'no-drop-target' prevents all drag-and-drop operations and closing
  const group = panel.group;

  group.locked = 'no-drop-target';
};

const toggleLogPanel = (): void => {
  if (!dockviewApi) {
    return;
  }

  const panel = dockviewApi.getPanel(LOG_PANEL_ID);

  if (panel) {
    dockviewApi.removePanel(panel);

    shared.isLogVisible = false;
  } else {
    const initialWidth = Math.round(window.innerWidth * 0.4); // default width: 40%

    const logPanel = dockviewApi.addPanel({
      id: LOG_PANEL_ID,
      component: 'log',
      title: 'Log',
      initialWidth,
      minimumWidth: 360,
      position: {direction: 'right'},
    });

    lockPanelGroup(logPanel);

    shared.isLogVisible = true;
  }
};

onMount(() => {
  dockviewApi = createDockview(
    dockviewContainer,
    {
      theme: themeLight,
      createComponent: createComponentFactory,
      createTabComponent: createTabFactory,
      disableFloatingGroups: true,
    },
  );

  shared.dockviewApi = dockviewApi;

  if (!isLayoutSaved()) {
    // default layout
    if (dockviewApi.panels.length === 0) {
      const cliPanel = dockviewApi.addPanel({
        id: CLI_PANEL_ID,
        title: 'Terminal session',
        component: 'terminalWrapper',
        tabComponent: 'persistentTab',
      });

      dockviewApi.addPanel({
        id: HTTP_API_PANEL_ID,
        component: 'restApi',
        title: 'REST API',
        tabComponent: 'persistentTab',
      });

      lockPanelGroup(cliPanel);
    }
  } else {
    loadLayout();

    const cliPanel = dockviewApi.getPanel(CLI_PANEL_ID);

    lockPanelGroup(cliPanel);
  }

  layoutDisposables.push(
    dockviewApi.onDidLayoutChange(() => saveLayout()),
    dockviewApi.onDidRemovePanel((event) => {
      if (event.id === LOG_PANEL_ID) {
        shared.isLogVisible = false;
      }
    }),
  );

  return () => {
    saveLayout();
    dockviewApi.dispose();

    for (const disposable of layoutDisposables) {
      disposable.dispose();
    }
  };
});

const onLogToggleClick = () => {
  toggleLogPanel();
};

$effect(() => {
  const sub: Subscription = deviceService.getLog()
    .subscribe((v) => {
      shared.log = [...shared.log, ...v];
    });

  onDestroy(() => sub.unsubscribe());
});
</script>

<div class="dockview-wrapper">
  <div
    bind:this={dockviewContainer}
    class="dockview-container"
  >
  </div>
  {#if !shared.isLogVisible}
    <button
      class="log-toggle-button"
      onclick={onLogToggleClick}
    >
      {@html LogSvg}
    </button>
  {/if}
</div>

<style>
* {
  font-family: monospace, sans-serif;
  font-weight: bold;
}

.dockview-wrapper {
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
}

.dockview-container {
  width: 100%;
  height: 100%;
  flex-grow: 1;
}

.log-toggle-button {
  --button-size: 35px; /* dockview tab panel height */
  --icon-size: 32px;
  --padding: calc((var(--button-size) - var(--icon-size)) / 2);

  background-color: var(--button-bg-color, var(--color-bg-light-active));
  border: 1px solid var(--button-border-color, var(--color-border));
  position: absolute;
  right: 0;
  padding: var(--padding);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  width: var(--button-size);
  height: var(--button-size);
  flex-shrink: 0;

  &:hover {
    background-color: var(--button-hover-bg-color, var(--color-bg-light-active));
  }
}
</style>
