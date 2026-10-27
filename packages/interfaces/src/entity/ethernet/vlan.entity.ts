import {Mixin, hasMixin} from 'ts-mixer';
import type {ModelContext} from '../../context';
import {
  type DelayedInitActions,
  type EntityDto,
  type EntityLabelData,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import {
  BaseTrait,
  type CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RoleLabelTrait,
  RolesTrait,
} from '../../traits';
import {EthernetProcessor} from '../../entity-status';
import {IpvcEntityMixin} from '../dsl';
import {IpoeEntity} from './ipoe.entity';

// dprint-ignore
export interface VlanEntity extends
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RoleLabelTrait,
  RolesTrait
{
}

export const VlanEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    IgmpTrait,
    IpDnsTrait,
    IpMtuTrait,
    IpTrait,
  ),
  Mixin(
    Ipv6Trait,
    MacTrait,
    RoleLabelTrait,
    RolesTrait,
  ),
);

// Can't extend `EthernetSwitchEntity` here because switches can't be created or deleted
export class VlanEntity extends VlanEntityMixin implements VlanEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.Vlan;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(EthernetProcessor);
    });
  }

  public override getLabelData(): EntityLabelData {
    const roleOwner = this.getRoleOwner();

    if (!roleOwner) {
      return super.getLabelData();
    }

    if (hasMixin(roleOwner, IpvcEntityMixin)) {
      return this.getIpvcRoleLabelData(roleOwner);
    }

    return this.getIpoeRoleLabelData();
  }

  public override getTypeInfo(): EntityTypeInfo {
    return {
      parts: [
        IpoeEntity.NDM_INTERLAYER,
        ...this.getIp46TypeParts(),
      ],
    };
  }
}

export const isVlanEntity = (entity: InterfaceEntityType | BaseTrait): entity is VlanEntity => {
  return hasMixin(entity, VlanEntityMixin);
};
