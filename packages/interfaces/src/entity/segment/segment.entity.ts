import {Mixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {ModelContext} from '../../context';
import * as Traits from '../../traits';
import {
  type DelayedInitActions,
  type EntityDto,
  type EntityLabelData,
  type InterfaceEntityType,
  NDM_INTERLAYER_NAME,
} from '../../entity-model.types';
import {IsegField, type IsegModel} from '../../fields/iseg';
import {type AccessPointEntity, isAccessPointEntity} from '../wifi/access-point.entity';
import {makeConfigurationQueries, makeInterlayerCreationQueries} from '../../helpers/query.helper';
import {type InterfaceIpvcConfiguration, NO_COMMAND} from '../../rci';

// dprint-ignore
export interface SegmentEntity extends
  Traits.BaseTrait,
  Traits.DeletableTrait,
  Traits.IgmpTrait,
  Traits.IncludeTrait,
  Traits.IpDnsTrait,
  Traits.IpMtuTrait,
  Traits.IpTrait,
  Traits.Ipv6Trait,
  Traits.MacTrait,
  Traits.RolesTrait
{
  getAccessPoints(): AccessPointEntity[];
  isHomeSegment(): boolean;

  iseg: IsegField;
}

const SegmentEntityMixin = Mixin(
  Mixin(
    Traits.BaseTrait,
    Traits.DeletableTrait,
    Traits.IgmpTrait,
    Traits.IncludeTrait,
    Traits.IpDnsTrait,
  ),
  Mixin(
    Traits.IpMtuTrait,
    Traits.IpTrait,
    Traits.Ipv6Trait,
    Traits.MacTrait,
    Traits.RolesTrait,
  ),
);

export class SegmentEntity extends SegmentEntityMixin implements SegmentEntity {
  public static readonly NDM_INTERLAYER = NDM_INTERLAYER_NAME.ISEG;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<Traits.BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    // The field needs the final entity (`entity.collection`), not the "temporary" `this`
    this.delayedInitActions.push((entity) => {
      (entity as SegmentEntity).iseg = new IsegField(entity as SegmentEntity);
    });
  }

  public static makeInsertionQueries(isegModel: IsegModel): RciQuery[] {
    const isegData = IsegField.getNdmIsegConfiguration(isegModel);

    return makeInterlayerCreationQueries<Partial<InterfaceIpvcConfiguration>>(
      SegmentEntity.NDM_INTERLAYER,
      isegData,
    );
  }

  public isHomeSegment(): boolean {
    return this.name === this.NDM.HOME_SEGMENT_ID || this.rename === this.NDM.HOME_SEGMENT_ID;
  }

  public getAccessPoints(): AccessPointEntity[] {
    return this.getIncludedEntities().filter(isAccessPointEntity);
  }

  public override makeDeletionQueries(): RciQuery[] {
    return makeConfigurationQueries(this.name, SegmentEntity.NDM_INTERLAYER, NO_COMMAND);
  }

  public override getLabelData(): EntityLabelData {
    const description = this.description.readConfig();

    // Home segment with default description
    if (this.name === this.NDM.HOME_SEGMENT_ID && description === this.NDM.LAN_DESCRIPTION) {
      return {labelL10n: 'interface-translation.Home'};
    }

    // Guest segment with default description
    if (this.rename === this.NDM.GUEST && description === this.NDM.GUEST_DESCRIPTION) {
      return {labelL10n: 'interface-translation.Guest'};
    }

    return super.getLabelData();
  }
}

export const isSegmentEntity = (entity: InterfaceEntityType | Traits.BaseTrait): entity is SegmentEntity => {
  return _.has(entity, 'dto.sc.iseg');
};
