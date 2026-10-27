import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../traits';
import {makeConfigurationQueries} from '../helpers/query.helper';
import {BaseField} from './_base.field';
import {NO_COMMAND} from '../rci';

export enum MAC_ADDRESS_MODE {
  DEFAULT = 'DEFAULT',
  MANUAL = 'MANUAL',
  CLONE = 'CLONE', // can't be "read" from the configuration, added for convenience
}

export interface MacAddressConfiguration {
  mode: MAC_ADDRESS_MODE;
  address: string;
}

export const MAC_ADDRESS = 'mac.address';

export class MacAddressField extends BaseField<MacAddressConfiguration> {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(entity, MAC_ADDRESS);
  }

  // Overloads
  public getDefaultValue(): MacAddressConfiguration {
    return {
      mode: MAC_ADDRESS_MODE.DEFAULT,
      address: '',
    };
  }

  public override readConfig(): MacAddressConfiguration {
    const configuration = this.entity.dto.sc;
    const macData = _.get(configuration, MAC_ADDRESS, {});

    if (!_.has(macData, 'mac')) {
      return this.getDefaultValue();
    }

    return {
      mode: MAC_ADDRESS_MODE.MANUAL,
      address: _.get(macData, 'mac', ''),
    };
  }

  public override getValueChangingQuery(model: Partial<MacAddressConfiguration>): RciQuery[] {
    if (model?.mode === MAC_ADDRESS_MODE.CLONE) {
      return this.cloneAddress();
    }

    if (model?.mode === MAC_ADDRESS_MODE.MANUAL && model?.address) {
      return this.setAddress(model?.address ?? '');
    }

    return this.setDefaultAddress();
  }

  // "Extra" methods
  public getCurrentAddress(): MacAddressConfiguration['address'] {
    const status = this.entity.dto.show;

    return String(_.get(status, 'mac', ''));
  }

  public setAddress(mac: string): RciQuery[] {
    return makeConfigurationQueries(this.entity.name, MAC_ADDRESS, mac ? {mac} : NO_COMMAND);
  }

  public cloneAddress(): RciQuery[] {
    return makeConfigurationQueries(this.entity.name, 'mac', {clone: {}});
  }

  public setDefaultAddress(): RciQuery[] {
    return makeConfigurationQueries(this.entity.name, MAC_ADDRESS, NO_COMMAND);
  }

  protected override areValuesEqual(
    value1: Partial<MacAddressConfiguration>,
    value2: Partial<MacAddressConfiguration>,
  ): boolean {
    if (value1?.mode !== value2?.mode) {
      return false;
    }

    // `mode` values are equal;
    // for DEFAULT and CLONE modes `address` value is irrelevant
    if (value1?.mode !== MAC_ADDRESS_MODE.MANUAL) {
      return true;
    }

    return value1?.address === value2?.address;
  }
}
