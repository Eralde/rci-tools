import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {BaseField} from '../_base.field';
import {IP_ADDRESS} from './ip.constants';
import {type GenericObject, IP_MASK_SINGLE, IP_SUBNET_MASK_CLASS_C, NO_COMMAND} from '../../rci';

export interface AddressConfigModel {
  address: string;
  mask: string; // always will be '255.255.255.255' or '' for tunnels
  dhcp?: boolean; // meaningless for tunnels
}

export class Ipv4AddressField extends BaseField<AddressConfigModel> {
  constructor(
    protected override entity: BaseTrait,
  ) {
    super(entity, IP_ADDRESS);
  }

  public override readConfig(): AddressConfigModel {
    const addressBlock = _.get(this.entity.dto, `sc.${IP_ADDRESS}`, {});
    const address = _.get(addressBlock, 'address', '');
    const mask = _.get(addressBlock, 'mask', '');
    const dhcp = _.has(addressBlock, 'dhcp');

    return {
      address,
      mask,
      dhcp,
    };
  }

  public getDefaultValue(): AddressConfigModel {
    return {
      address: '',
      mask: '',
      dhcp: false,
    };
  }

  public override getValueChangingQuery(model: Partial<AddressConfigModel>): RciQuery[] {
    const address = _.get(model, 'address', '');
    const mask = _.get(model, 'mask', IP_SUBNET_MASK_CLASS_C);
    const dhcp = _.get(model, 'dhcp', false);

    // In the `ndm` many interfaces have a mock
    // `interface ip address dhcp` command which just
    // throws an error. To avoid such errors, this method
    // has a separate branch for those interfaces.
    if (!this.entity.hasNdmTrait('EthernetIp')) {
      const tunnelMask = _.get(model, 'mask', IP_MASK_SINGLE);
      const queryData = address
        ? [NO_COMMAND, {address, mask: tunnelMask}]
        : [NO_COMMAND];

      return makeConfigurationQueries(
        this.entity.name,
        IP_ADDRESS,
        queryData,
      );
    }

    let data: GenericObject;

    if (model.address) {
      data = {
        // dhcp === true --> start DHCP client, but preserve static fallback IP
        // dhcp === false --> stop DHCP client (manual IP configuration)
        dhcp,
        address,
        mask,
      };
    } else {
      data = {
        ...NO_COMMAND, // Clear static IP

        // dhcp === true --> start DHCP client
        // dhcp === false --> stop DHCP client ("No IP")
        dhcp,
      };
    }

    const addressQuery = _.set({}, IP_ADDRESS, data);

    return makeConfigurationQueries(
      this.entity.name,
      [addressQuery],
    );
  }
}
