import {
  type DelayedInitActions,
  type EntityDto,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {BooleanField} from '../../fields';
import {TunnelEntity} from './_tunnel.entity';
import type {ModelContext} from '../../context';

// dprint-ignore
export interface PptpEntity extends TunnelEntity {
  ccp: BooleanField;
  mppe: BooleanField;
}

export class PptpEntity extends TunnelEntity implements PptpEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.PPTP;

  public ccp: BooleanField;
  public mppe: BooleanField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ccp = new BooleanField(this, 'ccp');
    this.mppe = new BooleanField(this, 'encryption.mppe');
  }
}

export const isPptpEntity = (entity: InterfaceEntityType | BaseTrait): entity is PptpEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.PPTP;
};
