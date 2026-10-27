import type {ModelContext} from '../../context';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import {AdjustMssField} from '../../fields';
import {BaseTrait} from '../base/base.trait';

export interface AdjustMssTrait extends BaseTrait {
  adjustMss: AdjustMssField;
}

export class AdjustMssTrait extends BaseTrait implements AdjustMssTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.adjustMss = new AdjustMssField(this);
  }
}
