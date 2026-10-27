import {NDM_INTERFACE_TYPE} from '../../entity-model.types';
import {EthernetSwitchEntity} from './_ethernet-switch.entity';

export interface GigabitEthernetEntity extends EthernetSwitchEntity {}

// This class represents a 1G Ethernet switch interface
export class GigabitEthernetEntity extends EthernetSwitchEntity implements GigabitEthernetEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.GigabitEthernet;
}
