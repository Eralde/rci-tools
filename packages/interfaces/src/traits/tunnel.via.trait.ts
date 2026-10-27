import {hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {ModelContext} from '../context';
import type {
  DelayedInitActions,
  EntityDto,
  EntityLabelData,
  EntityTypeInfo,
  EntityTypePart,
  InterfaceEntityType,
} from '../entity-model.types';
import {ViaField} from '../fields';
import {BaseTrait} from './base/base.trait';
import {RolesTrait} from './base/roles.trait';
import {NDM_NETWORK_ROLE} from '../rci';

export interface TunnelViaTrait extends BaseTrait {
  via: ViaField;
}

export class TunnelViaTrait extends BaseTrait implements TunnelViaTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.via = new ViaField(this);
  }

  // An 'ISP tunnel' entity should use its ISP entity label
  //
  // [!] Overriding 'getLabelData' in this trait raises an error:
  // > Named property 'getLabelData' of types X & Y & Z & ... and A are not identical.
  //
  // So we use a different name as a workaround.
  public inheritIspLabelData(): EntityLabelData {
    if (!this.isComplexIspPart()) {
      return super.getLabelData();
    }

    const viaEntity = this.getViaEntity();

    if (!viaEntity) {
      return super.getLabelData();
    }

    // Suffix data will be not empty for complex DSL/IPoE interfaces;
    // it is not needed to generate the tunnel label
    return _.omit(viaEntity.getLabelData(), ['suffixData']);
  }

  public getViaEntity(): InterfaceEntityType | null {
    const via = this.via.readConfig();

    if (!via) {
      return null;
    }

    return this._collection.find((entity) => entity.name === via)
      || null;
  }

  protected getExtendedTypeInfo(): EntityTypeInfo {
    const parts: EntityTypePart[] = [];

    if (this.isComplexIspPart()) {
      // ipoe/ipvc,
      const viaEntity = this.getViaEntity();

      parts.push(...viaEntity?.getTypeInfo().parts ?? []);
    }

    parts.push(...super.getTypeInfo().parts);

    return {parts};
  }

  protected isComplexIspPart(): boolean {
    return hasMixin(this, RolesTrait)
      && this.hasRole(NDM_NETWORK_ROLE.INET);
  }
}
