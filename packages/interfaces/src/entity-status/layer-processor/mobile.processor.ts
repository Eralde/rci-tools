import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatus,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';
import {CONNECTION_STATE, YES_NO_VALUE} from '../../rci';

const ndmStageToStatus: Record<string, EntityStatus> = {
  'device': ENTITY_STATUS.INITIALIZING_DEVICE,
  'network': ENTITY_STATUS.WAITING_FOR_NETWORK,
  'base-station': ENTITY_STATUS.CONNECTING_TO_BASE_STATION,
  'scanning': ENTITY_STATUS.SCANNING,
};

const ndmReasonToStatus: Record<string, EntityStatus> = {
  'traffic-limit': ENTITY_STATUS.TRAFFIC_LIMIT_EXCEEDED,
  'sim-removed': ENTITY_STATUS.SIM_NOT_INSERTED,
  'sim-invalid': ENTITY_STATUS.SIM_INVALID,
  'sim-pin-code': ENTITY_STATUS.SIM_PIN_REQUIRED,
  'sim-blocked': ENTITY_STATUS.SIM_BLOCKED,
  'sim-slot-inactive': ENTITY_STATUS.SIM_SLOT_INACTIVE,
};

export class MobileProcessor implements LayerProcessor {
  public readonly tag = 'MobileProcessor';
  public readonly layer = 'ctrl';
  public readonly processedDetails = [
    'mobile', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Mobile
  ];

  // eslint-disable-next-line max-lines-per-function
  public processLayer({layerStatus, layerDetails, entityStatus, NDM}: ProcessLayerArgument): EntityStatusInfo | null {
    if (!['connecting', 'pending'].includes(layerStatus)) {
      return null;
    }

    const connectionState = _.get(entityStatus, 'connection-state', '');
    const ndmStage = layerDetails['mobile']?.stage ?? '';
    const ndmReason = layerDetails['mobile']?.reason ?? '';

    // This is a workaround for handling the "modem is initializing" state.
    // It is possible to get an incomplete `mobile` detail with no `stage` or `reason` fields:
    // ```javascript
    // // summary
    // {
    //     "layer": {
    //         "conf": "running",
    //         "link": "connecting",
    //         "ipv4": "pending",
    //         "ipv6": "pending",
    //         "ctrl": "pending" (or "connecting")
    //     }
    // }
    //
    // +
    //
    // // details
    // {
    //     // ...,
    //     "mobile": { // <--------------- no `stage` or `reason` here
    //         "layer": "ctrl",
    //         "status": "pending", (or "connecting")
    //         "age": 27
    //     },
    //     "usblte": {
    //         "layer": "link",
    //         "status": "connecting",
    //         "age": 1
    //     }
    // }
    // ```
    //
    // In this case we additionally check the `connection-state` property
    // and return the `INITIALIZING_DEVICE` status the `connection-state === "Initializing"`.
    if (!ndmStage && !ndmReason && connectionState === CONNECTION_STATE.INITIALIZING) {
      return {
        kind: layerStatus,
        status: ENTITY_STATUS.INITIALIZING_DEVICE,
        type: STATUS_TYPE.INFO,
        extraInfo: {
          connectionState,
        },
      };
    }

    if (layerStatus === 'connecting') {
      if (_.has(ndmStageToStatus, ndmStage)) {
        return {
          kind: layerStatus,
          status: ndmStageToStatus[ndmStage] as EntityStatus,
          type: STATUS_TYPE.INFO,
          extraInfo: {
            connectionState,
          },
        };
      } else {
        NDM.logger.warning(`Unknown reason for the "${layerStatus}" [${this.layer}] layer state!`, layerDetails);

        return {kind: layerStatus, status: ENTITY_STATUS.UNKNOWN, type: STATUS_TYPE.INFO};
      }
    }

    // layerStatus === 'pending'
    if (_.has(ndmReasonToStatus, ndmReason)) {
      return {
        kind: layerStatus,
        status: ndmReasonToStatus[ndmReason] as EntityStatus,
        type: STATUS_TYPE.WARNING,
        extraInfo: {
          connectionState,
        },
      };
    }

    if (
      // for embedded unplugged modems the `mobile` detail is irrelevant
      _.get(entityStatus, 'embedded') // [!] Using type guards + `entity.isInternalModem` here breaks the build
      && _.get(entityStatus, 'plugged') === YES_NO_VALUE.NO
    ) {
      return null;
    }

    NDM.logger.warning(`Unknown reason for the "${layerStatus}" [${this.layer}] layer state!`, layerDetails);

    return {kind: layerStatus, status: ENTITY_STATUS.UNKNOWN, type: STATUS_TYPE.INFO};
  }
}
