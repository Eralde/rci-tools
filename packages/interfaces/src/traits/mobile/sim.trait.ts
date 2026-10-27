import * as _ from 'lodash-es';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {MobileTrait} from './mobile.trait';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import type {BaseTrait} from '../base/base.trait';
import {SIM_CARD_STATE, type SimCardState} from '../../rci';

export interface SimTrait extends MobileTrait {
  getSimState(): SimCardState;
  getPinAttemptsCount(): number;
  getSetPinCodeQueries(pin: string): RciQuery[];
}

export class SimTrait extends MobileTrait implements SimTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);
  }

  public getSimState(): SimCardState {
    return _.get(this.dto, 'show.sim', SIM_CARD_STATE.UNKNOWN) as SimCardState;
  }

  public getPinAttemptsCount(): number {
    return Number(_.get(this.dto, 'show.pin-attempts', 0));
  }

  public getSetPinCodeQueries(pin: string): RciQuery[] {
    return makeConfigurationQueries(this.name, 'sim', {pin});
  }
}
