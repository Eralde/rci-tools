<script lang="ts">
import FilterSvg from '../assets/filter.svg?raw';
import DownloadSvg from '../assets/download.svg?raw';
import {shared} from '../state/shared.svelte.ts';
import {onDestroy, onMount, tick} from 'svelte';
import {LOG_ITEM_LEVEL, SystemLogClearService, rciService} from '../api/';
import {Button, ConfirmDialog, TogglableButtons} from './index.ts';

let logContentContainer: HTMLElement;
let autoScrollEnabled = true;

let isHeaderCollapsed = $state(true);
let logLevelButtonsWrapper: HTMLElement;
let showFullLabels = $state(false);

const toggleHeader = () => {
  isHeaderCollapsed = !isHeaderCollapsed;
};

function handleScroll() {
  const threshold = 50; // px

  if (!logContentContainer) {
    return;
  }

  const distanceFromBottom = logContentContainer.scrollHeight
    - logContentContainer.scrollTop
    - logContentContainer.clientHeight;

  autoScrollEnabled = distanceFromBottom < threshold;
}

async function scrollToEnd() {
  await tick();

  if (logContentContainer && autoScrollEnabled) {
    logContentContainer.scroll({
      top: logContentContainer.scrollHeight,
      behavior: 'smooth',
    });
  }
}

onMount(() => {
  scrollToEnd();
  logContentContainer?.addEventListener('scroll', handleScroll);
});

onDestroy(() => {
  logContentContainer?.removeEventListener('scroll', handleScroll);
});

// show full/short labels for log level buttons based on container width
$effect(() => {
  if (!isHeaderCollapsed && logLevelButtonsWrapper) {
    const THRESHOLD = 320;

    // initial value
    showFullLabels = logLevelButtonsWrapper.offsetWidth >= THRESHOLD;

    // observe size changes
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;

      showFullLabels = width >= THRESHOLD;
    });

    resizeObserver.observe(logLevelButtonsWrapper);

    return () => resizeObserver.disconnect();
  } else {
    showFullLabels = false;
  }
});

$effect(() => {
  void scrollToEnd();
});

const logLevelOptions = Object.values(LOG_ITEM_LEVEL)
  .map(level => {
    return {
      value: level,
      label: level,
    };
  });

let activeLogLevels: string[] = $state(logLevelOptions.map(opt => opt.value)); // all active by default
let substringFilter: string = $state('');
let showClearDialog = $state(false);

const systemLogClearService = new SystemLogClearService(rciService);

const lowerCaseActiveLogLevels = $derived(
  activeLogLevels.map(level => level.toLowerCase()),
);

const filteredLog = $derived(() => {
  return shared.log.filter(item => {
    const levelMatch = lowerCaseActiveLogLevels.includes(
      item.message.level.toLowerCase(),
    );

    if (!levelMatch) {
      return false;
    }

    if (!substringFilter) {
      return true;
    }

    const filter = substringFilter.toLowerCase();

    return item.ident.toLowerCase().includes(filter)
      || item.message.message.toLowerCase().includes(filter);
  });
});

const highlightMatch = (text: string, filter: string): string => {
  if (!filter) {
    return text;
  }

  const escaped = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  return text.replace(regex, '<span class="highlight">$1</span>');
};

// trigger `scrollToEnd` when `filteredLog` changes
$effect(() => {
  filteredLog() && void scrollToEnd();
});

const handleClearClick = () => {
  showClearDialog = true;
};

const handleDownloadLog = () => {
  window.open('/ci/log.txt');
};

const handleClearConfirm = () => {
  systemLogClearService.perform().subscribe({
    next: () => {
      shared.log = [];
    },
    error: (error) => {
      console.error('Failed to clear log:', error);
    },
  });
};

const handleClearCancel = () => {
  // noop; dialog will close automatically
};
</script>

