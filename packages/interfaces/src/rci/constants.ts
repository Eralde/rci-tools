import type {Values} from './type.utils';

// All constants are `const` objects + union types (not TS enums): string enums are nominal,
// so two copies of the same enum are incompatible with each other.

export const YES_NO_VALUE = {
  YES: 'yes',
  NO: 'no',
} as const;

export type YesNo = Values<typeof YES_NO_VALUE>;

export const NDM_NETWORK_ROLE = {
  INET: 'inet',
  IPTV: 'iptv',
  VOIP: 'voip',
  MISC: 'misc',
} as const;

export type NdmNetworkRole = Values<typeof NDM_NETWORK_ROLE>;

export const SECURITY_LEVEL = {
  PUBLIC: 'public',
  PROTECTED: 'protected',
  PRIVATE: 'private',
} as const;

export type SecurityLevel = Values<typeof SECURITY_LEVEL>;

export const MOBILE_PDP = {
  IPV4: 'ipv4',
  IPV4V6: 'ipv4v6',
  IPV6: 'ipv6',
} as const;

export type MobilePdp = Values<typeof MOBILE_PDP>;

export const CELLULAR_STANDARD = {
  STANDARD_2G_GPRS: '2G GPRS',
  STANDARD_2G_EDGE: '2G EDGE',
  STANDARD_3G_WCDMA: '3G WCDMA',
  STANDARD_3G_HSPA: '3G HSPA',
  STANDARD_3G_HSPA_PLUS: '3G HSPA+',
  STANDARD_3G_DC_HSPA_PLUS: '3G DC-HSPA+',
  STANDARD_4G: '4G',
  STANDARD_4G_PLUS: '4G+',
  STANDARD_5G: '5G',
  STANDARD_UNKNOWN: '',
} as const;

export type CellularStandard = Values<typeof CELLULAR_STANDARD>;

export const CONNECTION_STATE = {
  EMPTY: '',
  CONNECTED: 'Connected',
  CONNECTING: 'Connecting',
  REQUESTING: 'Requesting',
  WAITING_FOR_NETWORK: 'Waiting for network',
  SUSPENDED: 'Suspended',
  SCANNING: 'Scanning',
  DISCONNECTED: 'Disconnected',
  INITIALIZING: 'Initializing',
} as const;

export type ConnectionState = Values<typeof CONNECTION_STATE>;

export const SIM_CARD_STATE = {
  READY: 'READY',
  NOT_INSERTED: 'NOT_INSERTED',
  INVALID: 'INVALID',
  PIN_CODE_CHECKING: 'PIN_CODE_CHECKING',
  PIN_CODE_REQUIRED: 'PIN_CODE_REQUIRED',
  PIN_BLOCK: 'PIN_BLOCK',
  PIN_WRONG: 'PIN_WRONG',

  // SIM card inserted into an inactive slot
  PENDING: 'PENDING',
  UNKNOWN: '',
} as const;

export type SimCardState = Values<typeof SIM_CARD_STATE>;

export const WIFI_BAND = {
  BAND_2_GHZ: '2',
  BAND_5_GHZ: '5',
} as const;

export type WifiBand = Values<typeof WIFI_BAND>;

export const WIFI_ENCRYPTION = {
  NONE: 'none',
  WEP: 'wep',
  WPA: 'wpa',
  WPA2: 'wpa2',
  WPA_WPA2: 'wpa+wpa2',
  WPA3: 'wpa3',
  WPA2_WPA3: 'wpa2+wpa3',
  OWE: 'owe', // Opportunistic Wireless Encryption
  WPA2_EAP: 'wpa2-eap',
  WPA_WPA2_EAP: 'wpa-wpa2-eap',
  WPA2_WPA3_EAP_TRANSITION: 'wpa2-wpa3-eap-transition',
  WPA3_EAP: 'wpa3-eap',
  WPA3_EAP_SUITE_B: 'wpa3-eap-suite-b',
} as const;

export type WifiEncryption = Values<typeof WIFI_ENCRYPTION>;

export const WIFI_DEFAULT_CHANNEL = '0'; // "select the Wi-Fi channel automatically"

// RCI command (`interface <name> ...`)
export const INTERFACE_COMMAND = 'interface';

export const ZERO_IP = '0.0.0.0';
export const IP_MASK_SINGLE = '255.255.255.255';
export const IP_SUBNET_MASK_CLASS_C = '255.255.255.0';
