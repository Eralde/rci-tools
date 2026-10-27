import {
  CUSTOM_INTERFACE_TYPE,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {MobileExtendedEntity} from './_mobile-extended.entity';

export interface UsbLteEntity extends MobileExtendedEntity {}

export class UsbLteEntity extends MobileExtendedEntity implements UsbLteEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.UsbLte;

  public override getTypeInfo(): EntityTypeInfo {
    if (this.isInternalModem()) {
      return {parts: [CUSTOM_INTERFACE_TYPE.INTERNAL_LTE_MODEM]};
    }

    return super.getTypeInfo();
  }
}

export const isUsbLteEntity = (entity: InterfaceEntityType | BaseTrait): entity is UsbLteEntity => {
  return entity?.type === NDM_INTERFACE_TYPE.UsbLte;
};
