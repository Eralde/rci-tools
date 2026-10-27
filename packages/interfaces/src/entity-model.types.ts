import type {CommonEntity} from './entity/common.entity';
import type {PortEntity} from './entity/port.entity';
import type {L2tpEntity, PppoeEntity, PptpEntity} from './entity/tunnel';
import type {ClatEntity, DsliteEntity, MaptEntity} from './entity/ip46';
import type {BridgeEntity} from './entity/bridge.entity';
import type {GigabitEthernetEntity, IpoeEntity, VlanEntity, XGigabitEthernetEntity} from './entity/ethernet';
import type {DslEntity, IpvcEntity, PvcEntity} from './entity/dsl';
import type {AccessPointEntity, WifiMasterEntity, WifiStationEntity} from './entity/wifi';
import type {SegmentEntity} from './entity/segment';
import type {CdcEthernetEntity, UsbLteEntity, UsbModemEntity, UsbQmiEntity, YotaEntity} from './entity/mobile';
import {
  type GenericObject,
  type InterfaceIpoeReadConfiguration,
  type InterfaceIpvcReadConfiguration,
  type ModelTranslator,
  type NdmNetworkRole,
  type Values,
} from './rci';

export const NDM_INTERFACE_TYPE = {
  // - DSL -
  Dsl: 'Dsl',
  UsbDsl: 'UsbDsl',
  Pvc: 'Pvc',

  // - 3G/4G Modems -
  CdcEthernet: 'CdcEthernet',
  Yota: 'Yota',
  YotaOne: 'YotaOne',
  UsbModem: 'UsbModem',
  UsbLte: 'UsbLte',
  UsbQmi: 'UsbQmi',

  // - Ethernet HW -
  FastEthernet: 'FastEthernet',
  GigabitEthernet: 'GigabitEthernet',
  XGigabitEthernet: 'XGigabitEthernet', // 10G Ethernet switch
  Port: 'Port',

  // - Wi-Fi -
  WifiMaster: 'WifiMaster',
  AccessPoint: 'AccessPoint',
  WifiStation: 'WifiStation',

  // - Tunnels -
  PPPoE: 'PPPoE',
  PPTP: 'PPTP',
  L2TP: 'L2TP',

  // - other -
  Bridge: 'Bridge',
  Vlan: 'Vlan',

  MapT: 'MapT',
  DsLite: 'DsLite',
  Clat: 'Clat',
} as const;

export type NdmInterfaceType = Values<typeof NDM_INTERFACE_TYPE>;

export const NDM_INTERLAYER_NAME = {
  IPOE: 'ipoe',
  ISEG: 'iseg',
  IPVC: 'ipvc',
} as const;

export type NdmInterlayerName = Values<typeof NDM_INTERLAYER_NAME>;

// Special cases:
// - we want to show special l10n for the internal 4G modem
export const CUSTOM_INTERFACE_TYPE = {
  INTERNAL_QMI_MODEM: 'INTERNAL_QMI_MODEM',
  INTERNAL_LTE_MODEM: 'INTERNAL_LTE_MODEM',
} as const;

export type CustomInterfaceType = Values<typeof CUSTOM_INTERFACE_TYPE>;

/*
 * This class is a simple repository for JS functions.
 * Its main purpose is to store functions
 * to be called __after__ the model entity is created.
 * Passing calls to an instance of DelayedInitActions
 * is a workaround that allows us to work with the entity
 * in its final form, instead of losing context (`this`)
 * as it happens in trait constructors.
 */
export class DelayedInitActions<T> {
  protected calls: Array<(ref: T) => unknown> = [];

  public push(fn: (ref: T) => unknown): void {
    this.calls.push(fn);
  }

  public execute(ref: T): void {
    // A call may push another one (e.g. a field created inside a delayed action),
    // so the array iterator sees it
    for (const call of this.calls) {
      call(ref);
    }
  }
}

export interface NdmRciIpoeListItem extends InterfaceIpoeReadConfiguration {
  id: string;
}

export interface NdmRciIpvcListItem extends InterfaceIpvcReadConfiguration {
  id: string;
}

export interface EntityDto {
  sc: GenericObject; // saved configuration
  show: GenericObject; // status
  allIpoe: NdmRciIpoeListItem[];
  allIpvc: NdmRciIpvcListItem[];
}

type EntityL10nValue =
  | string
  // dynamic data which needs to be translated before being used as a parameter inside the `label`
  | ((language: string, translate: ModelTranslator) => string);

// additional data that will be passed to the translation service
// to generate the entity label
// (e.g., Wi-Fi band for a WifiStation interface)
export type EntityL10nData = Record<string, EntityL10nValue>;

export interface DslPvc {
  vpi: string;
  vci: string;
  encapsulation: string;
}

/**
 * This interface represents data, required to generate human-readable entity label
 */
export interface EntityLabelData {
  // user-defined label (defaults to the `interface description` value)
  // or labelL10n for a translation id (e.g. 'interface-translation.Home')
  label?: string;
  labelL10n?: string;
  typeLabel?: string; // a translation id to use instead of entity type while generating entity label

  // Additional data that will be passed to the translation service to generate entity label
  // (e.g. Wi-Fi band for a WifiStation interface)
  l10nData?: EntityL10nData;

  // data, required to generate a suffix string which will help to distinguish
  // different parts of a composite ISP
  // (e.g. in an "ipoe + tunnel" aggregate both ipoe and tunnel interfaces will have the same description)
  suffixData?: Partial<{
    ssid: string;
    dslOpmode: string;
    vlanList: Array<string>;
    isAdditionalVlan: boolean;
    pvcList: DslPvc[];
    role: NdmNetworkRole | undefined;
  }>;
}

export type EntityTypePart = NdmInterlayerName | NdmInterfaceType | CustomInterfaceType;

export interface EntityTypeInfo {
  parts: Array<EntityTypePart>;
  // Additional data that will be passed to the translation service to generate entity label
  // (e.g. Wi-Fi band for a WifiStation interface)
  l10nData?: EntityL10nData;
  // If this flag is true, then any element in the `parts` array
  // will be treated as being "over IPsec" (e.g. L2TP/IPsec);
  // At this point we assume that in this scenario the `parts` array
  // will always contain a __single__ element (['L2TP'], ['IPIP'], ...).
  // If this assumption becomes invalid in the future,
  // we will have to change the basic `getTypeInfo` method and its overloads.
  overIpsec?: boolean;
}

export type Ip46Entity = MaptEntity | DsliteEntity | ClatEntity;

// instance can be created manually (we can guess next free name properly)
export type CreatableEntityType =
  | CdcEthernetEntity
  | UsbLteEntity
  | UsbModemEntity
  | UsbQmiEntity
  | YotaEntity
  | BridgeEntity
  | VlanEntity
  | PvcEntity
  | PptpEntity
  | L2tpEntity
  | PppoeEntity
  | MaptEntity
  | DsliteEntity
  | ClatEntity;

// instance can be created only via an interlayer
export type InterlayerEntityType =
  | IpoeEntity
  | IpvcEntity
  | SegmentEntity;

// can't be created or removed
export type IndestructibleEntityType =
  | DslEntity
  | PortEntity
  | WifiMasterEntity
  | AccessPointEntity
  | WifiStationEntity
  | GigabitEthernetEntity
  | XGigabitEthernetEntity
  | CommonEntity; // we can't create an <unknown type> interface instance

export type InterfaceEntityType =
  | IndestructibleEntityType
  | CreatableEntityType
  | InterlayerEntityType;
