import {Mixin, hasMixin} from 'ts-mixer';
import {
  BaseTrait,
  CreateDeleteTrait,
  DslTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RoleLabelTrait,
  RolesTrait,
} from '../../traits';
import {type EntityLabelData, type InterfaceEntityType, NDM_INTERFACE_TYPE} from '../../entity-model.types';

// dprint-ignore
export interface PvcEntity extends
  BaseTrait,
  CreateDeleteTrait,
  DslTrait,
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

const PvcEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    CreateDeleteTrait,
    DslTrait,
    IgmpTrait,
    IpDnsTrait,
  ),
  Mixin(
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
    MacTrait,
  ),
  Mixin(
    RoleLabelTrait,
    RolesTrait,
  ),
);

export class PvcEntity extends PvcEntityMixin implements PvcEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.Pvc;

  public override getLabelData(): EntityLabelData {
    // this entity is not the "inet" ipvc, otherwise it would be an instance of IpvcEntity
    const inetIpvcEntity = this.getInetIpvc();

    return this.getIpvcRoleLabelData(inetIpvcEntity || null);
  }
}

export const isPvcEntity = (entity: InterfaceEntityType | BaseTrait): entity is PvcEntity => {
  return hasMixin(entity, PvcEntityMixin);
};
