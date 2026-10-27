import {Mixin} from 'ts-mixer';
import type {ModelContext} from '../../context';
import {
  AdjustMssTrait,
  AuthTrait,
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  IpcpTrait,
  RolesTrait,
  TunnelIpv6Trait,
  TunnelPeerTrait,
  TunnelRemoteTrait,
  TunnelViaTrait,
} from '../../traits';
import type {DelayedInitActions, EntityDto, EntityLabelData, EntityTypeInfo} from '../../entity-model.types';
import {PppProcessor} from '../../entity-status';

// dprint-ignore
export interface TunnelEntity extends
  AdjustMssTrait,
  AuthTrait,
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  IpcpTrait,
  RolesTrait,
  TunnelIpv6Trait,
  TunnelPeerTrait,
  TunnelRemoteTrait,
  TunnelViaTrait
{
}

const TunnelEntityMixin = Mixin(
  Mixin(
    AdjustMssTrait,
    AuthTrait,
    BaseTrait,
    CreateDeleteTrait,
    IgmpTrait,
  ),
  Mixin(
    IpDnsTrait,
    IpMtuTrait,
    IpTrait,
    IpcpTrait,
    RolesTrait,
  ),
  Mixin(
    TunnelIpv6Trait,
    TunnelPeerTrait,
    TunnelRemoteTrait,
    TunnelViaTrait,
  ),
);

export abstract class TunnelEntity extends TunnelEntityMixin implements TunnelEntity {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(PppProcessor);
    });
  }

  public override getLabelData(): EntityLabelData {
    return this.inheritIspLabelData();
  }

  public override getTypeInfo(): EntityTypeInfo {
    return this.getExtendedTypeInfo();
  }
}
