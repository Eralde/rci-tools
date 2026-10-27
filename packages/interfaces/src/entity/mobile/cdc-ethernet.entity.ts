import {type InterfaceEntityType, NDM_INTERFACE_TYPE} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {MobileCommonEntity} from './_mobile-common.entity';

export interface CdcEthernetEntity extends MobileCommonEntity {}

export class CdcEthernetEntity extends MobileCommonEntity implements CdcEthernetEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.CdcEthernet;
}

export const isCdcEthernetEntity = (entity: InterfaceEntityType | BaseTrait): entity is CdcEthernetEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.CdcEthernet;
};
