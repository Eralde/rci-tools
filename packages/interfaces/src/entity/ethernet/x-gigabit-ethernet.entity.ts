import {NDM_INTERFACE_TYPE} from '../../entity-model.types';
import {EthernetSwitchEntity} from './_ethernet-switch.entity';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface XGigabitEthernetEntity extends EthernetSwitchEntity {}

// This class represents a 10G Ethernet switch interface
// eslint-disable-next-line @typescript-eslint/naming-convention
export class XGigabitEthernetEntity extends EthernetSwitchEntity implements XGigabitEthernetEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.XGigabitEthernet;
}
