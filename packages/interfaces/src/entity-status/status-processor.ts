import * as _ from 'lodash-es';
import type {BaseTrait} from '../traits';
import {
  ENTITY_STATUS,
  type EntityStatusInfo,
  IP_LAYERS,
  LAYER_CHECK_ORDER,
  type LayerProcessor,
  type LayerProcessorConf,
  REQUIRED_LAYERS,
  STATUS_TYPE,
} from './status.types';
import {
  type Constructable,
  type GenericInterfaceStatus,
  type GenericObject,
  type InterfaceLayerSummary,
  type InterfaceStatusDetails,
  type NdmLayerName,
} from '../rci';

export class StatusProcessor {
  constructor(
    protected entity: BaseTrait,
    protected layerProcessors: LayerProcessorConf = {},
  ) {
  }

  public plugProcessor<T extends LayerProcessor>(processorConstructor: Constructable<T>): void {
    const processor = new processorConstructor();
    const {tag, layer} = processor;

    if (!this.layerProcessors[layer]) {
      this.layerProcessors[layer] = new Map();
    }

    const processorsMap = this.layerProcessors[layer];

    if (processorsMap?.has(tag)) {
      return;
    }

    processorsMap?.set(tag, processor);
  }

  public getStatus(): EntityStatusInfo {
    const interfaceStatus = this.entity.dto.show;
    const details = interfaceStatus?.['details'] as GenericInterfaceStatus['details'];
    const statusPerLayer = _.get(interfaceStatus, 'summary.layer') as InterfaceLayerSummary;

    if (!statusPerLayer || !details) {
      return {kind: 'unknown', status: ENTITY_STATUS.UNKNOWN, type: STATUS_TYPE.INFO};
    }

    const existingLayers = _.keys(statusPerLayer) as NdmLayerName[];
    const connectedStatusOrNull = this.checkIfConnected(interfaceStatus, existingLayers);

    if (connectedStatusOrNull !== null && connectedStatusOrNull?.status !== ENTITY_STATUS.CONNECTED_TO_IPV6) {
      return connectedStatusOrNull;
    }

    const detailsPerLayer = existingLayers.reduce(
      (acc, layer) => {
        acc[layer] = _.pickBy(details, (item) => item.layer === layer);

        return acc;
      },
      {} as Partial<Record<NdmLayerName, InterfaceStatusDetails>>,
    );

    for (const layer of LAYER_CHECK_ORDER) {
      const layerProcessors = this.layerProcessors[layer];

      if (
        !statusPerLayer[layer]
        || statusPerLayer[layer] === 'running'
        || !layerProcessors
        || layerProcessors?.size === 0
      ) {
        continue;
      }

      const processors = Array.from(layerProcessors.values());

      for (const processor of processors) {
        const detailsWithMatchingStatus = processor.processedDetails.filter((key) => {
          return _.get(detailsPerLayer, [layer, key, 'status']) === statusPerLayer[layer];
        });

        // The status of the layer is determined by the `details` items
        // that are not processed by the current processor
        if (detailsWithMatchingStatus.length === 0) {
          continue;
        }

        const status = processor.processLayer({
          layerStatus: statusPerLayer[layer],
          layerDetails: detailsPerLayer[layer] ?? {},
          entityStatus: this.entity.dto.show,
          NDM: this.entity.NDM,
        });

        if (status) {
          return status;
        }
      }
    }

    this.entity.NDM.logger.warning(`Unable to determine "${this.entity.name}" status!`, {statusPerLayer, details});

    return {kind: 'unknown', status: ENTITY_STATUS.UNKNOWN, type: STATUS_TYPE.INFO};
  }

  protected hasLayerSummary(layer: NdmLayerName): boolean {
    const show = this.entity.dto.show;
    const summary = show?.['summary'] as GenericInterfaceStatus['summary'];

    return _.has(summary.layer, layer);
  }

  protected isLayerRunning(layer: NdmLayerName): boolean {
    const show = this.entity.dto.show;
    const summary = show?.['summary'] as GenericInterfaceStatus['summary'];

    return summary?.layer[layer] === 'running';
  }

  // This method checks interface status __summary__ for two separate groups of layers:
  // - "base" layers (`conf`, `link`, `ctrl`)
  // - IP layers (`ipv4` and `ipv6`)
  //
  // If one of the base levels is not in the "running" state, this method will return `null`, which means that
  // the current state of the interface cannot be interpreted as "connected".
  //
  // If one of the IP layers is not in the "running" state, however, this method will return an `EntityStatusInfo` object
  // with one of the two possible status values: `ENTITY_STATUS.CONNECTED` or `ENTITY_STATUS.CONNECTED_TO_IPV6`.
  //
  // The `ENTITY_STATUS.CONNECTED` status means that the interface is successfully connected and any additional
  // processing of status details is not necessary.
  //
  // The `ENTITY_STATUS.CONNECTED_TO_IPV6` status is returned if all levels except `ipv4` are in the "running" state.
  // This status should be additionally clarified by processing the `ipv4` level details for any IPv4-related issued
  // (e.g., an IPv4 address conflict).
  //
  // @see https://ndm.atlassian.net/browse/NDW3-1362
  protected checkIfConnected(
    interfaceStatus: GenericObject,
    existingLayers: NdmLayerName[],
  ): EntityStatusInfo | null {
    const existingRequiredLayers = REQUIRED_LAYERS.filter((layer) => existingLayers.includes(layer));

    if (existingRequiredLayers.some((layer) => !this.isLayerRunning(layer))) {
      return null;
    }

    // E.g. an AccessPoint included into a bridge
    if (IP_LAYERS.every((layer) => !this.hasLayerSummary(layer))) {
      return {
        kind: 'running',
        type: STATUS_TYPE.SUCCESS,
        status: ENTITY_STATUS.CONNECTED,
      };
    }

    // Append any additional data that might be useful
    // to display status info of a connected interface to this object
    const extraInfo = _.pickBy({
      address: interfaceStatus?.['address'] ?? '',
    });

    if (existingLayers.every((layer) => this.isLayerRunning(layer))) {
      return {
        kind: 'running',
        type: STATUS_TYPE.SUCCESS,
        status: ENTITY_STATUS.CONNECTED,
        extraInfo,
      };
    }

    if (IP_LAYERS.every((layer) => !this.isLayerRunning(layer))) {
      return null;
    }

    const partialStatusInfo: Omit<EntityStatusInfo, 'status'> = {
      kind: 'running',
      type: STATUS_TYPE.SUCCESS,
      extraInfo,
    };

    if (this.isLayerRunning('ipv4') && this.isLayerRunning('ipv6')) {
      return {
        ...partialStatusInfo,
        status: ENTITY_STATUS.CONNECTED,
      };
    }

    // We treat `this.isLayerRunning('ipv4') && !this.isLayerRunning('ipv6')`
    // as `ENTITY_STATUS.CONNECTED`, because for most people IPv4 only is good enough
    // (e.g., IPv6 is disabled in the configuration, so 'ipv6' layer status is 'disabled')
    return this.isLayerRunning('ipv4')
      ? {...partialStatusInfo, status: ENTITY_STATUS.CONNECTED}
      : {...partialStatusInfo, status: ENTITY_STATUS.CONNECTED_TO_IPV6};
  }
}
