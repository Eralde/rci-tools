import type {BaseTrait} from '../../traits';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {BaseField} from '../_base.field';
import {type GenericObject, NO_COMMAND} from '../../rci';

const WRITE_PATH = 'dsl.isp-profile';

export interface DslIspProfileModel {
  country: string;
  profile?: string;
}

export class DslIspProfileField extends BaseField<DslIspProfileModel> {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(entity, WRITE_PATH);
  }

  public getDefaultValue(): DslIspProfileModel {
    return {
      country: '',
      profile: '',
    };
  }

  public override readConfig(): DslIspProfileModel {
    const configuration = this.entity.dto.sc;
    const fieldData = _.get(configuration, this.writePath) as DslIspProfileModel;

    if (!fieldData) {
      return this.getDefaultValue();
    }

    return {
      country: fieldData?.country ?? '',
      profile: fieldData?.profile ?? '',
    };
  }

  public override getValueChangingQuery(model: DslIspProfileModel): RciQuery[] {
    const writeData = this.getWriteData(model);

    return makeConfigurationQueries(this.entity.name, this.writePath, writeData);
  }

  protected getWriteData(model: Partial<DslIspProfileModel>): GenericObject {
    return model?.profile && model?.country
      ? model
      : NO_COMMAND;
  }

  protected override areValuesEqual(value1: Partial<DslIspProfileModel>, value2: Partial<DslIspProfileModel>): boolean {
    return _.isEqual(this.getWriteData(value1), this.getWriteData(value2));
  }
}
