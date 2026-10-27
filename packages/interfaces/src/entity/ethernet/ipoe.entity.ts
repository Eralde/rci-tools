import {Mixin, hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {ModelContext} from '../../context';
import {
  BaseTrait,
  ComplexIspTrait,
  DeletableTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait,
} from '../../traits';
import {IpoeField, type MinimalIpoeModel} from '../../fields';
import {makeConfigurationQueries, makeInterlayerCreationQueries} from '../../helpers/query.helper';
import {EthernetProcessor} from '../../entity-status';
import {
  type DelayedInitActions,
  type EntityDto,
  type EntityLabelData,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERLAYER_NAME,
  type NdmRciIpoeListItem,
} from '../../entity-model.types';
import {type PortEntity, isPortEntity} from '../port.entity';
import {type InterfaceIpoeConfiguration, NDM_NETWORK_ROLE, NO_COMMAND, type NdmNetworkRole} from '../../rci';

// dprint-ignore
export interface IpoeEntity extends
  BaseTrait,
  ComplexIspTrait,
  DeletableTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait
{
  ipoe: IpoeField;

  getBusyVlanList(): number[];
  getInetPort(): PortEntity;
  getPortsByRole(role: NdmNetworkRole): PortEntity[];
}

export const IpoeEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    ComplexIspTrait,
    DeletableTrait,
    IgmpTrait,
    IpDnsTrait,
  ),
  Mixin(
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
    MacTrait,
    RolesTrait,
  ),
);

export class IpoeEntity extends IpoeEntityMixin implements IpoeEntity {
  public static readonly NDM_INTERLAYER = NDM_INTERLAYER_NAME.IPOE;

  public ipoe: IpoeField;

  private readonly ipoeConfiguration: NdmRciIpoeListItem | undefined;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ipoe = new IpoeField(this);

    const allIpoe = this.dto.allIpoe;

    this.ipoeConfiguration = _.find(allIpoe, (item) => item.id === this.name);

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(EthernetProcessor);
    });
  }

  public static makeInsertionQueries(ipoeModel: MinimalIpoeModel): RciQuery[] {
    const ipoeConfiguration = IpoeField.getFullNdmIpoeConfiguration(ipoeModel);

    return makeInterlayerCreationQueries<InterfaceIpoeConfiguration>(
      IpoeEntity.NDM_INTERLAYER,
      ipoeConfiguration,
    );
  }

  public override makeDeletionQueries(): RciQuery[] {
    return makeConfigurationQueries(this.name, IpoeEntity.NDM_INTERLAYER, NO_COMMAND);
  }

  public override getLabelData(): EntityLabelData {
    const description = this.description.readConfig();

    // Use l10n string for a default WAN connection if its description is unchanged
    const labelData = this.rename === this.NDM.WAN && description === this.NDM.WAN_DESCRIPTION
      ? {labelL10n: 'interface-translation.ISP'}
      : {label: description || this.name};

    const vlan = this.ipoeConfiguration?.['inet-vlan']; // Can be empty
    const suffixData = {
      vlanList: vlan ? [vlan] : [],
      role: NDM_NETWORK_ROLE.INET,
    };

    return {
      ...labelData,
      suffixData,
    };
  }

  public getBusyVlanList(): number[] {
    return String(this.ipoeConfiguration?.['busy-vlan'] ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number);
  }

  public getInetPort(): PortEntity | null {
    const inetPort = this.collection
      .filter(isPortEntity)
      .find((item) => item.getLabel() === this.ipoe.readConfig().inet.ports[0]);

    return inetPort || null;
  }

  public getPortsByRole(role: NdmNetworkRole): PortEntity[] {
    const ports = this.collection.filter(isPortEntity);

    return ports.filter((port) => port.hasRole(role) && port?.getRoleOwner()?.name === this.name);
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

export const isIpoeEntity = (entity: InterfaceEntityType | BaseTrait): entity is IpoeEntity => {
  return hasMixin(entity, IpoeEntityMixin);
};
