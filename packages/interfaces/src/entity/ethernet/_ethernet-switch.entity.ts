import {Mixin, hasMixin} from 'ts-mixer';
import type {ModelContext} from '../../context';
import type {DelayedInitActions, EntityDto, EntityLabelData, EntityTypeInfo} from '../../entity-model.types';
import {
  BaseTrait,
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
import {IpvcEntityMixin} from '../dsl/ipvc.entity';
import {IpoeEntity} from './ipoe.entity';

// dprint-ignore
export interface EthernetSwitchEntity extends
  BaseTrait,
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

export const EthernetSwitchEntityMixin = Mixin(
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

export abstract class EthernetSwitchEntity extends EthernetSwitchEntityMixin implements EthernetSwitchEntity {
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
