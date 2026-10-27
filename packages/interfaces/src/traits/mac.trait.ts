import * as _ from 'lodash-es';
import type {ModelContext} from '../context';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {MacAddressField} from '../fields';
import {BaseTrait} from './base/base.trait';

export interface MacTrait extends BaseTrait {
  mac: MacAddressField;
}

export class MacTrait extends BaseTrait implements MacTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.mac = new MacAddressField(this);
  }

  public getCurrentMac(): string {
    const mac = this.dto?.show?.['mac'];

    return _.isString(mac) ? mac : '';
  }
}
