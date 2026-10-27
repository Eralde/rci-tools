import * as _ from 'lodash-es';
import type * as Traits from '../../traits';
import {type InterfaceEntityType, NDM_INTERFACE_TYPE} from '../../entity-model.types';
import {Ip46Entity} from './_ip46.entity';

export interface MaptEntity extends Ip46Entity {}

export class MaptEntity extends Ip46Entity implements MaptEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.MapT;

  public getCurrentSource(): string {
    const status = this.dto.show;

    return String(_.get(status, 'map-t.ipv6-address', ''));
  }

  public getCurrentDestination(): string {
    const status = this.dto.show;

    return String(_.get(status, 'map-t.rules[0].dmr', ''));
  }
}

export const isMaptEntity = (entity: InterfaceEntityType | Traits.BaseTrait): entity is MaptEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.MapT;
};
