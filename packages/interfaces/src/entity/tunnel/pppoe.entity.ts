import {
  type DelayedInitActions,
  type EntityDto,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {StringField} from '../../fields';
import {TunnelEntity} from './_tunnel.entity';
import type {ModelContext} from '../../context';

// dprint-ignore
export interface PppoeEntity extends TunnelEntity {
  service: StringField;
}

export class PppoeEntity extends TunnelEntity implements PppoeEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.PPPoE;

  public service: StringField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.service = new StringField(this, 'pppoe.service');
  }
}

export const isPppoeEntity = (entity: InterfaceEntityType | BaseTrait): entity is PppoeEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.PPPoE;
};
