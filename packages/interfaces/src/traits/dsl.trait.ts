import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {IpvcEntity} from '../entity/dsl/ipvc.entity';
import type {DslEntity} from '../entity/dsl/dsl.entity';
import type {IpvcField, IpvcModel} from '../fields';
import {BaseTrait} from './base/base.trait';
import {NDM_NETWORK_ROLE} from '../rci';

export interface DslTrait extends BaseTrait {
  ipvc: IpvcField | null;

  getParentDslEntity(): DslEntity;
  getInetIpvc(): IpvcEntity;
  makeIpvcQueries(ipvcModel: IpvcModel): RciQuery[];
}

export class DslTrait extends BaseTrait implements DslTrait {
  // We mix this trait into both IpvcEntity and DslEntity,
  // but the DslEntity does not always have a matching `ipvc` object
  // (if there are other PVCs or VLANs on top of it).
  // That's why this property can be `null`.
  public ipvc!: IpvcField | null; // set by the entity constructor

  public getParentDslEntity(): DslEntity {
    const id = this.NDM.getParentDslInterface();

    return this._collection.find((_entity) => _entity.name === id) as DslEntity;
  }

  public getInetIpvc(): IpvcEntity | null {
    const ipvcList = _.get(this.dto, 'allIpvc', []);
    const inetIpvc = _.filter(ipvcList, (item) => _.get(item, 'role') === String(NDM_NETWORK_ROLE.INET));
    const inetIpvcId = _.get(inetIpvc, '[0].id', '');

    if (!inetIpvcId) {
      this.NDM.logger.warning('DslTrait.getInetIpvc: "inet" ipvc not found!', this.dto.allIpvc);

      return null;
    }

    return _.find(this._collection, (item) => item.name === inetIpvcId) as IpvcEntity
      || null;
  }

  public makeIpvcQueries(ipvcModel: IpvcModel): RciQuery[] {
    if (!this.ipvc) {
      this.NDM.logger.warning(`DslTrait.makeIpvcQueries: the "${this.name}" entity's ipvc is null`);

      return [];
    }

    return this.ipvc.makeIpvcQueries(this.getParentDslEntity().name, ipvcModel);
  }
}
