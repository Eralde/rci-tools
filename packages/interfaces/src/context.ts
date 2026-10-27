import * as _ from 'lodash-es';

export interface ModelLogger {
  info(message: string, ...data: unknown[]): void;
  warning(message: string, ...data: unknown[]): void;
  error(message: string, ...data: unknown[]): void;
}

export interface ModelConstants {
  MASTER: string;
  WAN: string;
  WAN_DESCRIPTION: string;
  LAN_DESCRIPTION: string;
  GUEST: string;
  GUEST_DESCRIPTION: string;
  INTERNAL_LTE_DESCRIPTION: string;
  DSL_ALWAYS_PRESENT?: boolean;
  HOME_SEGMENT_ID?: string; // 'Bridge0' by default
}

// Device data in the same form the device provides it (`show version`, ndm constants)
export interface RuntimeInput {
  mode: string;
  components: Record<string, boolean>;
  features: Record<string, boolean>;
  constants: ModelConstants;
}

// What entities, traits, fields and status processors get.
// Device data is read from the runtime provider on every access (no snapshot).
export interface ModelContext extends Readonly<Required<ModelConstants>> {
  readonly logger: ModelLogger;
  hasFeature(name: string): boolean;
  isComponentInstalled(name: string): boolean;
  isInRouterMode(): boolean;
  isDslDevice(): boolean;
  getParentDslInterface(): string;
}

// Feature names known to `model` (device features are plain strings)
export const KNOWN_FEATURE = {
  WPA3: 'wpa3',
} as const;

export const DEFAULT_HOME_SEGMENT_ID = 'Bridge0';

const ROUTER_MODE = 'router';
const COMPONENT_DSL = 'dsl';
const COMPONENT_USBDSL = 'usbdsl';

export const createModelContext = (runtime: () => RuntimeInput, logger: ModelLogger): ModelContext => {
  const isComponentInstalled = (name: string): boolean => {
    return Boolean(_.get(runtime().components, name.toLowerCase()));
  };

  const constant = <K extends keyof ModelConstants>(key: K): ModelConstants[K] => runtime().constants[key];

  return {
    logger,
    get MASTER() {
      return constant('MASTER');
    },
    get WAN() {
      return constant('WAN');
    },
    get WAN_DESCRIPTION() {
      return constant('WAN_DESCRIPTION');
    },
    get LAN_DESCRIPTION() {
      return constant('LAN_DESCRIPTION');
    },
    get GUEST() {
      return constant('GUEST');
    },
    get GUEST_DESCRIPTION() {
      return constant('GUEST_DESCRIPTION');
    },
    get INTERNAL_LTE_DESCRIPTION() {
      return constant('INTERNAL_LTE_DESCRIPTION');
    },
    get DSL_ALWAYS_PRESENT() {
      return Boolean(constant('DSL_ALWAYS_PRESENT'));
    },
    get HOME_SEGMENT_ID() {
      return constant('HOME_SEGMENT_ID') ?? DEFAULT_HOME_SEGMENT_ID;
    },
    hasFeature: (name) => Boolean(_.get(runtime().features, name)),
    isComponentInstalled,
    isInRouterMode: () => runtime().mode === ROUTER_MODE,
    isDslDevice: () => {
      return Boolean(constant('DSL_ALWAYS_PRESENT'))
        || isComponentInstalled(COMPONENT_DSL)
        || isComponentInstalled(COMPONENT_USBDSL);
    },
    getParentDslInterface: () => isComponentInstalled(COMPONENT_USBDSL) ? 'UsbDsl0' : 'Dsl0',
  };
};
