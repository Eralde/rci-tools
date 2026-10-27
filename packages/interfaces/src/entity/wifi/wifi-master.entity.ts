import {Mixin, hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {ModelContext} from '../../context';
import * as Traits from '../../traits';
import {ChannelField, StringField} from '../../fields';
import type {DelayedInitActions, EntityDto, InterfaceEntityType} from '../../entity-model.types';
import {ENTITY_STATUS, type EntityStatusInfo, STATUS_TYPE, WifiProcessor} from '../../entity-status';
import {WIFI_BAND, type WifiBand} from '../../rci';

// dprint-ignore
export interface WifiMasterEntity extends
  Traits.BaseTrait,
  Traits.RolesTrait
{
  band(): WifiBand;
  getRemainingDfsCheckDuration(): number;
}

const WifiMasterEntityMixin = Mixin(
  Traits.BaseTrait,
  Traits.RolesTrait,
);

export class WifiMasterEntity extends WifiMasterEntityMixin implements WifiMasterEntity {
  public standard: StringField;
  public channelWidth: StringField;
  public channel: ChannelField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<Traits.BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.standard = new StringField(this, 'compatibility.0.annex');
    this.channelWidth = new StringField(this, 'channel.width');
    this.channel = new ChannelField(this);

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(WifiProcessor);
    });
  }

  public band(): WifiBand {
    return this.name === this.NDM.MASTER
      ? WIFI_BAND.BAND_2_GHZ
      : WIFI_BAND.BAND_5_GHZ;
  }

  public getRemainingDfsCheckDuration(): number {
    return Number(_.get(this.dto.show, 'dfs.cac', 0));
  }

  // Overloads base method
  public override getStatus(): EntityStatusInfo {
    const statusInfo = this?.statusProcessor.getStatus();

    if (statusInfo.status === ENTITY_STATUS.DISABLED) {
      return {
        kind: 'pending',
        status: ENTITY_STATUS.WIFI_MASTER_OFF,
        type: STATUS_TYPE.INFO,
      };
    }

    return statusInfo;
  }
}

export const isWifiMasterEntity = (entity: InterfaceEntityType | Traits.BaseTrait): entity is WifiMasterEntity => {
  return hasMixin(entity, WifiMasterEntityMixin);
};
