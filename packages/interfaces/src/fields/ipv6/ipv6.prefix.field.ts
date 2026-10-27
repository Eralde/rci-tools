import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {ObjectListField} from '../list/object.list.field';
import {AUTO_KEYWORD, AUTO_MODE_IS_DISABLED, EMPTY_IPV6_WITH_AUTO_LIST} from './ipv6.constants';
import {type Ipv6PrefixValue} from '../../rci';

export class Ipv6PrefixField extends ObjectListField<Ipv6PrefixValue> {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(
      entity,
      Ipv6PrefixField.strToIpv6PrefixItem,
      Ipv6PrefixField.ipv6PrefixItemToStr,
      'ipv6.prefix',
    );
  }

  public static strToIpv6PrefixItem(str: string): Ipv6PrefixValue {
    if (str === AUTO_KEYWORD) {
      return {[AUTO_KEYWORD]: true};
    }

    return {prefix: str};
  }

  public static ipv6PrefixItemToStr(item: Ipv6PrefixValue): string {
    if (_.has(item, AUTO_KEYWORD)) {
      return item[AUTO_KEYWORD]
        ? AUTO_KEYWORD
        : AUTO_MODE_IS_DISABLED;
    }

    return String(item.prefix);
  }

  public override getScalarList(): string[] {
    return super.getScalarList()
      .filter((item) => item !== AUTO_MODE_IS_DISABLED);
  }

  public override deleteAll(): RciQuery[] {
    if (_.isEqual(this.configValue, EMPTY_IPV6_WITH_AUTO_LIST)) {
      return [];
    }

    return super.deleteAll();
  }
}
