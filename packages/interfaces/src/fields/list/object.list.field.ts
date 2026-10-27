import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {BaseField, type FieldOptions} from '../_base.field';
import type {RciListType} from './list.types';
import {NO_COMMAND} from '../../rci';

export class ObjectListField<T, S = string> extends BaseField<RciListType<T>> {
  protected override configValue: T[] = [];

  constructor(
    public override entity: BaseTrait,
    public fromScalar: (o: S) => T,
    public toScalar: (o: T) => S,
    public override writePath: string,
    public override options: FieldOptions<RciListType<T>> = {},
  ) {
    super(entity, writePath, options);

    this.setReadPath();
  }

  public getDefaultValue(): RciListType<T> {
    return [];
  }

  public deleteAll(): RciQuery[] {
    if (_.isEmpty(this.configValue)) {
      return [];
    }

    this.configValue = [];

    return this.getValueChangingQuery(NO_COMMAND);
  }

  public getScalarList(): S[] {
    return _.map(this.configValue, (item) => this.toScalar(item));
  }

  public setScalarList(list: S[]): RciQuery[] {
    if (this.isListEqual(list)) {
      return [];
    }

    const _list = [
      NO_COMMAND,
      ...list.map((item) => this.fromScalar(item)),
    ] as RciListType<T>;

    return this.getValueChangingQuery(_list);
  }

  public deleteOne(item: T): RciQuery[] {
    const currentLength = this.configValue.length;

    this.configValue = _.filter(this.configValue, (_item) => !_.isEqual(_item, item));

    if (this.configValue.length === currentLength) {
      return [];
    }

    return this.getValueChangingQuery([{...item, ...NO_COMMAND}]);
  }

  public override readConfig(): RciListType<T> {
    const list = _.get(this.entity.dto, this.readPath, []) as S[];

    return _.map(
      list,
      (item) => {
        return _.isObject(item)
          ? item as T
          : this.fromScalar(item);
      },
    );
  }

  protected isListEqual(value: S[]): boolean {
    const sortedCurrent = _.cloneDeep(this.getScalarList()).sort();
    const sortedNew = _.cloneDeep(value).sort();

    return _.isEqual(sortedCurrent, sortedNew);
  }
}
