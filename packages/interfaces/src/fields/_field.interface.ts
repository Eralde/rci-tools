import type {RciQuery} from '@rci-tools/core';
import {type GenericObject} from '../rci';

export interface ReadableField<ValueType> {
  readConfig(options?: GenericObject): ValueType;

  getDefaultValue(): ValueType;
}

export interface WritableField<ValueType> extends ReadableField<ValueType> {
  getValueChangingQuery(model: Partial<ValueType>): RciQuery[];

  writeConfig(model: Partial<ValueType>): RciQuery[];
}
