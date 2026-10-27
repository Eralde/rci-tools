import type {ModelContext} from '../context';
import {
  type GenericInterfaceStatus,
  type GenericObject,
  type InterfaceStatusDetails,
  type IpConflictInfo,
  type NdmDetailsItem,
  type NdmLayerName,
  type NdmLayerStatus,
  type RequireExactlyOneOf,
  type Values,
} from '../rci';

export const STATUS_TYPE = {
  SUCCESS: 'SUCCESS',
  INFO: 'INFO',
  WARNING: 'WARNING',
  SPECIAL: 'SPECIAL',
} as const;

export type StatusType = Values<typeof STATUS_TYPE>;

export interface GenericStatus {
  statusL10n: string;
  type: StatusType;
}

export type EntityStatusKind = NdmLayerStatus | 'unknown';

export const ENTITY_STATUS = {
  // -- [ENTITY_STATUS_KIND.UNKNOWN] --
  // the 'summary' or 'details' property is missing from the `show interface` output
  // for the interface or the status processor could not determine the status
  UNKNOWN: 'UNKNOWN',

  // -- [ENTITY_STATUS_KIND.DETACHED] --
  // a USB device is unplugged
  UNPLUGGED: 'UNPLUGGED',
  USB_POWER_DOWN: 'USB_POWER_DOWN', // USB port power is off
  REBOOTING: 'REBOOTING', // special version of UNPLUGGED for an internal 4G modem

  // -- [ENTITY_STATUS_KIND.DISABLED] --
  // the interface is down
  DISABLED: 'DISABLED',

  // or a schedule is assigned and is suspending the interface
  DISABLED_ON_SCHEDULE: 'DISABLED_ON_SCHEDULE',

  // or some external mechanism is disabling the interface
  DISABLED_VIA_MWS: 'DISABLED_VIA_MWS', // MWS auto-shutdown is enabled and controller is unreachable:

  // -- [ENTITY_STATUS_KIND.PENDING] --
  // a required part of the interface configuration is missing
  // (e.g. `peer` for PPTP)
  UNCONFIGURED: 'UNCONFIGURED',

  // auth credentials (username/password/...) are invalid
  FAIL_AUTH: 'FAIL_AUTH',

  // peer lookup failed
  FAIL_PPP_RESOLVE: 'FAIL_PPP_RESOLVE',

  // `pppd` failure for any reason other
  // than invalid authentication credentials
  FAIL_PPP: 'FAIL_PPP',

  // interface configured as “connect via” is not running.
  FAIL_VIA: 'FAIL_VIA',

  FAIL_LINK: 'FAIL_LINK',

  // Ethernet port is switched off
  FAIL_PORT_DISABLED: 'FAIL_PORT_DISABLED',

  // no IPv4 address via DHCP/IPCP/...,
  // no manually configured IPv4 address
  NO_IPV4: 'NO_IPV4',

  IPV4_CONFLICT: 'IPV4_CONFLICT',

  // some external mechanism detects that the connection
  // has no Internet access
  PING_CHECK_FAILURE: 'PING_CHECK_FAILURE',

  // any reason for the `ipv4: "pending"` state that is not specified above
  FAIL_IPV4: 'FAIL_IPV4',

  // `traffic-counter` limit exceeded (USB modem interfaces)
  TRAFFIC_LIMIT_EXCEEDED: 'TRAFFIC_LIMIT_EXCEEDED',

  // SIM card is not inserted
  SIM_NOT_INSERTED: 'SIM_NOT_INSERTED',
  // SIM card is not ready
  SIM_INVALID: 'SIM_INVALID',
  // SIM PIN code is required
  SIM_PIN_REQUIRED: 'SIM_PIN_REQUIRED',
  // SIM PIN code attempts are exhausted
  SIM_BLOCKED: 'SIM_BLOCKED',
  // State exclusive for a dual SIM device, defines unused empty slot
  SIM_SLOT_INACTIVE: 'SIM_SLOT_INACTIVE',

  // The standby mode is enabled, and the interface priority is lower than the current WAN connection.
  ON_STANDBY: 'ON_STANDBY',

  WIFI_DISCONNECTED: 'WIFI_DISCONNECTED',

  // [Status of a WifiStation or an AccessPoint]
  // Master radio interface is disabled for some reason (including "via a hardware button")
  WIFI_MASTER_OFF: 'WIFI_MASTER_OFF',

  // Master radio interface is disabled because it has no enabled child interfaces
  WIFI_MASTER_IDLE: 'WIFI_MASTER_IDLE',

  // [Status of the WifiMaster interface]
  // Master radio interface is disabled using a hardware button or a toggle switch.
  WIFI_HWSTATE_OFF: 'WIFI_HWSTATE_OFF',

  // A DFS check is in progress (clients can't connect to the 5 GHz AccessPoints during the check)
  // [DOCS]: https://ndm.atlassian.net/wiki/spaces/N/pages/2454061063
  WIFI_DFS_CHECK_IN_PROGRESS: 'DFS_CHECK_IN_PROGRESS',

  // -- [ENTITY_STATUS_KIND.CONNECTING] --
  // generic status for most interfaces
  CONNECTING: 'CONNECTING',

  // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Mobile
  INITIALIZING_DEVICE: 'INITIALIZING_DEVICE',
  WAITING_FOR_NETWORK: 'WAITING_FOR_NETWORK',
  CONNECTING_TO_BASE_STATION: 'CONNECTING_TO_BASE_STATION',
  SCANNING: 'SCANNING',

  // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#DSL
  // used for both "handshake" & "training" stages; "idle" stage with "no-carrier" > 0 is treated as FAIL_LINK
  DSL_LINE_CONNECTING: 'DSL_LINE_CONNECTING',

  // -- [ENTITY_STATUS_KIND.CONNECTED] --
  CONNECTED_TO_IPV6: 'CONNECTED_TO_IPV6', // Only IPv6
  CONNECTED: 'CONNECTED', // IPv4 or IPv4 + IPv6
} as const;

