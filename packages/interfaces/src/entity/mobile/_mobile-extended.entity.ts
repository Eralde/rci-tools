import {Mixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import {
  AuthTrait,
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MobileRoamingTrait,
  MobileTrait,
  RolesTrait,
  SimTrait,
} from '../../traits';
import type {DelayedInitActions, EntityDto, EntityLabelData} from '../../entity-model.types';
import {EnumField, WrappedStringField} from '../../fields';
import type {ModelContext} from '../../context';
import {MobileProcessor, UsbProcessor} from '../../entity-status';
import {MOBILE_PDP, type MobilePdp} from '../../rci';

// dprint-ignore
export interface MobileExtendedEntity extends
  AuthTrait,
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MobileRoamingTrait,
  MobileTrait,
  RolesTrait,
  SimTrait
{
  getLabelData(): EntityLabelData;
  getCurrentPhone(): string;

  plmn: WrappedStringField;
  mobilePdp: EnumField<MobilePdp>; // depends on the 'ip6' component
}

const MobileExtendedEntityMixin = Mixin(
  Mixin(
    AuthTrait,
    BaseTrait,
    CreateDeleteTrait,
    IgmpTrait,
    IpDnsTrait,
  ),
  Mixin(
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
    MobileRoamingTrait,
    MobileTrait,
  ),
  Mixin(
    RolesTrait,
    SimTrait,
  ),
);

export abstract class MobileExtendedEntity extends MobileExtendedEntityMixin implements MobileExtendedEntity {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.plmn = new WrappedStringField(this, 'mobile.operator', 'plmn');
    this.mobilePdp = new EnumField<MobilePdp>(
      this,
      MOBILE_PDP.IPV4,
      'mobile.pdp',
    );

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(MobileProcessor);
      statusProcessor.plugProcessor(UsbProcessor);
    });
  }

  public isInternalModem(): boolean {
    return Boolean(this?.dto?.show?.['embedded']);
  }

  public override isPlugged(): boolean {
    if (this.isInternalModem()) {
      return true;
    }

    return super.isPlugged();
  }

  public getCurrentPhone(): string {
    return String(_.get(this, 'dto.show.phone', ''));
  }

  public override getLabelData(): EntityLabelData {
    // Internal modem
    if (
      this.isInternalModem()
      && this.description.readConfig() === this.NDM.INTERNAL_LTE_DESCRIPTION
    ) {
      return {labelL10n: 'interface-translation.LTE-ISP'};
    }

    return super.getLabelData();
  }
}
