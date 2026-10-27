import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {BaseField, type FieldOptions} from '../_base.field';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {NO_COMMAND} from '../../rci';

export class EnumField<Enum> extends BaseField<Enum> {
  constructor(
    public override entity: BaseTrait,
    public readonly defaultValue: Enum,
    public override writePath: string,
    public override options: Omit<FieldOptions<Enum>, 'defaultValue'> = {},
  ) {
    super(entity, writePath, options);
  }

  public getDefaultValue(): Enum {
    return this.defaultValue;
  }

  public override getValueChangingQuery(value: Enum): RciQuery[] {
    if (!this.areRequirementsFulfilled()) {
      return [];
    }

    const data = value === this.defaultValue
      ? NO_COMMAND
      : String(value);

    return makeConfigurationQueries(this.entity.name, this.writePath, data);
  }
}
