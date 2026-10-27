import {Mixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {ModelContext} from '../context';
import {BaseTrait, RolesTrait} from '../traits';
import {
  type DelayedInitActions,
  type EntityDto,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
  type NdmRciIpoeListItem,
  type NdmRciIpvcListItem,
} from '../entity-model.types';
import {ENTITY_STATUS, type EntityStatusInfo, EthernetProcessor, STATUS_TYPE} from '../entity-status';
import {type GenericObject, NDM_NETWORK_ROLE, type NdmNetworkRole} from '../rci';

// dprint-ignore
export interface PortEntity extends
  BaseTrait,
  RolesTrait
{
  isCablePlugged(): boolean;
  getSwitchId(): string;
  getLabel(): string;
  isSfpPort(): boolean;
  isComboPort(): boolean;
  isSfpTransceiverActive(): boolean;
  isWanPort(): boolean;
}

const PortEntityMixin = Mixin(
  BaseTrait,
  RolesTrait,
);

export class PortEntity extends PortEntityMixin implements PortEntity {
  protected readonly label: string;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    // Cannot be changed
    this.label = _.get(dto, 'show.label', '');

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(EthernetProcessor);
    });
  }

  // ge1/0 has no 'inet' role in the configuration,
  // so we need to check if it is configured as inet port via the 'allIpoe' list
  public override getRoles(): NdmNetworkRole[] {
    if (_.has(this.dto, 'sc.role')) {
      const roleList: GenericObject[] = _.get(this.dto, 'sc.role', []) as GenericObject[];

      return _.map(roleList, (item) => {
        return (_.isString(item) ? item : item['role']) as NdmNetworkRole;
      });
    }

    const ipvcOwner = this.getIpvcOwner();

    if (ipvcOwner) {
      return [ipvcOwner.role];
    }

    const ipoeOwner = this.getIpoeOwner();

    // Non-inet ports will get the role assigned by the 'interface/ipoe' interlayer
    return ipoeOwner ? [NDM_NETWORK_ROLE.INET] : [];
  }

  // ge1/0 has no 'inet' role in the configuration,
  // so we need to check if it is configured as inet port via the 'allIpoe' list
  public override getRoleOwner(): InterfaceEntityType | null {
    if (_.has(this.dto, 'sc.role')) {
      const ifor = String(_.get(this.dto, 'sc.role[0].ifor', ''));

      return this.getEntityByName(ifor);
    }

    const ipvcOwner = this.getIpvcOwner();

    if (ipvcOwner) {
      return this.getEntityByName(ipvcOwner.id);
    }

    const ipoeOwner = _.find(this.dto.allIpoe, (ipoe) => ipoe['inet-port'] === this.label);

    if (!ipoeOwner) {
      return null;
    }

    return this.getEntityByName(ipoeOwner.id);
  }

  public override hasRoleOwner(): boolean {
    return !_.isNull(this.getRoleOwner());
  }

  public isCablePlugged(): boolean {
    return this.status.link;
  }

  public getSwitchId(): string {
    return this.name.split('/')[0] ?? '';
  }

  public getLabel(): string {
    return this.label;
  }

  // Changes in the API:
  // @see https://ndm.atlassian.net/browse/NDM-4328
  public isSfpPort(): boolean {
    return _.has(this.dto.show, 'sfp');
  }

  public isComboPort(): boolean {
    return !!_.get(this.dto.show, 'sfp.combo');
  }

  public isSfpTransceiverActive(): boolean {
    return _.get(this.dto.show, 'sfp.transceiver') === 'external';
  }

  public isWanPort(): boolean {
    return this.getRoles().includes(NDM_NETWORK_ROLE.INET);
  }

  // Overloads base method
  public override getStatus(): EntityStatusInfo {
    const statusInfo = this.statusProcessor?.getStatus();

    if (statusInfo.status === ENTITY_STATUS.DISABLED) {
      return {
        kind: 'pending',
        type: STATUS_TYPE.WARNING,
        status: ENTITY_STATUS.FAIL_PORT_DISABLED,
      };
    }

    return statusInfo;
  }

  private getIpvcOwner(): NdmRciIpvcListItem | null {
    return _.find(this.dto.allIpvc, (ipvc) => ipvc.port.includes(this.label)) ?? null;
  }

  private getIpoeOwner(): NdmRciIpoeListItem | null {
    const ipoeOwner = _.find(this.dto.allIpoe, (ipoe) => {
      return ipoe['inet-port'] === this.label
        || ipoe['iptv-port'].includes(this.label)
        || ipoe['voip-port'].includes(this.label);
    });

    return ipoeOwner ?? null;
  }
}

export const isPortEntity = (entity: InterfaceEntityType | BaseTrait): entity is PortEntity => {
  return entity.type === NDM_INTERFACE_TYPE.Port;
};
