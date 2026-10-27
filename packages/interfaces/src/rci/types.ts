import type {NdmNetworkRole} from './constants';
import type {NO_COMMAND_TYPE} from './no-command';
import type {ExclusiveOr, RequireAtLeastOneProp, RequireExactlyOneOf} from './type.utils';

// The types below are trimmed copies of the corresponding ndw3 API types (`@api/*`):
// only the fields `model` actually reads. They are compared by shape, so the API types
// stay assignable to them (and vice versa for the "both directions" types).

// --- `interface <name> ipv6`

export type Ipv6AddressValue = RequireExactlyOneOf<[
  {address: string},
  {block: string},
  {auto: boolean},
]>;

export type Ipv6PrefixValue = ExclusiveOr<{prefix: string}, {auto: boolean}>;

export interface Ipv6NameServerValue {
  'name-server': string;
  'port': string;
}

export interface CurrentIpv6Address {
  'address': string;
  'prefix-length': number;
  'proto': string;
  'valid-lifetime': string;
}

// --- `interface <name> include`

export type InterfaceIncludeType<RemoveCommand = never> = {interface: string} & Partial<RemoveCommand>;

// --- Interlayer (`ipoe` / `ipvc` / `iseg`) configurations

export interface InterfaceIpoeConfiguration {
  'inet-port': string;
  'inet-vlan': string;
  'iptv-port': string;
  'iptv-vlan': string;
  'voip-port': string;
  'voip-vlan': string;
}

export interface InterfaceIpoeReadConfiguration extends InterfaceIpoeConfiguration {
  'free-port': string; // run-time info
  'busy-vlan': string; // run-time info
}

export interface InterfaceIpvcConfiguration {
  'role': NdmNetworkRole;
  'port': string;
  'vpi': string;
  'vci': string;
  'encapsulation': string;
  'vlan': string;
  'pvc-vlan': boolean;
}

export interface InterfaceIpvcReadConfiguration extends InterfaceIpvcConfiguration {
  'bridge': string;
  'free-port': string;
  'busy-pvc': string;
  'busy-vlan': string;
}

export interface InterfaceIsegConfiguration {
  'include': string;
  'port': string;
  'vlan': string;
  'vlan-port': string;
}

// --- `show interface`

export type NdmLayerName =
  | 'conf'
  | 'link'
  | 'ctrl'
  | 'ipv4'
  | 'ipv6';

export type NdmLayerStatus =
  | 'detached'
  | 'disabled'
  | 'pending'
  | 'connecting'
  | 'running';

export interface NdmDetailsItem {
  'layer': NdmLayerName;
  'status': NdmLayerStatus;
  'age': number;
  'reason'?: string;
  'stage'?: string;
  'last-fail'?: string;
  'remaining'?: number;
}

export type InterfaceLayerSummary = Record<NdmLayerName, NdmLayerStatus>;
export type InterfaceStatusDetails = Record<string, NdmDetailsItem>;

export interface InterfacePendingBlock {
  interface: string;
  reason: InterfaceStatusDetails;
}

export interface GenericInterfaceStatus {
  'id': string;
  'index': number;
  'type': string;
  'interface-name': string;
  'link': 'up' | 'down';
  'description'?: string;
  'summary': {layer: InterfaceLayerSummary};
  'details'?: InterfaceStatusDetails;
  'pending'?: InterfacePendingBlock;
}

// `conflict` from the `ip` trait of the interface status
export interface IpConflictInfo {
  interface: string;
  address: string;
  mask: string;
  elapsed: number;
}

// The minimal part of a translation service used by `model` (e.g., `TranslateService` from `@ngx-translate/core`)
export interface ModelTranslator {
  instant(key: string, params?: Record<string, unknown>): string;
}

export interface WepKeyConfiguration {
  hex: string;
  id: number;
  default?: boolean;
  no?: boolean;
}

export interface WifiAuthenticationWriteType {
  'wpa-psk'?: ExclusiveOr<{psk: string}, NO_COMMAND_TYPE>;
}

interface WifiEncryptionConfiguration {
  enable?: boolean | NO_COMMAND_TYPE;
  wpa?: boolean | NO_COMMAND_TYPE;
  wpa2?: boolean | NO_COMMAND_TYPE;
  wpa3?: boolean | NO_COMMAND_TYPE | {'enable': boolean; 'suite-b': true};
  key?: WepKeyConfiguration[];
  owe?: boolean | NO_COMMAND_TYPE;
}

export type WifiEncryptionWriteConfigurationType = RequireAtLeastOneProp<WifiEncryptionConfiguration>;

// Subset of the access point / wifi station read configuration used to detect encryption
export interface WifiInterfaceReadConfiguration {
  encryption?: {
    enable?: boolean;
    wpa?: boolean;
    wpa2?: boolean;
    wpa3?: boolean | {'enable': boolean; 'suite-b': true};
    owe?: boolean;
    key?: WepKeyConfiguration[];
  };
  authentication?: {'wpa-psk'?: {psk: string}};
}
