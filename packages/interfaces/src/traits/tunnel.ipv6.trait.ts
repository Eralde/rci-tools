import type {ModelContext} from '../context';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {BooleanField} from '../fields';
import type {BaseTrait} from './base/base.trait';
import {Ipv6Trait} from './ipv6.trait';

export interface TunnelIpv6Trait extends Ipv6Trait {
  ipv6cp: BooleanField;
}

export class TunnelIpv6Trait extends Ipv6Trait implements TunnelIpv6Trait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ipv6cp = new BooleanField(this, 'ipv6cp');
  }
}
