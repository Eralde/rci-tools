import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

export class PppProcessor implements LayerProcessor {
  public readonly tag = 'PppProcessor';
  public readonly layer = 'link';
  public readonly processedDetails = [
    'ppp', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#PPP
    'ppp-tunnel', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#PPP-Tunnel
  ];

  // eslint-disable-next-line max-lines-per-function
  public processLayer({layerStatus, layerDetails, entityStatus}: ProcessLayerArgument): EntityStatusInfo | null {
    const ppp = layerDetails?.['ppp'];
    const pppTunnel = layerDetails['ppp-tunnel'];

    if (ppp?.status === 'disabled' || pppTunnel?.status === 'disabled') {
      return {
        kind: layerStatus,
        status: ENTITY_STATUS.UNCONFIGURED,
        type: STATUS_TYPE.WARNING,
        details: ppp || pppTunnel,
      };
    }

    if (ppp?.status === 'pending' || pppTunnel?.status === 'pending') {
      return {
        kind: layerStatus,
        status: ENTITY_STATUS.FAIL_VIA,
        type: STATUS_TYPE.INFO,
        extraInfo: {
          via: _.get(entityStatus, 'via', ''),
        },
      };
    }

    if (ppp?.status === 'connecting' || pppTunnel?.status === 'connecting') {
      const relevantDetails = [ppp, pppTunnel].find((block) => _.has(block, 'last-fail'));

      // No failure specified in either block
      if (!relevantDetails) {
        return {
          kind: layerStatus,
          status: ENTITY_STATUS.CONNECTING,
          type: STATUS_TYPE.INFO,
        };
      }

      const lastFailReason = _.get(relevantDetails, 'last-fail');

      switch (lastFailReason) {
        case 'conflict':
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.IPV4_CONFLICT,
            type: STATUS_TYPE.WARNING,
            details: relevantDetails,
            extraInfo: _.get(entityStatus, 'conflict', {}),
          };

        case 'auth':
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.FAIL_AUTH,
            type: STATUS_TYPE.WARNING,
            details: relevantDetails,
          };

        case 'resolve':
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.FAIL_PPP_RESOLVE,
            type: STATUS_TYPE.WARNING,
            details: relevantDetails,
          };

        // generic `pppd` error
        default:
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.FAIL_PPP,
            type: STATUS_TYPE.WARNING,
            details: relevantDetails,
            extraInfo: {
              reason: lastFailReason,
            },
          };
      }
    }

    return null;
  }
}
