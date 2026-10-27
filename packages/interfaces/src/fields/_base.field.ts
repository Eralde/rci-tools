import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../traits/base/base.trait';
import {makeConfigurationQueries} from '../helpers/query.helper';
import type {WritableField} from './_field.interface';

export type FieldOptions<ValueType> = Partial<{
  readPath: string;
  defaultValue: ValueType;

  // Field-specific requirements.
  // If a requirement is specified and unfulfilled,
  // then `getValueChangingQuery` method must return an empty array
  requiredFeature: string;
  requiredComponent: string;
  customRequirement: (field: BaseField<ValueType>) => boolean;
}>;

export abstract class BaseField<ValueType> implements WritableField<ValueType> {
  protected readPath!: string; // set by `setReadPath()`
  protected configValue!: Partial<ValueType>; // set by a delayed init action

  constructor(
    protected entity: BaseTrait,
    public writePath: string,
    public readonly options: FieldOptions<ValueType> = {},
  ) {
    this.setReadPath();

    this.entity.delayedInitActions.push(() => {
      this.configValue = this.readConfig();
    });
  }

  public abstract getDefaultValue(): ValueType;

  public readConfig(): ValueType {
    return _.get(this.entity.dto, this.readPath, this.getDefaultValue());
  }

  public getValueChangingQuery(model: Partial<ValueType>): RciQuery[] {
    if (!this.areRequirementsFulfilled()) {
      return [];
    }

    return makeConfigurationQueries(this.entity.name, this.writePath, model);
  }

  public writeConfig(model: Partial<ValueType>): RciQuery[] {
    if (this.areValuesEqual(this.configValue, model)) {
      return [];
    }

    return this.getValueChangingQuery(model);
  }

  protected areValuesEqual(value1: Partial<ValueType>, value2: Partial<ValueType>): boolean {
    return _.isEqual(value1, value2);
  }

  protected setReadPath(): void {
    if (this.options.readPath) {
      this.readPath = this.options.readPath;
    } else {
      this.readPath = `sc.${this.writePath}`;
    }
  }

  protected areRequirementsFulfilled(): boolean {
    if (this.options.requiredFeature) {
      return this.entity.NDM.hasFeature(this.options.requiredFeature);
    }

    if (this.options.requiredComponent) {
      return this.entity.NDM.isComponentInstalled(this.options.requiredComponent);
    }

    if (_.isFunction(this.options.customRequirement)) {
      return this.options.customRequirement(this);
    }

    return true;
  }
}
