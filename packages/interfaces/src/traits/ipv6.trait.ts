import * as _ from 'lodash-es';
import type {ModelContext} from '../context';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {
  BooleanField,
  IPV6_GATEWAY,
  IPV6_NAME_SERVERS,
  Ipv6AddressField,
  Ipv6NameServerField,
  Ipv6PrefixField,
  StringField,
} from '../fields';
import {BaseTrait} from './base/base.trait';
import {type CurrentIpv6Address} from '../rci';

export const LINK_LOCAL_PREFIX = 'fe80';

export interface Ipv6Trait extends BaseTrait {
  ipv6Address: Ipv6AddressField;
  ipv6Prefix: Ipv6PrefixField;
  ipv6Gateway: StringField;
  dnsV6: Ipv6NameServerField;
  acceptRemoteDnsV6: BooleanField;

  getCurrentIpv6Addresses(includeLinkLocal: boolean): string[];
}

export class Ipv6Trait extends BaseTrait implements Ipv6Trait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ipv6Address = new Ipv6AddressField(this);
    this.ipv6Prefix = new Ipv6PrefixField(this);
    this.ipv6Gateway = new StringField(this, IPV6_GATEWAY);
    this.dnsV6 = new Ipv6NameServerField(this);
    this.acceptRemoteDnsV6 = new BooleanField(
      this,
      IPV6_NAME_SERVERS,
      {defaultValue: true},
    );
  }

  public getCurrentIpv6Addresses(includeLinkLocal: boolean = false): string[] {
    const list = _.get(this.dto.show, 'ipv6.addresses', []) as CurrentIpv6Address[];

    return list
      .map((item) => item?.address ?? '')
      .filter(Boolean)
      .filter((address) => {
        return includeLinkLocal || !address.startsWith(LINK_LOCAL_PREFIX);
      });
  }
}