export type EntityStatus = Values<typeof ENTITY_STATUS>;

// @see src/api/show-interface/_traits/ip.trait.ts (API reference)
export type EntityIpConflictInfo = IpConflictInfo | undefined;

export interface EntityStatusInfo {
  kind: EntityStatusKind;
  status: EntityStatus;
  type: StatusType;
  details?: NdmDetailsItem | undefined;
  extraInfo?: GenericObject;
}

export const ENTITY_IP_STATUS = {
  NO_IP: 'NO_IP',
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  IP_CONFLICT: 'IP_CONFLICT',
} as const;

export type EntityIpStatus = Values<typeof ENTITY_IP_STATUS>;

export interface EntityIpv4Over6Info {
  ip46Type: string;
}

export type EntityIpv4StatusInfo = RequireExactlyOneOf<[
  {status: typeof ENTITY_IP_STATUS.NO_IP; type: StatusType},
  {status: typeof ENTITY_IP_STATUS.FAIL; type: StatusType},
  {status: typeof ENTITY_IP_STATUS.SUCCESS; type: StatusType; address: string; extraInfo?: EntityIpv4Over6Info},
  {status: typeof ENTITY_IP_STATUS.IP_CONFLICT; type: StatusType; extraInfo: EntityIpConflictInfo},
]>;

export interface EntityIpv6StatusInfo {
  status: typeof ENTITY_IP_STATUS.SUCCESS;
  type: StatusType;
}

export const ENTITY_PING_CHECK_STATUS = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  NOT_READY: 'NOT_READY',
  DISABLED: 'DISABLED',
} as const;

export type EntityPingCheckStatus = Values<typeof ENTITY_PING_CHECK_STATUS>;

export interface PingCheckStatusInfo {
  status: EntityPingCheckStatus;
  type: StatusType;
}

export type StatusPerLayer = GenericInterfaceStatus['summary']['layer'];

export interface ProcessLayerArgument {
  layerStatus: NdmLayerStatus;
  layerDetails: InterfaceStatusDetails;
  entityStatus: GenericObject;
  NDM: ModelContext;
}

export interface LayerProcessor {
  layer: NdmLayerName;
  processedDetails: string[];
  tag: string;

  processLayer(data: ProcessLayerArgument): EntityStatusInfo | null;
}

export type LayerProcessorConf = Partial<
  Record<
    NdmLayerName,
    Map<string, LayerProcessor>
  >
>;

// If any of these layers is not in the 'running' state,
// then the connection is not yet working
export const REQUIRED_LAYERS: NdmLayerName[] = ['conf', 'link', 'ctrl'];

export const IP_LAYERS: NdmLayerName[] = ['ipv4', 'ipv6'];

export const LAYER_CHECK_ORDER: NdmLayerName[] = [...REQUIRED_LAYERS, ...IP_LAYERS];
