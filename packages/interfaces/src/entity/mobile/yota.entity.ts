import {type InterfaceEntityType, NDM_INTERFACE_TYPE} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {MobileCommonEntity} from './_mobile-common.entity';

export interface YotaEntity extends MobileCommonEntity {}

export class YotaEntity extends MobileCommonEntity implements YotaEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.Yota;
}

export const isYotaEntity = (entity: InterfaceEntityType | BaseTrait): entity is YotaEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.Yota;
};
