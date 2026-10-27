import {Mixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import {
  AuthTrait,
  BaseTrait,
  CreateDeleteTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  MobileTrait,
  RolesTrait,
} from '../../traits';
import {ConnectField, ObjectListField, StringField} from '../../fields';
import {
  type DelayedInitActions,
  type EntityDto,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {MobileProcessor, PppProcessor, UsbProcessor} from '../../entity-status';

// dprint-ignore
export interface UsbModemEntity extends
  AuthTrait,
  BaseTrait,
  CreateDeleteTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  MobileTrait,
  RolesTrait
{
  connect: ConnectField;
  phone: StringField;
  atCommands: ObjectListField<{string: string}>;
}

const UsbModemEntityMixin = Mixin(
  Mixin(
    AuthTrait,
    BaseTrait,
    CreateDeleteTrait,
    IpDnsTrait,
    IpMtuTrait,
  ),
  Mixin(
    IpTrait,
    MobileTrait,
    RolesTrait,
  ),
);

export class UsbModemEntity extends UsbModemEntityMixin implements UsbModemEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.UsbModem;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.connect = new ConnectField(this);
    this.phone = new StringField(this, 'modem.connect.phone');

    this.atCommands = new ObjectListField(
      this,
      (str) => ({string: str}),
      (obj) => String(_.get(obj, 'string', '')),
      'tty.init',
    );

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(MobileProcessor);
      statusProcessor.plugProcessor(UsbProcessor);
      statusProcessor.plugProcessor(PppProcessor);
    });
  }
}

export const isUsbModemEntity = (entity: InterfaceEntityType | BaseTrait): entity is UsbModemEntity => {
  return entity.type === NDM_INTERFACE_TYPE.UsbModem;
};
