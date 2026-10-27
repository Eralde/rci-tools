import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {BaseField} from '../_base.field';
import {IP_GLOBAL} from './ip.constants';
import {NO_COMMAND} from '../../rci';

export const NO_IP_GLOBAL_ORDER_VALUE = -1;

export interface IpGlobalModel {
  isEnabled: boolean;
  order: number;
}

export class IpGlobalField extends BaseField<IpGlobalModel> {
  constructor(
    protected override entity: BaseTrait,
  ) {
    super(entity, IP_GLOBAL);
  }

  public get order(): number {
    return this.readConfig().order;
  }

  public get isEnabled(): boolean {
    return this.readConfig().isEnabled;
  }

  public override readConfig(): IpGlobalModel {
    const configuration = this.entity.dto.sc;

    const ipGlobalData = _.get(configuration, IP_GLOBAL, {});

    const isEnabled = _.has(ipGlobalData, 'order');
    const order = _.get(ipGlobalData, 'order', NO_IP_GLOBAL_ORDER_VALUE);

    return {
      isEnabled,
      order,
    };
  }

  public getDefaultValue(): IpGlobalModel {
    return {
      isEnabled: true,
      order: NO_IP_GLOBAL_ORDER_VALUE,
    };
  }

  public override getValueChangingQuery(model: Partial<IpGlobalModel>): RciQuery[] {
    let data;

    if (!model.isEnabled) {
      data = NO_COMMAND;
    } else if (_.has(model, 'order')) {
      data = {enabled: true, order: model.order};
    } else {
      data = {auto: true}; // enable & set order to the highest value (highest order === lowest priority)
    }

    return makeConfigurationQueries(
      this.entity.name,
      IP_GLOBAL,
      data,
    );
  }

  protected override areValuesEqual(value1: Partial<IpGlobalModel>, value2: Partial<IpGlobalModel>): boolean {
    if (value1?.isEnabled !== value2?.isEnabled) {
      return false;
    }

    // Both values are "no priority assigned"
    if (!value1?.isEnabled) {
      return true;
    }

    return value1?.order === value2?.order;
  }
}
