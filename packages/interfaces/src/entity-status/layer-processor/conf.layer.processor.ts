import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

export class ConfLayerProcessor implements LayerProcessor {
  public readonly tag = 'ConfLayerProcessor';
  public readonly layer = 'conf';
  public readonly processedDetails = [
    'base', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Base
    'schedule',
    'mws', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#MWS
    'standby', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Standby
  ];

  public processLayer({layerStatus, layerDetails, NDM}: ProcessLayerArgument): EntityStatusInfo | null {
    if (layerStatus === 'disabled') {
      return {
        kind: 'disabled',
        status: ENTITY_STATUS.DISABLED,
        type: STATUS_TYPE.INFO,
      };
    }

    if (layerStatus === 'pending') {
      const pendingItemName = _.findKey(layerDetails, (item) => item.status === 'pending');

      if (!pendingItemName) {
        return {
          status: ENTITY_STATUS.UNKNOWN,
          kind: 'unknown',
          type: STATUS_TYPE.INFO,
        };
      }

      switch (pendingItemName) {
        case 'schedule':
          return {
            kind: 'disabled',
            status: ENTITY_STATUS.DISABLED_ON_SCHEDULE,
            type: STATUS_TYPE.INFO,
          };

        // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Base
        // MWS auto-shutdown is enabled and controller is unreachable:
        case 'mws':
          return {
            kind: 'disabled',
            status: ENTITY_STATUS.DISABLED_VIA_MWS,
            type: STATUS_TYPE.INFO,
          };

        // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Standby
        // The standby mode is enabled, and the interface priority is less than the current WAN connection.
        case 'standby':
          return {
            kind: 'pending',
            status: ENTITY_STATUS.ON_STANDBY,
            type: STATUS_TYPE.SPECIAL,
          };

        default:
          NDM.logger.warning(`Unknown reason for the "${layerStatus}" [${this.layer}] layer state!`, layerDetails);

          return {
            kind: 'disabled',
            status: ENTITY_STATUS.DISABLED,
            details: layerDetails[pendingItemName],
            type: STATUS_TYPE.INFO,
          };
      }
    }

    return null;
  }
}
