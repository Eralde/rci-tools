import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

export class UsbProcessor implements LayerProcessor {
  public readonly tag = 'UsbProcessor';
  public readonly layer = 'link';
  public readonly processedDetails = [
    'usb', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#USB
  ];

  public processLayer({layerStatus, layerDetails, entityStatus}: ProcessLayerArgument): EntityStatusInfo | null {
    const detailsElement = layerDetails?.['usb'];

    if (layerStatus === 'pending' && detailsElement?.reason === 'sim-slot-inactive') {
      return {
        kind: layerStatus,
        type: STATUS_TYPE.INFO,
        status: ENTITY_STATUS.SIM_SLOT_INACTIVE,
      };
    }

    if (layerStatus !== 'detached') {
      return null;
    }

    // Internal 4G modem
    // [!] Using type guards + `entity.isInternalModem` here breaks the build
    if (_.get(entityStatus, 'embedded')) {
      return {
        kind: layerStatus,
        type: STATUS_TYPE.INFO,
        status: ENTITY_STATUS.REBOOTING,
      };
    }

    // External (USB) modem
    return {
      kind: layerStatus,
      type: STATUS_TYPE.WARNING,
      status: detailsElement?.reason === 'unplugged'
        ? ENTITY_STATUS.UNPLUGGED
        : ENTITY_STATUS.USB_POWER_DOWN,
    };
  }
}
