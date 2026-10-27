import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

export class Ipv4LayerProcessor implements LayerProcessor {
  public readonly tag = 'Ipv4LayerProcessor';
  public readonly layer = 'ipv4';
  public readonly processedDetails = [
    'ip', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#IPv4
    'dhcp-client', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#DHCP-client
  ];

  public processLayer({layerStatus, layerDetails, entityStatus}: ProcessLayerArgument): EntityStatusInfo | null {
    if (layerDetails?.['ipv4']?.status === 'disabled') {
      return {kind: layerStatus, status: ENTITY_STATUS.NO_IPV4, type: STATUS_TYPE.INFO};
    }

    if (layerDetails['dhcp-client']?.status === 'pending') {
      const {reason} = layerDetails['dhcp-client'];

      switch (reason) {
        case 'network conflict': {
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.IPV4_CONFLICT,
            details: layerDetails['dhcp-client'],
            extraInfo: _.get(entityStatus, 'conflict', {}),
            type: STATUS_TYPE.WARNING,
          };
        }

        case 'link-down':
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.FAIL_LINK,
            details: layerDetails['dhcp-client'],
            type: STATUS_TYPE.WARNING,
          };
      }

      return {
        kind: layerStatus,
        status: ENTITY_STATUS.FAIL_IPV4,
        details: layerDetails['dhcp-client'],
        type: STATUS_TYPE.WARNING,
      };
    }

    return null;
  }
}
