import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {BaseField, type FieldOptions} from '../_base.field';
import type {BaseTrait} from '../../traits';
import {NO_COMMAND} from '../../rci';

/**
 * Standard string NDM configuration field implementation.
 * It can be used for 'description', 'comment', etc.
 */
export class StringField extends BaseField<string> {
  constructor(
    public override entity: BaseTrait,
    public override writePath: string,
    public override readonly options: FieldOptions<string> = {defaultValue: ''},
  ) {
    super(entity, writePath, options);
  }

  public getDefaultValue(): string {
    return this.options?.defaultValue ?? '';
  }

  public override readConfig(): string {
    const config = _.get(this.entity.dto, this.readPath, this.getDefaultValue());

    return String(config);
  }

  public override getValueChangingQuery(data: string): RciQuery[] {
    if (!this.areRequirementsFulfilled()) {
      return [];
    }

    return makeConfigurationQueries(this.entity.name, this.writePath, data || NO_COMMAND);
  }
}
