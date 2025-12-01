import {GenericObject} from 'rci-manager';

export enum WIFI_SECURITY {
  'shared' = 'WEP',
  'wpa-psk' = 'WPA',
  'wpa2-psk' = 'WPA2',
  'wpa3-psk' = 'WPA3',
  'owe' = 'OWE',
  'wpa-eap' = 'WPAe',
  'wpa2-eap' = 'WPA2e',
  'wpa3-eap' = 'WPA3e',
  'wpa3-eap-192' = 'WPA3E',
}

interface MemberError {
  error: number | string;
}

interface MemberErrorObject {
  [key: string]: GenericObject;
}

export interface UpdateState {
  state: UPDATE_STATE;
  progress?: string;
}

export type ShowMwsMemberActionResponse = Array<MwsMemberData>;

export enum UPDATE_STATE {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped',
  FAILED = 'failed',
  WAITING = 'waiting',
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export interface MwsMemberPortData {
  label: string;
  appearance: string;
  link: 'up' | 'down';
  disabled: boolean;
  speed: string;
  duplex: string;
}

export interface MwsMemberData {
  cid: string;
  model: string;
  mac: string;
  'known-host'?: string;
  ip?: string; // can be an empty string
  mode?: string; // can be an empty string
  license?: string; // can be an empty string
  fw?: string; // can be an empty string
  'fw-available'?: string; // can be an empty string
  associations?: number;
  fqdn?: string;

  port: MwsMemberPortData[];

  capabilities?: {
    'mode-hw': boolean;
    'dual-band': boolean;
    'wpa3': boolean;
    'owe': boolean;
    'wpa-eap': boolean;
    'backhaul-bss': boolean;
    'embedded-modem': boolean;
    'sta-mask': boolean;
    'notify': boolean;
  };

  backhaul?: {
    uplink: string;
    bridge: string;
    root: string;
    cost: number;

    // wired connection
    speed?: string;
    duplex?: boolean;
    'port-label'?: string;

    // wireless connection
    ap?: string;
    authenticated?: boolean;
    txrate?: number;
    uptime?: number;
    ht?: number;
    mode?: string;
    gi?: number;
    rssi?: number;
    mcs?: number;
    txss?: number;
    ebf?: boolean;
    'dl-mu'?: boolean;
    pmf?: boolean;
    security?: WIFI_SECURITY;
  };

  system?: {
    cpuload: number;
    memory: string;
    uptime: string;
  };

  deleted?: boolean;

  update?: UpdateState;

  rci?: MemberError | MemberErrorObject;
}
