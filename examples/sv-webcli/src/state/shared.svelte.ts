import type {DockviewApi} from 'dockview-core';
import type {RciBackgroundProcess} from '@rci-tools/core';
import type {Subscription} from 'rxjs';
import {LogItem} from '../api';

interface SharedState {
  log: LogItem[];
  dockviewApi: DockviewApi | null;
  isLogVisible: boolean;
  vendor: string | null;
  device: string | null;
  logPollerSubscription: Subscription | null;
  logPollerProcess: RciBackgroundProcess | null;
}

export const LOG_PANEL_ID = 'log-panel';
export const CLI_PANEL_ID = 'cli-terminal-panel';
export const HTTP_API_PANEL_ID = 'http-rest-api';

const LAYOUT_STORAGE_KEY = 'dockview-layout';

export const shared = $state<SharedState>({
  log: [],
  dockviewApi: null,
  isLogVisible: false,
  vendor: null,
  device: null,
  logPollerSubscription: null,
  logPollerProcess: null,
});

export const saveLayout = (): void => {
  try {
    const api = shared.dockviewApi;

    if (!api) {
      throw new Error('Unable to get DockviewApi ref');
    }

    const layout = api.toJSON();

    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch (error) {
    console.error(`Failed to save dockview layout:`, error);
  }
};

export const isLayoutSaved = (): boolean => {
  return Boolean(localStorage.getItem(LAYOUT_STORAGE_KEY));
};

export const loadLayout = (): boolean => {
  try {
    const api = shared.dockviewApi;

    if (!api) {
      throw new Error('Unable to get DockviewApi ref');
    }

    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);

    if (savedLayout) {
      const parsedLayout = JSON.parse(savedLayout);

      api.fromJSON(parsedLayout);

      shared.isLogVisible = Boolean(api.getPanel(LOG_PANEL_ID));

      return true;
    }

    return false;
  } catch (error) {
    console.error(`Failed to load dockview layout:`, error);

    return false;
  }
};

export const clearDockviewLayout = (): void => {
  localStorage.removeItem(LAYOUT_STORAGE_KEY);
};

export const stopLogPoller = (): void => {
  if (shared.logPollerSubscription) {
    shared.logPollerSubscription.unsubscribe();

    shared.logPollerSubscription = null;
  }

  if (shared.logPollerProcess) {
    shared.logPollerProcess.abort();

    shared.logPollerProcess = null;
  }
};
