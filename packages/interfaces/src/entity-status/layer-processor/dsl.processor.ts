import * as _ from 'lodash-es';
import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  type LayerProcessor,
  type ProcessLayerArgument,
  STATUS_TYPE,
} from '../status.types';

// @see https://ndm.atlassian.net/wiki/spaces/NDMS/pages/2407596033#DSL
export class DslProcessor implements LayerProcessor {
  public readonly tag = 'DslProcessor';
  public readonly layer = 'link';
  public readonly processedDetails = ['dsl'];

  public processLayer({layerStatus, layerDetails, entityStatus, NDM}: ProcessLayerArgument): EntityStatusInfo | null {
    const {dsl} = layerDetails;

    if (dsl?.status === 'disabled') {
      return {
        kind: layerStatus,
        status: ENTITY_STATUS.UNCONFIGURED,
        type: STATUS_TYPE.WARNING,
      };
    }

    if (dsl?.status === 'connecting') {
      const {stage} = dsl;

      switch (stage) {
        case 'idle':
          // eslint-disable-next-line no-case-declarations
          const noCarrierTime = Number(_.get(entityStatus, 'no-carrier', 0));

          return {
            kind: layerStatus,
            status: noCarrierTime > 0
              ? ENTITY_STATUS.FAIL_LINK
              : ENTITY_STATUS.DSL_LINE_CONNECTING,
            type: STATUS_TYPE.WARNING,
            extraInfo: {noCarrierTime},
          };

        case 'handshake':
        case 'training':
          return {
            kind: layerStatus,
            status: ENTITY_STATUS.DSL_LINE_CONNECTING,
            type: STATUS_TYPE.INFO,
          };

        default:
          NDM.logger.warning('DslProcessor: unhandled state', {dsl});

          return {
            kind: layerStatus,
            status: ENTITY_STATUS.UNKNOWN,
            type: STATUS_TYPE.INFO,
          };
      }
    }

    return null;
  }
}
