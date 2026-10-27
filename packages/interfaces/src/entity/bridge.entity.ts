import {Mixin, hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import {
  BaseTrait,
  ComplexIspTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IncludeTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RoleLabelTrait,
  RolesTrait,
} from '../traits';
import {PVC_SUFFIX, VLAN_SUFFIX} from '../entity-model.constants';
import {
  type DslPvc,
  type EntityLabelData,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
  type NdmRciIpvcListItem,
} from '../entity-model.types';
import {type DslEntity, type IpvcEntity, getIpvcTypeInfo} from './dsl';
import {NDM_NETWORK_ROLE} from '../rci';

// dprint-ignore
export interface BridgeEntity extends
  BaseTrait,
  ComplexIspTrait, // DSL-related bridge
  CreateDeleteTrait,
  IgmpTrait,
  IncludeTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RoleLabelTrait,
  RolesTrait {
  getRelatedIpvcItems(): NdmRciIpvcListItem[];
  getRelatedIpvcEntities(): Array<DslEntity | IpvcEntity>;
  isDslBridge(): boolean;
}

export const BridgeEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    ComplexIspTrait,
    CreateDeleteTrait,
    IgmpTrait,
    IncludeTrait,
  ),
  Mixin(
    IncludeTrait,
    IpDnsTrait,
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
  ),
  Mixin(
    MacTrait,
    RoleLabelTrait,
    RolesTrait,
  ),
);

export class BridgeEntity extends BridgeEntityMixin implements BridgeEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.Bridge;

  public getRelatedIpvcItems(): NdmRciIpvcListItem[] {
    return _.filter(this.dto.allIpvc, (item) => _.get(item, 'bridge', '') === this.name);
  }

  public getRelatedIpvcEntities(): Array<DslEntity | IpvcEntity> {
    return this.getRelatedIpvcItems()
      .map((ipvc) => {
        return this.collection.find((item) => item.name === ipvc.id) as DslEntity | IpvcEntity;
      })
      .filter(Boolean);
  }

  public isDslBridge(): boolean {
    return this.getRelatedIpvcEntities().length > 0;
  }

  // Overloads ComplexIspTrait.isIsp
  public override isIsp(): boolean {
    return this.isDslBridge() && this.hasRole(NDM_NETWORK_ROLE.INET);
  }

  public override getLabelData(): EntityLabelData {
    if (!this.hasAnyRole()) {
      return super.getLabelData();
    }

    const relatedIpvcItems = this.getRelatedIpvcItems();

    // Non-DSL bridge
    if (relatedIpvcItems.length === 0) {
      return this.getIpoeRoleLabelData();
    }

    const parentDslId = this.NDM.getParentDslInterface();
    const _parentDslEntity = this._collection.find((_entity) => _entity.name === parentDslId); // should exist

    if (!_parentDslEntity) {
      this.NDM.logger.error(
        `BridgeEntity.getLabelData: failed to get "parent" DSL interface for a DSL-related bridge [${this.name}]`,
        `Related ipvcs: ${relatedIpvcItems.map((item) => item.id).join(', ')}`,
      );

      return super.getLabelData();
    }

    const parentDslEntity = _parentDslEntity as DslEntity;
    const labelData = this.description.readConfig()
      ? super.getLabelData()
      : parentDslEntity.getLabelData();

    const includedEntities = this.getIncludedEntities();

    // VDSL w/o inet VLAN
    if (includedEntities.some((_entity) => _entity.name === parentDslId)) {
      labelData.suffixData = {
        dslOpmode: parentDslEntity.getCurrentOpmode(),
        role: this.getRoles()[0],
      };

      return labelData;
    }

    const vlanList: Array<string> = [];
    const pvcList: DslPvc[] = [];

    // Iterate through DSL-related interfaces and collect VLAN IDs & VPI/VCI pairs
    includedEntities.forEach((entity) => {
      // We can't be sure that `entity` is an IpvcEntity instance (not a VlanEntity/PvcEntity instance),
      // so we'll read VPI/VCI from the `show interface`
      if (entity.name.includes(PVC_SUFFIX) && !entity.name.includes(VLAN_SUFFIX)) {
        const vpi = _.get(entity.dto, 'show.vpi', '');
        const vci = _.get(entity.dto, 'show.vci', '');
        const encapsulation = _.get(entity.dto, 'show.encapsulation', '');

        if (vpi && vci) {
          pvcList.push({vpi, vci, encapsulation});
        }
      }

      if (entity.name.includes(VLAN_SUFFIX)) {
        const vlan = String(entity.name.split(VLAN_SUFFIX)[1]);

        vlanList.push(vlan);
      }
    });

    labelData.suffixData = {
      vlanList: _.uniq(vlanList), // duplicate VLAN ID can occur if this bridge includes both Dsl0/VlanX & Dsl0/Pvc0/VlanX
      pvcList,
      role: this.getRoles()[0],
    };

    return labelData;
  }

  public override getTypeInfo(): EntityTypeInfo {
    const relatedIpvcList = this.getRelatedIpvcItems();

    if (relatedIpvcList.length === 0) {
      return super.getTypeInfo();
    }

    // IPTV or VoIP bridge
    if (relatedIpvcList[0]?.role !== NDM_NETWORK_ROLE.INET) {
      return super.getTypeInfo();
    }

    // "inet" ipvc bridge
    return getIpvcTypeInfo(this);
  }
}

export const isBridgeEntity = (entity: InterfaceEntityType | BaseTrait): entity is BridgeEntity => {
  return hasMixin(entity, BridgeEntityMixin);
};
