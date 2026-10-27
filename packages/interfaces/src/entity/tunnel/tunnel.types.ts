import type {BaseTrait} from '../../traits';
import {type InterfaceEntityType, NDM_INTERFACE_TYPE, type NdmInterfaceType} from '../../entity-model.types';
import type {PptpEntity} from './pptp.entity';
import type {L2tpEntity} from './l2tp.entity';
import type {PppoeEntity} from './pppoe.entity';

export type IspTunnel = PptpEntity | L2tpEntity | PppoeEntity;

const ISP_TUNNEL_TYPES: NdmInterfaceType[] = [
  NDM_INTERFACE_TYPE.PPTP,
  NDM_INTERFACE_TYPE.PPPoE,
  NDM_INTERFACE_TYPE.L2TP,
];

export const isPossibleIspTunnel = (entity: BaseTrait | InterfaceEntityType): entity is IspTunnel => {
  return ISP_TUNNEL_TYPES.includes(entity.type);
};
