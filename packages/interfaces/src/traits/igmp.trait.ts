import type {ModelContext} from '../context';
import {BooleanField} from '../fields';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {BaseTrait} from './base/base.trait';

export interface IgmpTrait extends BaseTrait {
  upstream: BooleanField;
  downstream: BooleanField;
}

export class IgmpTrait extends BaseTrait implements IgmpTrait {
  public upstream: BooleanField;
  public downstream: BooleanField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.upstream = new BooleanField(this, 'igmp.upstream');
    this.downstream = new BooleanField(this, 'igmp.downstream');
  }
}
