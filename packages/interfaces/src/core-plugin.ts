import * as _ from 'lodash-es';
import type {Constructable} from './rci';
import type {EntityResolver, ModelPlugin} from './plugin.types';
import {type InterfaceEntityType, NDM_INTERFACE_TYPE, type NdmInterfaceType} from './entity-model.types';
import {CommonEntity} from './entity/common.entity';
import {PortEntity} from './entity/port.entity';
import {L2tpEntity, PppoeEntity, PptpEntity} from './entity/tunnel';
import {DslEntity, IpvcEntity, PvcEntity} from './entity/dsl';
import {GigabitEthernetEntity, IpoeEntity, VlanEntity, XGigabitEthernetEntity} from './entity/ethernet';
import {AccessPointEntity, WifiMasterEntity, WifiStationEntity} from './entity/wifi';
import {BridgeEntity} from './entity/bridge.entity';
import {ClatEntity, DsliteEntity, MaptEntity} from './entity/ip46';
import {SegmentEntity} from './entity/segment';
import {CdcEthernetEntity, UsbLteEntity, UsbModemEntity, UsbQmiEntity, YotaEntity} from './entity/mobile';

const PRIORITY = {
  IPOE: 400,
  IPVC_DSL_ROOT: 310,
  IPVC: 300,
  SEGMENT: 200,
  TYPE: 100,
  COMMON: 0,
} as const;

const TYPE_ENTITIES: Array<[NdmInterfaceType, Constructable<InterfaceEntityType>]> = [
  [NDM_INTERFACE_TYPE.Dsl, DslEntity],
  [NDM_INTERFACE_TYPE.UsbDsl, DslEntity],
  [NDM_INTERFACE_TYPE.Pvc, PvcEntity],

  [NDM_INTERFACE_TYPE.CdcEthernet, CdcEthernetEntity],
  [NDM_INTERFACE_TYPE.Yota, YotaEntity],
  [NDM_INTERFACE_TYPE.UsbModem, UsbModemEntity],
  [NDM_INTERFACE_TYPE.UsbLte, UsbLteEntity],
  [NDM_INTERFACE_TYPE.UsbQmi, UsbQmiEntity],

  [NDM_INTERFACE_TYPE.XGigabitEthernet, XGigabitEthernetEntity],
  [NDM_INTERFACE_TYPE.GigabitEthernet, GigabitEthernetEntity],
  // We do not need a separate entity class for the `FastEthernet<N>` interface
  // because any Ethernet WAN configured on a FE device will require a VLAN interface
  // (for GE devices this is not true: by default, a WAN connection is configured
  // over `GigabitEthernet1` w/o VLAN)
  [NDM_INTERFACE_TYPE.FastEthernet, CommonEntity],
  [NDM_INTERFACE_TYPE.Port, PortEntity],

  [NDM_INTERFACE_TYPE.WifiMaster, WifiMasterEntity],
  [NDM_INTERFACE_TYPE.AccessPoint, AccessPointEntity],
  [NDM_INTERFACE_TYPE.WifiStation, WifiStationEntity],

  [NDM_INTERFACE_TYPE.PPPoE, PppoeEntity],
  [NDM_INTERFACE_TYPE.PPTP, PptpEntity],
  [NDM_INTERFACE_TYPE.L2TP, L2tpEntity],

  [NDM_INTERFACE_TYPE.Bridge, BridgeEntity],
  [NDM_INTERFACE_TYPE.Vlan, VlanEntity],

  [NDM_INTERFACE_TYPE.MapT, MaptEntity],
  [NDM_INTERFACE_TYPE.DsLite, DsliteEntity],
  [NDM_INTERFACE_TYPE.Clat, ClatEntity],
];

const typeResolvers: EntityResolver[] = TYPE_ENTITIES.map(([type, ctor]) => ({
  id: `core:type:${type}`,
  priority: PRIORITY.TYPE,
  match: (dto) => _.get(dto, 'show.type') === type,
  ctor,
}));

export const corePlugin: ModelPlugin = {
  name: 'core',
  entities: [
    {
      // Ethernet connection
      id: 'core:ipoe',
      priority: PRIORITY.IPOE,
      match: (dto) => dto.allIpoe.some((item) => item.id === _.get(dto, 'show.id')),
      ctor: IpoeEntity,
    },
    {
      // VDSL w/o inet VLAN -> 'Dsl0' is the 'inet ipvc'
      id: 'core:ipvc-dsl-root',
      priority: PRIORITY.IPVC_DSL_ROOT,
      match: (dto, ctx) => {
        const id = _.get(dto, 'show.id');

        return dto.allIpvc.some((item) => item.id === id) && id === ctx.getParentDslInterface();
      },
      ctor: DslEntity,
    },
    {
      // A part of a DSL connection
      id: 'core:ipvc',
      priority: PRIORITY.IPVC,
      match: (dto) => dto.allIpvc.some((item) => item.id === _.get(dto, 'show.id')),
      ctor: IpvcEntity,
    },
    {
      // Network segment
      id: 'core:segment',
      priority: PRIORITY.SEGMENT,
      match: (dto) => _.has(dto, 'sc.iseg'),
      ctor: SegmentEntity,
    },
    ...typeResolvers,
    {
      id: 'core:common',
      priority: PRIORITY.COMMON,
      match: () => true,
      ctor: CommonEntity,
    },
  ],
};
