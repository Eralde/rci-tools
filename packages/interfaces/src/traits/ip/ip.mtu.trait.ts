import type {ModelContext} from '../../context';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import {StringField} from '../../fields';
import {BaseTrait} from '../base/base.trait';

export interface IpMtuTrait extends BaseTrait {
  mtu: StringField;
}

export class IpMtuTrait extends BaseTrait implements IpMtuTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.mtu = new StringField(this, 'ip.mtu');
  }
}
