import * as _ from 'lodash-es';
import type {BaseTrait} from '../../traits';
import {ObjectListField} from '../list/object.list.field';
import {type Ipv6NameServerValue} from '../../rci';

export type Ipv6NameServerItem = Ipv6NameServerValue | string;

export class Ipv6NameServerField extends ObjectListField<Ipv6NameServerItem> {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(
      entity,
      Ipv6NameServerField.strToIpv6NameServerItem,
      Ipv6NameServerField.ipv6NameServerItemToStr,
      'ipv6.name-server',
    );
  }

  public static strToIpv6NameServerItem(str: string): Ipv6NameServerItem {
    return {
      'name-server': str,
      'port': '', // At the moment `ndm` does not allow to specify a port for an IPv6 DNS server
    };
  }

  public static ipv6NameServerItemToStr(item: Ipv6NameServerItem): string {
    if (_.isString(item)) {
      return item;
    }

    return item['name-server'] ?? '';
  }
}
