import {Mixin, hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {ModelContext} from '../../context';
import {
  BaseTrait,
  ComplexIspTrait,
  DeletableTrait,
  DslTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait,
} from '../../traits';
import {DslIspProfileField, IpvcField, OpmodeField, StringField} from '../../fields';
import {
  type DelayedInitActions,
  type EntityDto,
  type EntityLabelData,
  type EntityTypeInfo,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {DslProcessor, UsbProcessor} from '../../entity-status';
import {IpvcEntity, getIpvcTypeInfo} from './ipvc.entity';
import {NDM_NETWORK_ROLE, type NdmNetworkRole} from '../../rci';

/**
 * This entity represents the "main" DSL interface (Dsl0, UsbDsl0).
 * Line settings should be configured via properties of this entity.
 * Current line status info can be read from this entity DTO.
 *
 * This entity also provides every property, specified in the IpvcEntity,
 * because in some cases (VDSL w/o the "inet" VLAN) this interface is the "inet ipvc".
 */

// dprint-ignore
export interface DslEntity extends
  BaseTrait,
  ComplexIspTrait,
  // the parent DSL interface can't be removed,
  // but the `ipvc` interlayer can be called with `no: true`
  DeletableTrait,
  DslTrait,
  IgmpTrait,
  IpDnsTrait,
  IpMtuTrait,
  IpTrait,
  Ipv6Trait,
  MacTrait,
  RolesTrait
{
  operatingMode: OpmodeField;
  carrier: StringField;
  ispProfile: DslIspProfileField;

  isCableDown(): boolean;
  isCableDiagnosticsAvailable(): boolean;
  isCablePlugged(): boolean;

  getIpvcList(entities: InterfaceEntityType[]): Array<IpvcEntity | DslEntity>;
  getIpvcByRole(role: NdmNetworkRole): Array<IpvcEntity | DslEntity>;
  getIpvcByExcludeRole(role: NdmNetworkRole): Array<IpvcEntity | DslEntity>;
}

export const DslEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    ComplexIspTrait,
    DeletableTrait,
    DslTrait,
    IgmpTrait,
  ),
  Mixin(
    IpDnsTrait,
    IpMtuTrait,
    IpTrait,
    Ipv6Trait,
    MacTrait,
  ),
  Mixin(
    RolesTrait,
  ),
);

export class DslEntity extends DslEntityMixin implements DslEntity {
  public static readonly NDM_TYPE = NDM_INTERFACE_TYPE.Dsl;

  public readonly isIpvc: boolean;

  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.isIpvc = _.some(
      this.dto.allIpvc,
      (item) => _.get(item, 'id', '') === this.name,
    );

    this.operatingMode = new OpmodeField(this);
    this.ispProfile = new DslIspProfileField(this);
    this.carrier = new StringField(this, 'vdsl.carrier');

    this.delayedInitActions.push((entity) => {
      const dsl = entity as DslEntity;

      // The field needs the final entity (`entity.collection`), not the "temporary" `this`
      if (dsl.isIpvc) {
        dsl.ipvc = new IpvcField(dsl);
      }

      dsl.roles = dsl.getRoles(); // RolesTrait implementation

      dsl.statusProcessor.plugProcessor(DslProcessor);

      if (dsl.name.startsWith('UsbDsl')) {
        dsl.statusProcessor.plugProcessor(UsbProcessor);
      }
    });
  }

  public static toDslLevel(value: string): string {
    return (value === 'NA' || !value)
      ? '-'
      : value.split(' ')[0] ?? '-';
  }

  public override getLabelData(): EntityLabelData {
    return {
      label: this.description.readConfig(),
      typeLabel: 'DSL', // not translated
      suffixData: {
        dslOpmode: this.getCurrentOpmode(),
      },
    };
  }

  /**
   * RolesTrait overload: we should read role data from the 'ipvc' object (if available)
   */
  public override getRoles(): NdmNetworkRole[] {
    return this.ipvc?.roles?.readConfig() ?? [];
  }

  public override getChangeRoleQuery(_roles: NdmNetworkRole[]): RciQuery[] {
    this.NDM.logger.warning('DslEntity.getChangeRoleQuery: assign role via the "interface ipvc" interlayer!');

    return [];
  }

  public override hasAnyRole(): boolean {
    return Boolean(this.ipvc?.roles?.hasAnyRole());
  }

  public override hasRole(ndmRole: NdmNetworkRole): boolean {
    return Boolean(this.ipvc?.roles?.hasRole(ndmRole));
  }

  public override hasRoleOwner(): boolean {
    return false; // `Dsl0` is either 'inet' ipvc or it is not ipvc
  }

  public override getRoleOwner(): InterfaceEntityType | null {
    return null;
  }

  /**
   * RolesTrait overload END
   */

  public isCableDown(): boolean {
    return _.get(this.dto, 'show.line', 'down') === 'down'
      || _.get(this.dto, 'show.no-carrier', 0) > 0;
  }

  public isCablePlugged(): boolean {
    return !this.isCableDown();
  }

  public isCableDiagnosticsAvailable(): boolean {
    return false; // `Dsl0` represents the DSL **port** along with the DSL modem, but has no cable diagnostics feature
  }

  public getIpvcList(): Array<IpvcEntity | DslEntity> {
    return this._collection.filter((_entity) => {
      if (this.name === _entity.name) {
        return this.isIpvc;
      }

      return hasMixin(_entity, IpvcEntity);
    }) as Array<IpvcEntity | DslEntity>;
  }

  public getIpvcByRole(role: NdmNetworkRole): Array<IpvcEntity | DslEntity> {
    return this.getIpvcList().filter((ipvc) => ipvc.hasRole(role));
  }

  public getIpvcByExcludeRole(role: NdmNetworkRole): Array<IpvcEntity | DslEntity> {
    return this.getIpvcList().filter((ipvc) => !ipvc.hasRole(role));
  }

  public override makeDeletionQueries(): RciQuery[] {
    if (!this.isIpvc) {
      this.NDM.logger.warning(`DslEntity.makeDeletionQueries: "${this.name}" is not an "ipvc", it can not be removed`);

      return [];
    }

    return makeConfigurationQueries(this.name, 'ipvc.no', true);
  }

  public getCurrentOpmode(): string {
    return String(_.get(this.dto, 'show.opmode'));
  }

  // Overloads ComplexIspTrait.isIsp
  public override isIsp(): boolean {
    return this.isIpvc && this.hasRole(NDM_NETWORK_ROLE.INET);
  }

  public override getTypeInfo(): EntityTypeInfo {
    return this.isIsp()
      ? getIpvcTypeInfo(this)
      : {parts: [this.type]};
  }
}

export const isDslEntity = (entity: InterfaceEntityType | BaseTrait): entity is DslEntity => {
  return entity.type === NDM_INTERFACE_TYPE.Dsl || entity.type === NDM_INTERFACE_TYPE.UsbDsl;
};
