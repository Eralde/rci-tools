import type {ModelContext} from '../context';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {IpRemoteField} from '../fields';
import {BaseTrait} from './base/base.trait';

export interface TunnelRemoteTrait extends BaseTrait {
  remote: IpRemoteField;
}

export class TunnelRemoteTrait extends BaseTrait implements TunnelRemoteTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.remote = new IpRemoteField(this);
  }
}
