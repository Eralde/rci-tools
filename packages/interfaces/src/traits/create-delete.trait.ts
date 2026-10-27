import type {RciQuery} from '@rci-tools/core';
import {DeletableTrait} from './deletable.trait';
import {makeConfigurationQueries} from '../helpers/query.helper';

export interface CreateDeleteTrait extends DeletableTrait {
  makeInsertionQueries(): RciQuery[];
}

export class CreateDeleteTrait extends DeletableTrait implements CreateDeleteTrait {
  public makeInsertionQueries(): RciQuery[] {
    return makeConfigurationQueries(this.name, {});
  }
}