<div class="container">
  <div class="log-header">
    <div class="log-filters-block" class:collapsed={isHeaderCollapsed}>
      <Button
        variant="secondary"
        size="small"
        onclick={toggleHeader}
        title={isHeaderCollapsed ? 'Show filters' : 'Hide filters'}
      >
        <span class="filter-icon">{@html FilterSvg}</span>
        <span class="chevron">{isHeaderCollapsed ? '>' : '<'}</span>
      </Button>
      {#if !isHeaderCollapsed}
        <div class="log-filters">
          <input
            class="log-substring-filter"
            type="text"
            placeholder="Filter by substring"
            bind:value={substringFilter}
          />

          <div
            bind:this={logLevelButtonsWrapper}
            class="log-level-buttons-wrapper"
          >
            <TogglableButtons
              options={logLevelOptions}
              bind:activeOptions={activeLogLevels}
              showFullLabels={showFullLabels}
              optionColors={new Map([
                [LOG_ITEM_LEVEL.INFO, 'var(--color-log-info)'],
                [LOG_ITEM_LEVEL.WARNING, 'var(--color-log-warning)'],
                [LOG_ITEM_LEVEL.ERROR, 'var(--color-log-error)'],
                [
                  LOG_ITEM_LEVEL.CRITICAL,
                  'var(--color-log-critical)',
                ],
                [LOG_ITEM_LEVEL.DEBUG, 'var(--color-log-debug)'],
              ])}
            />
          </div>
        </div>
      {/if}
    </div>

    <div class="log-buttons">
      <Button
        variant="secondary"
        size="small"
        onclick={handleDownloadLog}
        title="Download log"
      >
        {@html DownloadSvg}
      </Button>

      <Button
        variant="danger"
        size="small"
        onclick={handleClearClick}
        title="Clear log"
      >
        Clear
      </Button>
    </div>
  </div>

  <div bind:this={logContentContainer} class="log-content">
    {#each filteredLog() as item}
      <div
        class="log-item"
        class:log-level-info={item.message.level === LOG_ITEM_LEVEL.INFO}
        class:log-level-warning={item.message.level === LOG_ITEM_LEVEL.WARNING}
        class:log-level-error={item.message.level === LOG_ITEM_LEVEL.ERROR}
        class:log-level-critical={item.message.level === LOG_ITEM_LEVEL.CRITICAL}
        class:log-level-debug={item.message.level === LOG_ITEM_LEVEL.DEBUG}
      >
        <div class="timestamp">
          {item.timestamp}
        </div>

        <div class="ident">
          {@html highlightMatch(item.ident, substringFilter)}
        </div>

        <div class="message">
          {@html highlightMatch(item.message.message, substringFilter)}
        </div>
      </div>
    {/each}
  </div>
</div>

<ConfirmDialog
  bind:open={showClearDialog}
  message="Are you sure you want to clear the log? This action cannot be undone."
  confirmLabel="Clear"
  cancelLabel="Cancel"
  onConfirm={handleClearConfirm}
  onCancel={handleClearCancel}
/>

<style>
.container {
  background: var(--color-bg-light);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-header {
  position: sticky;
  top: 0;
  background-color: var(--color-bg-white);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-light);
  z-index: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.filter-icon {
  display: flex;
  align-items: center;
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.filter-icon :global(svg) {
  width: 100%;
  height: 100%;
}

.log-filters-block {
  display: flex;
  align-items: center;
  min-height: var(--space-3xl);
  gap: var(--space-sm);
  overflow: hidden;
  flex: 1;
  flex-wrap: wrap;
}

.log-filters {
  flex-grow: 1;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  max-height: 100px;
  opacity: 1;
  overflow: hidden;
  transition: max-height 0.2s ease-out, opacity 0.2s ease-out, margin 0.2s ease-out;
  margin: 0;
  flex-wrap: wrap;
  container-type: inline-size;
  container-name: log-filters;
}

.log-level-buttons-wrapper {
  display: flex;
  flex-grow: 1;
  min-width: 150px;
}

.log-substring-filter {
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: calc(var(--space-xs) / 2);
  min-width: 7.5rem;
}

.log-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.log-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0 var(--space-lg) var(--space-lg) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.log-item {
  display: flex;
  flex-direction: row;
  font-family: var(--font-mono), serif;
  font-size: var(--font-size-xs);
}

.log-item.log-level-info {
  color: var(--color-log-info);
}

.log-item.log-level-warning {
  color: var(--color-log-warning);
}

.log-item.log-level-error {
  color: var(--color-log-error);
}

.log-item.log-level-critical {
  color: var(--color-log-critical);
}

.log-item.log-level-debug {
  color: var(--color-log-debug);
}

.log-item .timestamp {
  flex-shrink: 0;
  width: 20ch;
}

.log-item .ident {
  flex-shrink: 0;
  width: 16ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-item .message {
  flex-grow: 1;
}

.log-item :global(.highlight) {
  background-color: var(--color-highlight);
  color: var(--color-text-black);
  font-weight: bold;
  border-radius: var(--space-xs);
}
</style>
