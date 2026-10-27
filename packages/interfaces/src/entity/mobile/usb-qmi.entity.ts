import {
  CUSTOM_INTERFACE_TYPE,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {MobileExtendedEntity} from './_mobile-extended.entity';

export interface UsbQmiEntity extends MobileExtendedEntity {}

export class UsbQmiEntity extends MobileExtendedEntity implements UsbQmiEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.UsbQmi;

  public override getTypeInfo(): EntityTypeInfo {
    if (this.isInternalModem()) {
      return {parts: [CUSTOM_INTERFACE_TYPE.INTERNAL_QMI_MODEM]};
    }

    return super.getTypeInfo();
  }
}

export const isUsbQmiEntity = (entity: InterfaceEntityType | BaseTrait): entity is UsbQmiEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.UsbQmi;
};
