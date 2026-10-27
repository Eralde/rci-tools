import * as _ from 'lodash-es';
import {NO_COMMAND} from './no-command';
import {WIFI_BAND, WIFI_ENCRYPTION, type WifiBand, type WifiEncryption} from './constants';
import {StringHelper} from './string.helper';
import type {
  ModelTranslator,
  WepKeyConfiguration,
  WifiAuthenticationWriteType,
  WifiEncryptionWriteConfigurationType,
  WifiInterfaceReadConfiguration,
} from './types';

export const WPA_EAP_ENCRYPTION: WifiEncryption[] = [
  WIFI_ENCRYPTION.WPA2_EAP,
  WIFI_ENCRYPTION.WPA_WPA2_EAP,
  WIFI_ENCRYPTION.WPA2_WPA3_EAP_TRANSITION,
  WIFI_ENCRYPTION.WPA3_EAP,
  WIFI_ENCRYPTION.WPA3_EAP_SUITE_B,
];

export const ENCRYPTION_WITH_PSK: WifiEncryption[] = [
  WIFI_ENCRYPTION.WPA,
  WIFI_ENCRYPTION.WPA_WPA2,
  WIFI_ENCRYPTION.WPA2,
  WIFI_ENCRYPTION.WPA2_WPA3,
  WIFI_ENCRYPTION.WPA3,
];

export type PasskeyConfiguration =
  | string
  | WepKeyConfiguration[]
  | Record<string, WepKeyConfiguration>;

export interface GetEncryptionConfigurationArguments {
  encryptionProtocol: WifiEncryption;
  passkey: PasskeyConfiguration;
  defaultKeyIdx: number;
  supportsWpa3: boolean;
}

const UNIT_GHZ_L10N_KEY = 'unit.ghz';

export class WifiEncryptionHelper {
  public static getBandL10n(band: WifiBand, language: string, translate: ModelTranslator): string {
    const unit = translate.instant(UNIT_GHZ_L10N_KEY);
    const decimalSeparator = StringHelper.getDecimalSeparator(language);

    return band === WIFI_BAND.BAND_2_GHZ
      ? `2${decimalSeparator}4 ${unit}`
      : `5 ${unit}`;
  }

  public static getEncryptionFromConfiguration(
    wifiInterfaceConfiguration: WifiInterfaceReadConfiguration,
    enterpriseOptionsAvailable: boolean,
  ): WifiEncryption {
    const enc = _.get(wifiInterfaceConfiguration, 'encryption');

    if (!enc?.enable) {
      return WIFI_ENCRYPTION.NONE;
    }

    const hasNoPsk = !_.has(wifiInterfaceConfiguration, 'authentication.wpa-psk.psk');

    const wpaConfigured = Boolean(enc.wpa);
    const wpa2Configured = Boolean(enc.wpa2);
    const wpa3Configured = Boolean(enc.wpa3);
    const oweConfigured = Boolean(enc.owe);

    let encryptionOption: WifiEncryption = WIFI_ENCRYPTION.NONE;

    // The logic below is adopted from the ndm source code & SHOULD NOT be changed
    if (wpaConfigured && wpa2Configured) {
      encryptionOption = hasNoPsk && enterpriseOptionsAvailable
        ? WIFI_ENCRYPTION.WPA_WPA2_EAP
        : WIFI_ENCRYPTION.WPA_WPA2;
    } else if (wpa2Configured && wpa3Configured) {
      encryptionOption = hasNoPsk && enterpriseOptionsAvailable
        ? WIFI_ENCRYPTION.WPA2_WPA3_EAP_TRANSITION
        : WIFI_ENCRYPTION.WPA2_WPA3;
    } else if (wpaConfigured) {
      encryptionOption = WIFI_ENCRYPTION.WPA; // No WPA EAP
    } else if (wpa2Configured) {
      encryptionOption = hasNoPsk && enterpriseOptionsAvailable
        ? WIFI_ENCRYPTION.WPA2_EAP
        : WIFI_ENCRYPTION.WPA2;
    } else if (wpa3Configured) {
      if (hasNoPsk && enterpriseOptionsAvailable) {
        encryptionOption = _.isObject(enc.wpa3)
          ? WIFI_ENCRYPTION.WPA3_EAP_SUITE_B
          : WIFI_ENCRYPTION.WPA3_EAP;
      } else {
        encryptionOption = WIFI_ENCRYPTION.WPA3;
      }
    } else if (oweConfigured) {
      encryptionOption = WIFI_ENCRYPTION.OWE;
    } else {
      encryptionOption = _.has(enc, 'enable')
        ? encryptionOption = WIFI_ENCRYPTION.WEP
        : encryptionOption = WIFI_ENCRYPTION.NONE;
    }

    return encryptionOption;
  }

