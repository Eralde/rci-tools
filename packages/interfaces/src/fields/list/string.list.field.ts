import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import type {FieldOptions} from '../_base.field';
import {ObjectListField} from './object.list.field';
import type {RciListType} from './list.types';
import {NO_COMMAND} from '../../rci';

export class StringListField extends ObjectListField<string> {
  constructor(
    public override entity: BaseTrait,
    public override writePath: string,
    public override options: FieldOptions<RciListType<string>> = {},
  ) {
    super(entity, _.identity, _.identity, writePath, options);
  }

  public override setScalarList(list: string[]): RciQuery[] {
    if (this.isListEqual(list)) {
      return [];
    }

    if (list.length === 0) {
      return this.getValueChangingQuery(NO_COMMAND);
    }

    return this.getValueChangingQuery(list);
  }
}
