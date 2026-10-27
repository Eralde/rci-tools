import type {ModelContext} from '../context';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {AuthField} from '../fields';
import {BaseTrait} from './base/base.trait';

export interface AuthTrait extends BaseTrait {
  auth: AuthField;
}

export class AuthTrait extends BaseTrait implements AuthTrait {
  public auth: AuthField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.auth = new AuthField(this);
  }
}