  // eslint-disable-next-line max-lines-per-function
  public static getEncryptionConfiguration(
    args: GetEncryptionConfigurationArguments,
  ): {encryption: WifiEncryptionWriteConfigurationType; authentication: WifiAuthenticationWriteType} {
    const {
      encryptionProtocol,
      passkey,
      defaultKeyIdx = 1,
      supportsWpa3 = false,
    } = args;

    const {
      NONE,
      WEP,
      WPA,
      WPA2,
      WPA_WPA2,
      WPA3,
      WPA2_WPA3,
      OWE,
      WPA2_EAP,
      WPA_WPA2_EAP,
      WPA3_EAP,
      WPA3_EAP_SUITE_B,
      WPA2_WPA3_EAP_TRANSITION,
    } = WIFI_ENCRYPTION;

    const C_OWE = encryptionProtocol === OWE;
    const C_ENABLED = encryptionProtocol !== NONE;

    const C_WPA_PSK = _.includes(ENCRYPTION_WITH_PSK, encryptionProtocol);

    const C_WPA = _.includes(
      [WPA, WPA_WPA2, WPA_WPA2_EAP],
      encryptionProtocol,
    );

    const C_WPA2 = _.includes(
      [WPA_WPA2, WPA2, WPA2_WPA3, WPA2_EAP, WPA_WPA2_EAP, WPA2_WPA3_EAP_TRANSITION],
      encryptionProtocol,
    );

    const C_WPA3 = _.includes(
      [WPA2_WPA3, WPA3, WPA3_EAP, WPA3_EAP_SUITE_B, WPA2_WPA3_EAP_TRANSITION],
      encryptionProtocol,
    );

    const C_CLEAR_WPA_PSK = _.includes(WPA_EAP_ENCRYPTION, encryptionProtocol);

    const encryption: WifiEncryptionWriteConfigurationType = {
      enable: {no: !C_ENABLED},
      wpa: {no: !C_WPA},
      wpa2: {no: !C_WPA2},
      key: _.times(4, (index) => ({hex: '', id: index + 1, no: true})),
    };

    if (supportsWpa3) {
      encryption.owe = {no: !C_OWE};

      if (encryptionProtocol === WPA3_EAP_SUITE_B) {
        encryption.wpa3 = {
          'enable': true,
          'suite-b': true,
        };
      } else {
        encryption.wpa3 = {no: !C_WPA3};
      }
    }

    const authentication: WifiAuthenticationWriteType = {
      'wpa-psk': {
        no: !C_WPA_PSK,
      },
    };

    if (encryptionProtocol === WEP) {
      let wepKeys: WepKeyConfiguration[];

      if (_.isString(passkey)) {
        wepKeys = [{hex: passkey, id: 1, default: true}];
      } else if (_.isArray(passkey)) {
        wepKeys = _.map(
          passkey.slice(),
          (wepKey: WepKeyConfiguration, idx: number) => ({...wepKey, id: idx + 1}),
        );
      } else {
        wepKeys = _.map(
          passkey,
          (item, id) => {
            return {
              hex: item.hex,
              id: Number(id),
              no: !item,
            };
          },
        );
      }

      const defaultKey = wepKeys[defaultKeyIdx - 1];

      if (defaultKey) {
        defaultKey.default = true;
      }

      encryption.key = wepKeys;
    } else if (C_WPA_PSK) {
      authentication['wpa-psk'] = C_CLEAR_WPA_PSK || !_.isString(passkey)
        ? NO_COMMAND
        : {psk: String(passkey)};
    }

    return {encryption, authentication};
  }
}
