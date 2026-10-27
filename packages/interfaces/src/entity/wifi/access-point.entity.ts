import {Mixin, hasMixin} from 'ts-mixer';
import {BaseTrait, IgmpTrait, IpMtuTrait, IpTrait, Ipv6Trait, MacTrait, RolesTrait, WifiTrait} from '../../traits';
import {BooleanField, StringField} from '../../fields';
import type {DelayedInitActions, EntityDto, InterfaceEntityType} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {ENTITY_STATUS, type EntityStatusInfo, WifiProcessor} from '../../entity-status';

// dprint-ignore
export interface AccessPointEntity extends
  BaseTrait,
  IgmpTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait,
  WifiTrait
{
  follow: StringField;
  hideSsid: BooleanField;
  wmm: BooleanField;
  rrm: BooleanField;
}

const AccessPointEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    IgmpTrait,
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
  ),
  Mixin(
    MacTrait,
    RolesTrait,
    WifiTrait,
  ),
);

export class AccessPointEntity extends AccessPointEntityMixin implements AccessPointEntity {
  public follow: StringField;
  public hideSsid: BooleanField;
  public wmm: BooleanField;
  public rrm: BooleanField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.follow = new StringField(this, 'follow.access-point');
    this.hideSsid = new BooleanField(this, 'hide-ssid');
    this.wmm = new BooleanField(this, 'wmm');
    this.rrm = new BooleanField(this, 'rrm');

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(WifiProcessor);
    });
  }

  // Overloads base method
  public override getStatus(): EntityStatusInfo {
    const statusInfo = super.getStatus(true); // always inherit WifiMaster state

    if (statusInfo.status !== ENTITY_STATUS.WIFI_DFS_CHECK_IN_PROGRESS) {
      return statusInfo;
    }

    const wifiMaster = this.getMasterEntity();

    if (!wifiMaster) {
      return statusInfo;
    }

    return {
      ...statusInfo,
      extraInfo: {
        remainingCheckDuration: wifiMaster.getRemainingDfsCheckDuration(),
      },
    };
  }
}

export const isAccessPointEntity = (entity: InterfaceEntityType | BaseTrait): entity is AccessPointEntity => {
  return hasMixin(entity, AccessPointEntityMixin);
};
