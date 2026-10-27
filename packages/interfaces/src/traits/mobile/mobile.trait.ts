import {hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {ModelContext} from '../../context';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {ApnField, EnumField} from '../../fields';
import type {AuthModel} from '../../fields/auth.field';
import {BaseTrait} from '../base/base.trait';
import {AuthTrait} from '../auth.trait';
import {CELLULAR_STANDARD, type CellularStandard} from '../../rci';

export enum MOBILE_ACQ {
  AUTO = 'auto', // "virtual" value (no `mobile acq ...` command in the configuration)
  GSM = 'gsm', // 2G
  UMTS = 'umts', // 3G
  LTE = 'lte', // 4G
  NR5G = 'nr5g', // 5G
}

export interface MobileConnectionInfo {
  modemName: string;
  imei: string;
  currentStandard: CellularStandard;
  operatorName: string;
  apn: string;
  authData: AuthModel | null;
}

export interface MobileTrait extends BaseTrait {
  isIsp(): boolean;
  isPlugged(): boolean;

  getCurrentImei(): string;
  getCurrentModemName(): string;
  getCurrentStandard(): CellularStandard;
  getCurrentApn(): string;
  getCurrentOperatorName(): string;
  getCurrentSignalLevel(): number;

  rebootUsbDevice(pause: number): RciQuery[];

  apn: ApnField;
  acq: EnumField<MOBILE_ACQ>;
}

export class MobileTrait extends BaseTrait implements MobileTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.apn = new ApnField(this);
    this.acq = new EnumField<MOBILE_ACQ>(this, MOBILE_ACQ.AUTO, 'mobile.acq');
  }

  public isIsp(): boolean {
    return _.has(this, 'dto.sc.ip.global.order');
  }

  public isPlugged(): boolean {
    return _.get(this, 'dto.show.plugged', 'yes') === 'yes';
  }

  public getCurrentImei(): string {
    return String(_.get(this, 'dto.show.imei', ''));
  }

  public getCurrentModemName(): string {
    return String(_.get(this, 'dto.show.product', ''));
  }

  public getCurrentStandard(): CellularStandard {
    return _.get(this, 'dto.show.mobile', CELLULAR_STANDARD.STANDARD_UNKNOWN);
  }

  public getCurrentApn(): string {
    return String(_.get(this, 'dto.show.apn', ''));
  }

  public getCurrentOperatorName(): string {
    return String(_.get(this, 'dto.show.operator', ''));
  }

  public getCurrentSignalLevel(): number {
    return Number(_.get(this, 'dto.show.signal-level', -1)); // -1 === no 'signal-level'
  }

  public getConnectionInfo(): MobileConnectionInfo {
    const modemName = this.getCurrentModemName();
    const imei = this.getCurrentImei();
    const currentStandard = this.getCurrentStandard();
    const operatorName = this.getCurrentOperatorName();
    const apn = this.apn.readConfig()?.apn || this.getCurrentApn();

    const authData: AuthModel | null = hasMixin(this, AuthTrait)
      ? (this as AuthTrait).auth.readConfig()
      : null;

    return {
      modemName,
      imei,
      currentStandard,
      operatorName,
      apn,
      authData,
    };
  }

  public rebootUsbDevice(pause: number): RciQuery[] {
    return makeConfigurationQueries(
      this.name,
      'usb.power-cycle',
      {pause},
    );
  }
}
