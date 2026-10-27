import {type InterfaceEntityType, NDM_INTERFACE_TYPE} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {TunnelEntity} from './_tunnel.entity';

// dprint-ignore
export interface L2tpEntity extends TunnelEntity {}

export class L2tpEntity extends TunnelEntity implements L2tpEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.L2TP;
}

export const isL2tpEntity = (entity: InterfaceEntityType | BaseTrait): entity is L2tpEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.L2TP;
};
