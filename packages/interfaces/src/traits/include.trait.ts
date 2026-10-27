import * as _ from 'lodash-es';
import {makeConfigurationQueries} from '../helpers/query.helper';
import type {RciQuery} from '@rci-tools/core';
import type {InterfaceEntityType} from '../entity-model.types';
import {BaseTrait} from './base/base.trait';
import {NO_COMMAND} from '../rci';

export interface IncludeTrait extends BaseTrait {
  getIncludedEntities(): InterfaceEntityType[];
  getIncludeQueries(interfaceId: string): RciQuery[];
  getExcludeQueries(interfaceId: string): RciQuery[];
}

export interface NdmIncludeItem {
  interface: string;
}

export class IncludeTrait extends BaseTrait implements IncludeTrait {
  public getIncludedEntities(): InterfaceEntityType[] {
    const includeList = _.get(this.dto, 'sc.include', []) as NdmIncludeItem[];
    const idList: string[] = includeList.map((item) => item.interface);

    return this.collection.filter((entity) => idList.includes(entity.name));
  }

  public getIncludeQueries(interfaceId: string): RciQuery[] {
    const data = {interface: interfaceId};

    return makeConfigurationQueries(this.name, 'include', data);
  }

  public getExcludeQueries(interfaceId: string): RciQuery[] {
    const data = {interface: interfaceId, ...NO_COMMAND};

    return makeConfigurationQueries(this.name, 'include', data);
  }
}
