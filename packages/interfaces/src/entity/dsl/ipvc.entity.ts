import {Mixin, hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {
  BaseTrait,
  ComplexIspTrait,
  DeletableTrait,
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
import type {ModelContext} from '../../context';
import {makeConfigurationQueries, makeInterlayerCreationQueries} from '../../helpers/query.helper';
import {
  type DelayedInitActions,
  type EntityDto,
  type EntityLabelData,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERLAYER_NAME,
} from '../../entity-model.types';
import * as Fields from '../../fields';
import type {IpvcModel} from '../../fields';
import type {DslEntity} from './dsl.entity';
import {type InterfaceIpvcConfiguration, NDM_NETWORK_ROLE, NO_COMMAND, type NdmNetworkRole} from '../../rci';

// dprint-ignore
export interface IpvcEntity extends
  BaseTrait,
  ComplexIspTrait,
  DeletableTrait,
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
  makeDeletionQueries(): RciQuery[];

  ipvc: Fields.IpvcField;
}

export const IpvcEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    ComplexIspTrait,
    DeletableTrait,
    DslTrait,
    IgmpTrait,
  ),
  Mixin(
    IpDnsTrait,
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
    MacTrait,
  ),
  Mixin(
    MacTrait,
    RoleLabelTrait,
    RolesTrait,
  ),
);

export class IpvcEntity extends IpvcEntityMixin implements IpvcEntity {
  public static readonly NDM_INTERLAYER = NDM_INTERLAYER_NAME.IPVC;

  public readonly parentDslId: string;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ipvc = new Fields.IpvcField(this);
    this.roles = this.ipvc.roles.readConfig();

    this.parentDslId = this.NDM.getParentDslInterface();
  }

  public static makeInsertionQueries(
    ipvcModel: IpvcModel,
    parent: DslEntity,
  ): RciQuery[] {
    const ipvcConfiguration = Fields.IpvcField.toNdmIpvcConfiguration(ipvcModel);
    const ipvcData = {...ipvcConfiguration, parent: parent.name};

    return makeInterlayerCreationQueries<InterfaceIpvcConfiguration>(
      IpvcEntity.NDM_INTERLAYER,
      ipvcData,
    );
  }

  /**
   * RolesTrait overload: we should read role data from the 'ipvc' object
   */
  public override getRoles(): NdmNetworkRole[] {
    return this.ipvc.roles.readConfig();
  }

  public override getChangeRoleQuery(_roles: NdmNetworkRole[]): RciQuery[] {
    this.NDM.logger.warning('IpvcEntity.getChangeRoleQuery: assign role via the "interface ipvc" interlayer!');

    return [];
  }

  public override hasAnyRole(): boolean {
    return this.ipvc.roles.hasAnyRole();
  }

  public override hasRole(ndmRole: NdmNetworkRole): boolean {
    return this.ipvc.roles.hasRole(ndmRole);
  }

  public override hasRoleOwner(): boolean {
    return this.hasAnyRole() && !this.hasRole(NDM_NETWORK_ROLE.INET);
  }

  public override getRoleOwner(): InterfaceEntityType | null {
    return this.hasRole(NDM_NETWORK_ROLE.INET)
      ? null // this entity is the "role owner" for every other ipvc
      : this.getInetIpvc();
  }

  /**
   * RolesTrait overload END
   */

  // Overloads ComplexIspTrait.isIsp
  public override isIsp(): boolean {
    return this.hasRole(NDM_NETWORK_ROLE.INET)
      && !_.get(this.dto, 'sc.ipvc.bridge');
  }

  public override getTypeInfo(): EntityTypeInfo {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return getIpvcTypeInfo(this);
  }

  public override makeDeletionQueries(): RciQuery[] {
    return makeConfigurationQueries(this.name, IpvcEntity.NDM_INTERLAYER, NO_COMMAND);
  }

  public override getLabelData(): EntityLabelData {
    const roleOwner = this.getRoleOwner();

    return this.getIpvcRoleLabelData(roleOwner);
  }
}

export const isIpvcEntity = (entity: InterfaceEntityType | BaseTrait): entity is IpvcEntity => {
  return hasMixin(entity, IpvcEntityMixin);
};

export const getIpvcTypeInfo = (entity: IpTrait): EntityTypeInfo => {
  return {
    parts: [
      IpvcEntity.NDM_INTERLAYER,
      ...entity.getIp46TypeParts(),
    ],
  };
};
