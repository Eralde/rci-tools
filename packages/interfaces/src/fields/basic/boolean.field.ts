import * as _ from 'lodash-es';
import type {BaseTrait} from '../../traits';
import {BaseField, type FieldOptions} from '../_base.field';

/**
 * Standard boolean NDM configuration field implementation.
 * It can be used for 'up', 'ccp', 'wmm', etc.
 */
export class BooleanField extends BaseField<boolean> {
  constructor(
    public override entity: BaseTrait,
    public override writePath: string,
    public override readonly options: FieldOptions<boolean> = {defaultValue: false},
  ) {
    super(entity, writePath, options);
  }

  public getDefaultValue(): boolean {
    return this.options?.defaultValue ?? false;
  }

  public override readConfig(): boolean {
    return Boolean(_.get(this.entity.dto, this.readPath, this.getDefaultValue()));
  }
}
