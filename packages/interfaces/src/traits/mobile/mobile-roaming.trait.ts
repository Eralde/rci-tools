import type {ModelContext} from '../../context';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import {BooleanField} from '../../fields';
import {BaseTrait} from '../base/base.trait';

export interface MobileRoamingTrait extends BaseTrait {
  isRoamingEnabled: BooleanField;
}

export class MobileRoamingTrait extends BaseTrait implements MobileRoamingTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.isRoamingEnabled = new BooleanField(this, 'mobile.roaming');
  }
}
