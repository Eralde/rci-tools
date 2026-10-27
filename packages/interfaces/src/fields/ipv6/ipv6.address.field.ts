import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {ObjectListField} from '../list/object.list.field';
import {AUTO_KEYWORD, AUTO_MODE_IS_DISABLED, EMPTY_IPV6_WITH_AUTO_LIST} from './ipv6.constants';
import {type Ipv6AddressValue} from '../../rci';

export class Ipv6AddressField extends ObjectListField<Ipv6AddressValue> {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(
      entity,
      Ipv6AddressField.strToIpv6AddressItem,
      Ipv6AddressField.ipv6AddressItemToStr,
      'ipv6.address',
    );
  }

  public static strToIpv6AddressItem(str: string): Ipv6AddressValue {
    if (str === AUTO_KEYWORD) {
      return {[AUTO_KEYWORD]: true};
    }

    if (str.includes('/')) {
      return {block: str};
    }

    return {address: str};
  }

  public static ipv6AddressItemToStr(item: Ipv6AddressValue): string {
    if (_.has(item, AUTO_KEYWORD)) {
      return item[AUTO_KEYWORD]
        ? AUTO_KEYWORD
        : AUTO_MODE_IS_DISABLED;
    }

    return String(item.block)
      || String(item.address);
  }

  public override getScalarList(): string[] {
    return super.getScalarList()
      .filter((item) => item !== AUTO_MODE_IS_DISABLED);
  }

  public override deleteAll(): RciQuery[] {
    // In the updated version of the API related to IPv6 the `{auto: true|false}` element
    // is always present in the IPv6 addresses and IPv6 prefixes lists.
    if (_.isEqual(this.configValue, EMPTY_IPV6_WITH_AUTO_LIST)) {
      return [];
    }

    return super.deleteAll();
  }
}
