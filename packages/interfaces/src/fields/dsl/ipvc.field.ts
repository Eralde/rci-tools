import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {IpvcEntity} from '../../entity/dsl/ipvc.entity';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {NDM_INTERFACE_TYPE, NDM_INTERLAYER_NAME, type NdmRciIpvcListItem} from '../../entity-model.types';
import type {BridgeEntity} from '../../entity/bridge.entity';
import type {DslEntity} from '../../entity/dsl/dsl.entity';
import {IpvcRolesField} from './ipvc-roles.field';
import type {IpvcModel} from './ipvc.types';
import {type InterfaceIpvcConfiguration} from '../../rci';

export class IpvcField {
  public readonly ipvcConfiguration: NdmRciIpvcListItem;
  public readonly roles: IpvcRolesField;

  constructor(
    protected entity: IpvcEntity | DslEntity,
  ) {
    this.roles = new IpvcRolesField(this.entity);

    const allIpvc = this.entity.dto.allIpvc;
    const ipvcConfiguration = allIpvc.find((item) => item.id === this.entity.name);

    if (!ipvcConfiguration) {
      throw new Error(`IpvcField: can't find matching ipvc object for ${this.entity.name}`);
    }

    this.ipvcConfiguration = ipvcConfiguration;
  }

  public static toNdmIpvcConfiguration(model: IpvcModel): InterfaceIpvcConfiguration {
    return {
      'role': model.role,
      'vpi': model.vpi,
      'vci': model.vci,
      'encapsulation': model.encapsulation,
      'vlan': model.vlan,
      'port': model.ports.join(','),
      'pvc-vlan': Boolean(model.vlanOverPvc),
    };
  }

  public readConfig(): IpvcModel {
    const ipvc = this.ipvcConfiguration;

    return {
      role: ipvc.role,
      vpi: ipvc.vpi,
      vci: ipvc.vci,
      encapsulation: ipvc.encapsulation,
      vlan: ipvc.vlan,
      ports: ipvc.port.split(','),
      vlanOverPvc: ipvc['pvc-vlan'],
    };
  }

  public isEqualConfiguration(model: IpvcModel): boolean {
    const ndmConfiguration = IpvcField.toNdmIpvcConfiguration(model);
    const keysToCompare = Object.keys(ndmConfiguration);

    return _.isEqual(ndmConfiguration, _.pick(this.ipvcConfiguration, keysToCompare));
  }

  public makeIpvcQueries(
    parentName: string,
    ipvcModel: IpvcModel,
  ): RciQuery[] {
    const ipvcConfiguration = IpvcField.toNdmIpvcConfiguration(ipvcModel);
    const ipvcData = {...ipvcConfiguration, parent: parentName};

    return makeConfigurationQueries(this.entity.name, NDM_INTERLAYER_NAME.IPVC, ipvcData);
  }

  public getBridge(): BridgeEntity | null {
    const bridgeName = _.get(this.ipvcConfiguration, 'bridge', '');
    const bridgeEntity = this.entity.collection
      .filter((entity) => entity.type === NDM_INTERFACE_TYPE.Bridge)
      .find((entity) => bridgeName === entity.name);

    return bridgeEntity as BridgeEntity
      || null;
  }
}
