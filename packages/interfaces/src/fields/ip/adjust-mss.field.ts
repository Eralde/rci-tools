import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import type {BaseTrait} from '../../traits';
import {BaseField} from '../_base.field';
import {IP_TCP_ADJUST_MSS} from './ip.constants';
import {NO_COMMAND} from '../../rci';

export class AdjustMssField extends BaseField<boolean> {
  constructor(
    protected override entity: BaseTrait,
  ) {
    super(entity, IP_TCP_ADJUST_MSS);
  }

  public getDefaultValue(): boolean {
    return true;
  }

  public override readConfig(): boolean {
    return _.has(this.entity.dto.sc, IP_TCP_ADJUST_MSS);
  }

  public override getValueChangingQuery(adjustMss: boolean): RciQuery[] {
    const value = adjustMss ? {pmtu: true} : NO_COMMAND;
    const adjustMssQuery = _.set({}, IP_TCP_ADJUST_MSS, value);

    return makeConfigurationQueries(
      this.entity.name,
      [
        adjustMssQuery,
      ],
    );
  }
}
