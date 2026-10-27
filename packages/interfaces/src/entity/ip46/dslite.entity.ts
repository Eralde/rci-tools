import * as _ from 'lodash-es';
import type {ModelContext} from '../../context';
import type * as Traits from '../../traits';
import {StringField} from '../../fields';
import {
  type DelayedInitActions,
  type EntityDto,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import {Ip46Entity} from './_ip46.entity';

export interface DsliteEntity extends Ip46Entity {
  destination: StringField;
}

export class DsliteEntity extends Ip46Entity implements DsliteEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.DsLite;

  public destination: StringField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<Traits.BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.destination = new StringField(this, 'tunnel.destination');
  }

  public getCurrentSource(): string {
    return String(_.get(this.dto.show, 'tunnel-local-source', ''));
  }

  public getCurrentDestination(): string {
    return String(_.get(this.dto.show, 'tunnel-remote-destination', ''));
  }
}

export const isDsliteEntity = (entity: InterfaceEntityType | Traits.BaseTrait): entity is DsliteEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.DsLite;
};
