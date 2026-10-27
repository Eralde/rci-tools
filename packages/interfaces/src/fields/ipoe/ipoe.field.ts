import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {IpoeEntity} from '../../entity/ethernet/ipoe.entity';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import type {MinimalIpoeModel, NetworkIpoeModel} from './ipoe.types';
import {NDM_INTERLAYER_NAME, type NdmRciIpoeListItem} from '../../entity-model.types';
import {BaseField} from '../_base.field';
import {type InterfaceIpoeConfiguration, NDM_NETWORK_ROLE, type NdmNetworkRole, StringHelper} from '../../rci';

export class IpoeField extends BaseField<MinimalIpoeModel> {
  private readonly ipoeConfiguration: NdmRciIpoeListItem;

  constructor(
    protected override entity: IpoeEntity,
  ) {
    super(entity, '');

    const allIpoe = _.get(this.entity.dto, 'allIpoe', []) as NdmRciIpoeListItem[];
    const ipoeConfiguration = allIpoe.find((item) => item.id === this.entity.name);

    if (!ipoeConfiguration) {
      throw new Error(`NetworkIpoeField: can't find matching 'ipoe' object for ${this.entity.name}`);
    }

    this.ipoeConfiguration = ipoeConfiguration;
  }

  public static getFullNdmIpoeConfiguration(ipoe: MinimalIpoeModel): InterfaceIpoeConfiguration {
    const getStringValue = (path: string): string => _.get(ipoe, path, []).join(',');

    return {
      'inet-port': getStringValue('inet.ports'),
      'inet-vlan': getStringValue('inet.vlans'),
      'iptv-port': getStringValue('iptv.ports'),
      'iptv-vlan': getStringValue('iptv.vlans'),
      'voip-port': getStringValue('voip.ports'),
      'voip-vlan': getStringValue('voip.vlans'),
    };
  }

  public getDefaultValue(): NetworkIpoeModel {
    return {
      inet: {ports: [], vlans: []},
      iptv: {ports: [], vlans: []},
      voip: {ports: [], vlans: []},
    };
  }

  public getVlanListByRole(role: Exclude<NdmNetworkRole, typeof NDM_NETWORK_ROLE.MISC>): number[] {
    const config = this.readConfig();

    if (role === NDM_NETWORK_ROLE.INET) {
      return config.inet.vlans;
    }

    if (role === NDM_NETWORK_ROLE.VOIP) {
      return config.voip.vlans;
    }

    return config.iptv.vlans;
  }

  public override readConfig(): NetworkIpoeModel {
    return {
      inet: {
        ports: StringHelper.stringToPortsArray(this.ipoeConfiguration['inet-port']),
        vlans: StringHelper.stringToNumberArray(this.ipoeConfiguration['inet-vlan']),
      },
      voip: {
        ports: StringHelper.stringToPortsArray(this.ipoeConfiguration['voip-port']),
        vlans: StringHelper.stringToNumberArray(this.ipoeConfiguration['voip-vlan']),
      },
      iptv: {
        ports: StringHelper.stringToPortsArray(this.ipoeConfiguration['iptv-port']),
        vlans: StringHelper.stringToNumberArray(this.ipoeConfiguration['iptv-vlan']),
      },
    };
  }

  public override getValueChangingQuery(ipoe: MinimalIpoeModel): RciQuery[] {
    const ipoeData = IpoeField.getFullNdmIpoeConfiguration(ipoe);

    return makeConfigurationQueries(this.entity.name, NDM_INTERLAYER_NAME.IPOE, ipoeData);
  }
}
