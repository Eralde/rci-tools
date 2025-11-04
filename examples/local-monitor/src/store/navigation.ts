import {create} from 'zustand';
import type {Device} from '@services';
import {ResultViewerProps} from '@components/ResultViewer';

// All app screens
export type ScreenName =
  | 'MainMenu'
  | 'DevicesTable'
  | 'AcquireDialog'
  | 'ConfirmDeleteDialog'
  | 'EditDeviceNameDialog'
  | 'ResultViewer';

// Maps each ScreenName to required props
interface ScreenPropsMap {
  MainMenu: undefined;
  DevicesTable: undefined;
  AcquireDialog: undefined; // Props managed by component local store
  ConfirmDeleteDialog: {
    device: Device;
  };
  EditDeviceNameDialog: {
    deviceId: string;
    initialName: string;
  };
  ResultViewer: ResultViewerProps;
}

// Single item in the navigation stack.
export type NavigationStackItem = {
  [K in ScreenName]: {
    name: K;
    props: ScreenPropsMap[K];
  };
}[ScreenName];

// The LIFO stack of screens. The last element is the current screen
interface NavigationState {
  stack: NavigationStackItem[];
}

interface NavigationActions {
  // Adds a new screen to the top of the stack
  push<T extends ScreenName>(name: T, props?: ScreenPropsMap[T]): void;
  // Removes the top screen from the stack
  pop(): void;
  // Replaces the top screen on the stack (useful for redirects).
  replace<T extends ScreenName>(name: T, props?: ScreenPropsMap[T]): void;
  // Clears the stack and pushes a single screen (useful for resetting navigation).
  reset<T extends ScreenName>(name: T, props?: ScreenPropsMap[T]): void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>((set) => {
  const initialScreen: NavigationStackItem = {
    name: 'MainMenu',
    props: undefined,
  };

  return {
    stack: [initialScreen],

    push: (name, props) => {
      const newItem = {name, props} as NavigationStackItem;

      set((state) => ({
        stack: [...state.stack, newItem],
      }));
    },

    pop: () => {
      set((state) => {
        if (state.stack.length > 1) {
          const newStack = state.stack.slice(0, -1);
          return {
            stack: newStack,
          };
        }

        // prevents popping the last screen in the stack
        return state;
      });
    },

    replace: (name, props) => {
      const newItem = {name, props} as NavigationStackItem;

      set((state) => {
        const newStack = [...state.stack.slice(0, -1), newItem];
        return {
          stack: newStack,
        };
      });
    },

    reset: (name, props) => {
      const newItem = {name, props} as NavigationStackItem;

      set({
        stack: [newItem],
      });
    },
  };
});
