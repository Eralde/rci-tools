import type {RciQuery} from '@rci-tools/core';
import {BaseTrait} from './base/base.trait';
import {makeConfigurationQueries} from '../helpers/query.helper';
import {NO_COMMAND} from '../rci';

export interface DeletableTrait extends BaseTrait {
  makeDeletionQueries(): RciQuery[];
}

export class DeletableTrait extends BaseTrait implements DeletableTrait {
  public makeDeletionQueries(): RciQuery[] {
    return makeConfigurationQueries(this.name, NO_COMMAND);
  }
}
