import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import type {ModelContext} from '../context';
import {BaseTrait} from './base/base.trait';
import {BooleanField} from '../fields';

export interface IpcpTrait extends BaseTrait {
  ipcpDefaultRoute: BooleanField;
  ipcpDnsRoutes: BooleanField;
  ipcpAddress: BooleanField;
}

export class IpcpTrait extends BaseTrait implements IpcpTrait {
  public ipcpDefaultRoute: BooleanField;
  public ipcpDnsRoutes: BooleanField;
  public ipcpAddress: BooleanField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ipcpDefaultRoute = new BooleanField(this, 'ipcp.default-route');
    this.ipcpDnsRoutes = new BooleanField(this, 'ipcp.dns-routes');
    this.ipcpAddress = new BooleanField(this, 'ipcp.address');
  }
}
