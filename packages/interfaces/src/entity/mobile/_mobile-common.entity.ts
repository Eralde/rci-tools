import {Mixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import {
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  MobileTrait,
  RolesTrait,
} from '../../traits';
import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {MobileProcessor, UsbProcessor} from '../../entity-status';

// dprint-ignore
export interface MobileCommonEntity extends
  BaseTrait,
  CreateDeleteTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  MobileTrait,
  RolesTrait
{
  getWebAddress(): string;
}

const MobileCommonEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    CreateDeleteTrait,
    IgmpTrait,
    IpDnsTrait,
    IpMtuTrait,
  ),
  Mixin(
    IpTrait,
    MobileTrait,
    RolesTrait,
  ),
);

export abstract class MobileCommonEntity extends MobileCommonEntityMixin implements MobileCommonEntity {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(MobileProcessor);
      statusProcessor.plugProcessor(UsbProcessor);
    });
  }

  public getWebAddress(): string {
    const webAddress = this.dto.show?.['web-address'];

    return _.isString(webAddress) ? webAddress : '';
  }
}
