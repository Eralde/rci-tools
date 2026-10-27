import type {InterfaceEntityType} from '../../entity-model.types';
import type {BaseTrait} from '../../traits';
import {type UsbModemEntity, isUsbModemEntity} from './usb-modem.entity';
import {type CdcEthernetEntity, isCdcEthernetEntity} from './cdc-ethernet.entity';
import {type YotaEntity, isYotaEntity} from './yota.entity';
import {type UsbLteEntity, isUsbLteEntity} from './usb-lte.entity';
import {type UsbQmiEntity, isUsbQmiEntity} from './usb-qmi.entity';

export type MobileEntityType =
  | UsbLteEntity
  | UsbQmiEntity
  | UsbModemEntity
  | YotaEntity
  | CdcEthernetEntity;

export type ExtendedMobileEntity = UsbLteEntity | UsbQmiEntity;

export const isMobileEntity = (entity: InterfaceEntityType | BaseTrait): entity is MobileEntityType => {
  return isCdcEthernetEntity(entity)
    || isYotaEntity(entity)
    || isUsbQmiEntity(entity)
    || isUsbLteEntity(entity)
    || isUsbModemEntity(entity);
};

export const isExtendedMobileEntity = (entity: InterfaceEntityType): entity is ExtendedMobileEntity => {
  return (isUsbQmiEntity(entity) || isUsbLteEntity(entity));
};
