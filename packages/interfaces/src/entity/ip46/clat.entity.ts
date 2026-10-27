import * as _ from 'lodash-es';
import type * as Traits from '../../traits/base/base.trait';
import {type InterfaceEntityType, NDM_INTERFACE_TYPE} from '../../entity-model.types';
import {Ip46Entity} from './_ip46.entity';

export interface ClatEntity extends Ip46Entity {}

export class ClatEntity extends Ip46Entity implements Ip46Entity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.Clat;

  public getCurrentSource(): string {
    const status = this.dto.show;

    return String(_.get(status, 'clat.ipv6-address', ''));
  }

  public getCurrentDestination(): string {
    const status = this.dto.show;

    return String(_.get(status, 'clat.ipv6-remote-prefix', ''));
  }
}

export const isClatEntity = (entity: InterfaceEntityType | Traits.BaseTrait): entity is ClatEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.Clat;
};
