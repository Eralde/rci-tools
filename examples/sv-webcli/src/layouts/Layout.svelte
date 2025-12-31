<script lang="ts">
import type {Snippet} from 'svelte';
import {onMount} from 'svelte';
import {firstValueFrom, interval, takeUntil} from 'rxjs';
import {LOGIN_URL, navigate} from '../router.ts';
import {deviceService} from '../services';
import {Button, ChartPopover, RrdBarChart} from '../components';
import {shared, stopLogPoller} from '../state/shared.svelte.ts';
import {useDestroy} from '../utils';
import {rciService} from '../api';
import type {RrdTick} from '../api';

let {children}: {children: Snippet} = $props();

const POLL_INTERVAL_MS = 3000; // ms
const MAX_HISTORY_POINTS = 64; // number of bars in a chart

const LOAD_CHART_WIDTH = 60;
const LOAD_CHART_HEIGHT = 16;

const destroy$ = useDestroy();

let hasRrd: boolean = $state(false);
let currentCpuLoad: number = $state(0);
let currentMemoryLoad: number = $state(0);
let cpuLoadHistory: number[] = $state([]);
let memoryLoadHistory: number[] = $state([]);
let txSpeedHistory: RrdTick[] = $state([]);
let currentTxSpeed: number = $state(0);
let rxSpeedHistory: RrdTick[] = $state([]);
let currentRxSpeed: number = $state(0);

let wanIp: string = $state('-');
let isOnline: boolean = $state(false);
let isInternetHovered: boolean = $state(false);

let popoverPosition: {x: number; y: number} = $state({x: 0, y: 0});
let popoverTimeDomain: [Date, Date] | null = $state(null);
let popoverHideTimeout: ReturnType<typeof setTimeout> | null = null;

async function fetchSystemStatus() {
  const monitorData = await firstValueFrom(
    deviceService.getSystemLoadData(MAX_HISTORY_POINTS),
  );

  hasRrd = monitorData.hasRrd;
  currentCpuLoad = monitorData.currentCpuLoad;
  cpuLoadHistory = monitorData.cpuLoadHistory;
  currentMemoryLoad = monitorData.currentMemoryLoad;
  memoryLoadHistory = monitorData.memoryLoadHistory;
}

async function fetchInterfaceStatus() {
  try {
    const interfaceData = await firstValueFrom(
      deviceService.getWanInterfaceData(MAX_HISTORY_POINTS),
    );

    wanIp = interfaceData.address;
    isOnline = Boolean(wanIp);

    txSpeedHistory = interfaceData.txSpeedHistory;
    currentTxSpeed = interfaceData.currentTxSpeed;
    rxSpeedHistory = interfaceData.rxSpeedHistory;
    currentRxSpeed = interfaceData.currentRxSpeed;

    const tList = interfaceData.txSpeedHistory.map((tick) => tick.t);
    const tMin = Math.min(...tList);
    const tMax = Math.max(...tList);

    popoverTimeDomain = [new Date(tMin * 1000), new Date(tMax * 1000)];
  } catch (error) {
    console.error('Failed to fetch interface status:', error);

    txSpeedHistory = [];
    rxSpeedHistory = [];
    wanIp = '-';
    isOnline = false;
    popoverTimeDomain = null;
  }
}

onMount(() => {
  void fetchSystemStatus();
  void fetchInterfaceStatus();

  interval(POLL_INTERVAL_MS)
    .pipe(
      takeUntil(destroy$),
    )
    .subscribe(() => {
      void fetchSystemStatus();
      void fetchInterfaceStatus();
    });

  // start polling log on component mount (only mounts after user logs in)
  const {data$, process} = deviceService.startLogPoller();

  shared.log = [];

  shared.logPollerProcess = process;
  shared.logPollerSubscription = data$.subscribe((v) => {
    shared.log = [...shared.log, ...v];
  });

  return () => {
    // cleanup log poller on unmount
    stopLogPoller();
  };
});

const logout = () => {
  // cleanup log poller on logout
  stopLogPoller();

  rciService.logout()
    .subscribe(() => {
      shared.log = [];
      shared.vendor = null;
      shared.device = null;
      navigate(LOGIN_URL);
    });
};

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) {
    return '0 B/s';
  }

  const kbps = bytesPerSecond / 1024;

  if (kbps < 1024) {
    return `${kbps.toFixed(1)} KB/s`;
  }

  const mbps = kbps / 1024;

  return `${mbps.toFixed(1)} MB/s`;
}

function handleInternetMouseEnter(event: MouseEvent) {
  if (!isOnline) {
    return;
  }

  isInternetHovered = true;

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const POPOVER_WIDTH = 400;
  const POPOVER_HEIGHT = 200;
  const SPACING = 10;

  let x = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;

  if (x < 10) {
    x = 10;
  } else if (x + POPOVER_WIDTH > window.innerWidth - 10) {
    x = window.innerWidth - POPOVER_WIDTH - 10;
  }

  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  let y: number;

  if (spaceAbove >= POPOVER_HEIGHT + SPACING) {
    y = rect.top - POPOVER_HEIGHT - SPACING;
  } else if (spaceBelow >= POPOVER_HEIGHT + SPACING) {
    y = rect.bottom + SPACING;
  } else {
    y = spaceAbove > spaceBelow
      ? Math.max(10, rect.top - POPOVER_HEIGHT - SPACING)
      : Math.min(
        window.innerHeight - POPOVER_HEIGHT - 10,
        rect.bottom + SPACING,
      );
  }

  popoverPosition = {x, y};
}

