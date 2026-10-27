import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatus,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

const WIFI_RADIO_REASON_TO_STATUS: Record<string, EntityStatus> = {
  idle: ENTITY_STATUS.WIFI_MASTER_IDLE,
  dfs: ENTITY_STATUS.WIFI_DFS_CHECK_IN_PROGRESS,
  hardware: ENTITY_STATUS.WIFI_HWSTATE_OFF,
};

export class WifiProcessor implements LayerProcessor {
  public readonly tag = 'WifiProcessor';
  public readonly layer = 'link';
  // dprint-ignore
  public readonly processedDetails = [
    'wifi',       // WifiStation, AccessPoint
    'wifi-radio', // WifiMaster
  ];

  public processLayer({layerStatus, layerDetails}: ProcessLayerArgument): EntityStatusInfo | null {
    // AccessPoint and WifiStation
    // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Wi-Fi
    if (_.has(layerDetails, 'wifi')) {
      return {
        kind: layerStatus,
        status: layerDetails?.wifi?.reason === 'radio'
          ? ENTITY_STATUS.WIFI_MASTER_OFF
          : ENTITY_STATUS.WIFI_DISCONNECTED,
        type: STATUS_TYPE.INFO,
      };
    }

    // WifiMaster
    // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Wi-Fi-Radio
    if (_.has(layerDetails, 'wifi-radio')) {
      const reason = layerDetails['wifi-radio']?.reason ?? '';

      if (_.has(WIFI_RADIO_REASON_TO_STATUS, reason)) {
        return {
          kind: layerStatus,
          status: WIFI_RADIO_REASON_TO_STATUS[reason] as EntityStatus,
          type: STATUS_TYPE.INFO,
        };
      }

      return {
        kind: layerStatus,
        status: ENTITY_STATUS.DISABLED,
        type: STATUS_TYPE.INFO,
      };
    }

    return null;
  }
}
