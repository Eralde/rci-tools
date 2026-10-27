import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {KNOWN_FEATURE, type ModelContext} from '../context';
import {BaseTrait} from './base/base.trait';
import {BooleanField, StringField, WrappedStringField} from '../fields';
import type {DelayedInitActions, EntityDto} from '../entity-model.types';
import {makeConfigurationQueries} from '../helpers/query.helper';
import type {WifiMasterEntity} from '../entity/wifi';
import {WIFI_BAND, WIFI_ENCRYPTION, type WifiBand, type WifiEncryption, WifiEncryptionHelper} from '../rci';

export interface WepKey {
  hex: string;
  id: number;
  default?: boolean;
}

export type WepKeys = Record<number, WepKey>;

export interface WifiTrait extends BaseTrait {
  band(): WifiBand;
  passkeyToShow(): string;
  encryption(enterpriseOptionsAvailable: boolean): WifiEncryption;
  defaultWepKey(): number;
  wepKeys(): WepKeys;

  getMasterEntity(): WifiMasterEntity;

  ssid: StringField;
  psk: WrappedStringField;
  wps: BooleanField;
}

export class WifiTrait extends BaseTrait implements WifiTrait {
  private readonly WEP_KEYS_PATH = 'encryption.key';

  public ssid: StringField;
  public psk: WrappedStringField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.ssid = new StringField(this, 'ssid');
    this.psk = new WrappedStringField(this, 'authentication.wpa-psk', 'psk');
    this.wps = new BooleanField(this, 'wps');
  }

  public band(): WifiBand {
    const id = String(_.get(this.dto, 'show.id', ''));

    return id.startsWith(this.NDM.MASTER)
      ? WIFI_BAND.BAND_2_GHZ
      : WIFI_BAND.BAND_5_GHZ;
  }

  // TODO: add Field representing the 'encryption' property
  public encryption(enterpriseOptionsAvailable: boolean = false): WifiEncryption {
    return WifiEncryptionHelper.getEncryptionFromConfiguration(this.dto.sc, enterpriseOptionsAvailable);
  }

  public getEncryptionQueries(encryption: WifiEncryption, passkey: string): RciQuery[] {
    const encryptionConfiguration = WifiEncryptionHelper.getEncryptionConfiguration({
      encryptionProtocol: encryption,
      passkey,
      defaultKeyIdx: 1,
      supportsWpa3: this.NDM.hasFeature(KNOWN_FEATURE.WPA3),
    });

    return makeConfigurationQueries(this.name, encryptionConfiguration);
  }

  public defaultWepKey(): number {
    const wepKeys = this.wepKeys();
    const defaultWepKey: WepKey | undefined = _.find(wepKeys, 'default');

    return _.get(defaultWepKey, 'id', 1);
  }

  public wepKeys(): WepKeys {
    const keys = _.get(this.dto.sc, this.WEP_KEYS_PATH, []);

    return _.keyBy(keys, 'id');
  }

  public passkeyToShow(): string {
    switch (this.encryption()) {
      case WIFI_ENCRYPTION.WEP:
        return _.get(this.wepKeys(), [this.defaultWepKey(), 'hex'], '');

      case WIFI_ENCRYPTION.WPA:
      case WIFI_ENCRYPTION.WPA2:
      case WIFI_ENCRYPTION.WPA3:
      case WIFI_ENCRYPTION.WPA_WPA2:
      case WIFI_ENCRYPTION.WPA2_WPA3:
        return this.psk.readConfig();

      case WIFI_ENCRYPTION.NONE:
      case WIFI_ENCRYPTION.OWE:
      default:
        return '';
    }
  }

  public getMasterEntity(): WifiMasterEntity {
    return this.collection.find((item) => this.name.startsWith(item.name + '/')) as WifiMasterEntity;
  }
}
