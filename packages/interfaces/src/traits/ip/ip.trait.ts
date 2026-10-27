import {hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import {BooleanField, IP_GATEWAY, IP_NAME_SERVERS, IpGlobalField, Ipv4AddressField, StringField} from '../../fields';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {Ipv4LayerProcessor} from '../../entity-status';
import {BaseTrait} from '../base/base.trait';
import {Ipv4Helper} from '../../rci';

export interface IpTrait extends BaseTrait {
  address: Ipv4AddressField;
  global: IpGlobalField;
  gateway: StringField;
  acceptRemoteDnsV4: BooleanField;

  isDefaultGateway(): boolean;
  hasConflictWith(): IpTrait | null;
  getSubnetString(): string;
  getSubnetSize(): number | null;
  getCurrentAddress(): string;
  getCurrentMask(): string;
}

const DEFAULTGW_PATH = 'dto.show.defaultgw';

export class IpTrait extends BaseTrait implements IpTrait {
  public address: Ipv4AddressField;
  public global: IpGlobalField;
  public gateway: StringField;
  public acceptRemoteDnsV4: BooleanField;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.address = new Ipv4AddressField(this);
    this.global = new IpGlobalField(this);
    this.gateway = new StringField(this, IP_GATEWAY);
    this.acceptRemoteDnsV4 = new BooleanField(this, IP_NAME_SERVERS, {defaultValue: true});

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(Ipv4LayerProcessor);
    });
  }

  public isDefaultGateway(): boolean {
    return Boolean(_.get(this, DEFAULTGW_PATH))
      || this.getIp46Children().some((child) => _.get(child, DEFAULTGW_PATH));
  }

  public getSubnetString(): string {
    const addressConfig = this.address.readConfig();

    const address = this.getCurrentAddress() || addressConfig.address;
    const mask = this.getCurrentMask() || addressConfig.mask;

    if (!address || !mask) {
      return '';
    }

    return `${address}/${Ipv4Helper.maskToCidr(mask)}`;
  }

  public getSubnetSize(): number | null {
    const subnetStr = this.getSubnetString();
    const currentSize = Number(subnetStr.split('/')[1]);

    return isNaN(currentSize) ? null : currentSize;
  }

  public getCurrentAddress(): string {
    return String(_.get(this.dto, 'show.address', ''));
  }

  public getCurrentMask(): string {
    return String(_.get(this.dto, 'show.mask', ''));
  }

  public hasConflictWith(): IpTrait | null {
    const conflict = _.get(this.dto, 'show.conflict.interface');
    const ipEntities = this.collection.filter((entity) => hasMixin(entity, IpTrait));

    return ipEntities.find((entity) => entity.name === conflict) || null;
  }
}
