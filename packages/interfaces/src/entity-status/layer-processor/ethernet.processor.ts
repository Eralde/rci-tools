import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

export class EthernetProcessor implements LayerProcessor {
  public readonly tag = 'EthernetProcessor';
  public readonly layer = 'link';
  public readonly processedDetails = [
    'ethernet', // @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#Ethernet
  ];

  public processLayer({layerStatus, layerDetails}: ProcessLayerArgument): EntityStatusInfo | null {
    if (layerDetails?.['ethernet']?.status === 'pending') {
      return {kind: layerStatus, status: ENTITY_STATUS.FAIL_LINK, type: STATUS_TYPE.WARNING};
    }

    return null;
  }
}