function handleInternetMouseLeave() {
  popoverHideTimeout = setTimeout(
    () => {
      isInternetHovered = false;
      popoverHideTimeout = null;
    },
    100,
  );
}

function handleInternetPopoverMouseEnter() {
  if (popoverHideTimeout) {
    clearTimeout(popoverHideTimeout);

    popoverHideTimeout = null;
  }
}

function handleInternetPopoverMouseLeave() {
  isInternetHovered = false;
}
</script>

<div class="top-panel">
  <div class="top-panel__left">
    <div class="branding">
      <span class="plaque">WebCLI</span>

      <span class="device-id">
        {#if shared.vendor}{shared.vendor}{/if}
        {#if shared.device}{shared.device}{/if}
      </span>
    </div>
  </div>

  <div class="top-panel__center">
    <div class="monitor-item monitor-item--internet">
      <div class="monitor-item__label">
        Internet:
        <span
          class="status-indicator"
          style="background-color: {isOnline ? 'green' : 'red'};"
          title={isOnline ? 'Online' : 'Offline'}
        >
        </span>
        <span class="wan-ip">{wanIp}</span>
      </div>
    </div>

    <div
      class="monitor-item monitor-item--tx-rx"
      role="button"
      tabindex="0"
      onmouseenter={handleInternetMouseEnter}
      onmouseleave={handleInternetMouseLeave}
    >
      <div class="monitor-item__label">
        TX: {formatSpeed(currentRxSpeed)} / RX {formatSpeed(currentTxSpeed)}
      </div>
    </div>

    {#if isInternetHovered && isOnline && popoverTimeDomain}
      <div
        class="chart-popover-container"
        role="dialog"
        tabindex="0"
        aria-label="Network traffic chart"
        style="position: fixed; left: {popoverPosition.x}px; top: {popoverPosition.y}px; z-index: 10000;"
        onmouseenter={handleInternetPopoverMouseEnter}
        onmouseleave={handleInternetPopoverMouseLeave}
      >
        <div class="chart-popover-wrapper">
          <ChartPopover
            barCount={MAX_HISTORY_POINTS}
            timeDomain={popoverTimeDomain}
            series={[
              {data: txSpeedHistory, color: 'blue', label: 'TX'},
              {data: rxSpeedHistory, color: 'red', label: 'RX'},
            ]}
          />
        </div>
      </div>
    {/if}

    {#if hasRrd}
      <div class="monitor-item monitor-item--rrd">
        <div class="monitor-item__chart">
          <div class="monitor-item__label">
            CPU: {currentCpuLoad.toFixed(0)}%
          </div>

          <RrdBarChart
            data={cpuLoadHistory}
            color="steelblue"
            width={LOAD_CHART_WIDTH}
            height={LOAD_CHART_HEIGHT}
            barCount={MAX_HISTORY_POINTS}
          />
        </div>

        <div class="monitor-item__chart">
          <div class="monitor-item__label">
            RAM: {currentMemoryLoad.toFixed(0)}%
          </div>

          <RrdBarChart
            data={memoryLoadHistory}
            color="seagreen"
            width={LOAD_CHART_WIDTH}
            height={LOAD_CHART_HEIGHT}
            barCount={MAX_HISTORY_POINTS}
          />
        </div>
      </div>
    {/if}
  </div>

  <div class="top-panel__right">
    <Button
      variant="primary"
      size="small"
      onclick={logout}
    >
      Logout
    </Button>
  </div>
</div>

<main>
  {@render children()}
</main>

<style>
.top-panel {
  top: 0;
  left: 0;
  height: var(--top-panel-height);
  background-color: var(--color-bg-dark);
  color: var(--color-text-white);
  display: flex;
  align-items: center;
  padding: 0 var(--space-sm);
  box-shadow: 0 0.125rem 0.3125rem rgba(0, 0, 0, 0.2);
  z-index: 1000;
  user-select: none;
  font-family: monospace;

  &::selection {
    background: none;
  }
}

.top-panel__left {
  margin-left: 0;
}

.top-panel__center {
  flex-grow: 1;
  display: flex;
  justify-content: space-evenly;
}

.top-panel__right {
  margin-right: 0;
}

.branding {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  font-family: var(--font-serif), serif;
}

.plaque {
  background-color: var(--color-bg-plaque);
  color: var(--color-text-dark);
  padding: var(--space-xs) var(--space-sm);
  font-weight: 600;
  letter-spacing: 0.02rem;
}

.device-id {
  opacity: 0.9;
}

.monitor-item {
  display: flex;
  align-items: center;
}

.monitor-item__chart {
  display: flex;
  align-items: center;
}

.monitor-item__label {
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.monitor-item--internet {
  .status-indicator {
    display: inline-block;
    width: 0.75em;
    height: 0.75em;
    border-radius: 50%;
    margin: 0 0.5em;
    vertical-align: middle;
  }
}

.monitor-item--tx-rx {
  width: 28ch;
}

.monitor-item--rrd {
  flex-shrink: 0;
  gap: var(--space-xl);

  .monitor-item__label {
    width: 9ch;
  }
}

.chart-popover-container {
  pointer-events: auto;
}

.chart-popover-wrapper {
  pointer-events: auto;
}


main {
  height: calc(100vh - var(--top-panel-height));
  width: 100%;
  overflow: auto;
}
</style>
