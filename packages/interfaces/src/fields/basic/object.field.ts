import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {BaseField, type FieldOptions} from '../_base.field';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import * as _ from 'lodash-es';
import {type GenericObject, NO_COMMAND} from '../../rci';

export class ObjectField extends BaseField<GenericObject> {
  constructor(
    public override entity: BaseTrait,
    public override writePath: string,
    public override options: FieldOptions<GenericObject> = {},
  ) {
    super(entity, writePath, options);
  }

  public override getValueChangingQuery(value: GenericObject): RciQuery[] {
    const data = _.isEmpty(value)
      ? NO_COMMAND
      : value;

    return makeConfigurationQueries(this.entity.name, this.writePath, data);
  }

  public getDefaultValue(): GenericObject {
    return this.options?.defaultValue ?? {};
  }
}
