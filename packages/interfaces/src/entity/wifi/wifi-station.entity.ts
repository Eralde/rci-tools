import {Mixin, hasMixin} from 'ts-mixer';
import {
  BaseTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait,
  WifiTrait,
} from '../../traits';
import {BooleanField, StringField} from '../../fields';
import type {
  DelayedInitActions,
  EntityDto,
  EntityL10nData,
  EntityLabelData,
  EntityTypeInfo,
  InterfaceEntityType,
} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {WifiProcessor} from '../../entity-status';
import {type ModelTranslator, WIFI_BAND, type WifiBand, WifiEncryptionHelper} from '../../rci';

// dprint-ignore
export interface WifiStationEntity extends
  BaseTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait,
  WifiTrait
{
  bssid: StringField;
  backhaul: BooleanField;

  getCurrentSsid(): string;
}

const WifiStationEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    IgmpTrait,
    IpDnsTrait,
    IpMtuTrait,
    IpTrait,
  ),
  Mixin(
    Ipv6Trait,
    MacTrait,
    RolesTrait,
    WifiTrait,
  ),
);

export class WifiStationEntity extends WifiStationEntityMixin implements WifiStationEntity {
  public bssid: StringField;
  public backhaul: BooleanField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.bssid = new StringField(this, 'mac.bssid');
    this.backhaul = new BooleanField(this, 'backhaul');

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(WifiProcessor);
    });
  }

  public getBand(): WifiBand {
    return this.name.startsWith(this.NDM.MASTER)
      ? WIFI_BAND.BAND_2_GHZ
      : WIFI_BAND.BAND_5_GHZ;
  }

  public getCurrentSsid(): string {
    return String(this.dto?.show?.['ssid'] ?? '');
  }

  public override getLabelData(): EntityLabelData {
    const description = this.description.readConfig();
    const ssid = this.ssid.readConfig();
    const label = description || ssid;

    return {
      label,
      typeLabel: 'interface-translation.WISP',
      l10nData: this.getAdditionalInfo(),
      suffixData: {ssid},
    };
  }

  public override getTypeInfo(): EntityTypeInfo {
    return {
      ...super.getTypeInfo(),
      l10nData: this.getAdditionalInfo(),
    };
  }

  protected getAdditionalInfo(): EntityL10nData {
    return {
      band: (language: string, translate: ModelTranslator) => {
        return WifiEncryptionHelper.getBandL10n(this.getBand(), language, translate);
      },
    };
  }
}

export const isWifiStationEntity = (entity: InterfaceEntityType | BaseTrait): entity is WifiStationEntity => {
  return hasMixin(entity, WifiStationEntityMixin);
};
