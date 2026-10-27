import {BaseTrait} from './base/base.trait';
import {StringField} from '../fields';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import type {ModelContext} from '../context';

export interface TunnelPeerTrait extends BaseTrait {
  peer: StringField;
}

export class TunnelPeerTrait extends BaseTrait implements TunnelPeerTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.peer = new StringField(this, 'peer');
  }
}
