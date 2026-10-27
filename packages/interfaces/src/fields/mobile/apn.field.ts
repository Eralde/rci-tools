import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import type {BaseTrait} from '../../traits';
import {BaseField} from '../_base.field';
import {NO_COMMAND} from '../../rci';

// 'interface {name} mobile apn comment' is coupled with
// the 'interface {name} mobile apn' and can't be configured separately
export interface ApnModel {
  apn: string;
  comment?: string;
}

export class ApnField extends BaseField<ApnModel> {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(entity, 'mobile.apn');
  }

  public getDefaultValue(): ApnModel {
    return {
      apn: '',
      comment: '',
    };
  }

  public override readConfig(): ApnModel {
    const apnData = _.get(this.entity.dto, this.readPath, {});

    const apn = _.get(apnData, 'apn', '');
    const comment = _.get(apnData, 'comment', '');

    return {apn, comment};
  }

  public override getValueChangingQuery(model: ApnModel): RciQuery[] {
    const data = model.apn
      ? {
        apn: model.apn,
        comment: model.comment || '',
      }
      : NO_COMMAND;

    return makeConfigurationQueries(this.entity.name, this.writePath, data);
  }
}
