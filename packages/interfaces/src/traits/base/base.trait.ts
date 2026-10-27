import * as _ from 'lodash-es';
import type {ModelContext} from '../../context';
import {BooleanField, StringField} from '../../fields';
import type {NdmTrait} from '../../ndm-trait';
import type {
  DelayedInitActions,
  EntityDto,
  EntityLabelData,
  EntityTypeInfo,
  EntityTypePart,
  InterfaceEntityType,
  Ip46Entity,
  NdmInterfaceType,
} from '../../entity-model.types';
import {ConfLayerProcessor, ENTITY_STATUS, type EntityStatusInfo, StatusProcessor} from '../../entity-status';
import {type InterfacePendingBlock, SECURITY_LEVEL} from '../../rci';

export interface BaseTrait {
  name: string;
  type: NdmInterfaceType;
  rename: string;
  description: StringField;
  up: BooleanField;
  schedule: StringField;

  status: {
    link: boolean;
    up: boolean;
    connected: boolean;
  };

  getGroup(): string;
  getLabelData(): EntityLabelData;
  getIndex(): number;
  getPriority(): number;
  canBeGlobal(): boolean;
  isGlobal(): boolean;
  getEntityByName(name: string): InterfaceEntityType | null;
  getUptime(): number;
  isPublic(): boolean;
  hasNdmTrait(trait: NdmTrait): boolean;
  getIp46Children(): Array<Ip46Entity>;
  getConnectedIp46Child(): Ip46Entity | null;
  getTypeInfo(): EntityTypeInfo;
  getStatus(inheritUnderlyingFailures: boolean): EntityStatusInfo | null;
  onInit(): void;
}

export class BaseTrait implements BaseTrait {
  public statusProcessor!: StatusProcessor; // set by `onInit()`

  protected _collection!: InterfaceEntityType[]; // set via the `collection` setter

  public set collection(collection: InterfaceEntityType[]) {
    this._collection = collection;
  }

  public get collection(): InterfaceEntityType[] {
    return this._collection;
  }

  public name: string;
  public type: NdmInterfaceType;
  public rename: string;
  public description: StringField;
  public up: BooleanField;
  public schedule: StringField;

  public status: {
    link: boolean;
    up: boolean;
    connected: boolean;
  };

  constructor(
    public dto: EntityDto,
    // Useful for at least two things:
    // - component dependencies;
    //   some parts of entity configuration are not available w/o a specific component,
    //   so entity.<field>.getValueChangingQuery(...) should return an empty array of queries
    //
    // - comparing entity name/rename/etc. with predefined constants to generate a special label
    //   e.g. `if (entity.rename === NDM.GUEST && entity.description.readConfig() === NDM.GUEST_DESCRIPTION) { ... }`
    public NDM: ModelContext,
    // Since we're extending every Trait from the BaseTrait
    // it is impossible to preserve any context inside the entity
    // between trait constructor calls. Each trait constructor
    // calls the BaseTrait constructor (this function) and overwrites
    // everything created by it.
    // To modify the entity **after** every trait is initialized we can use
    // the `delayedInitActions` object. Each function passed to it,
    // will be executed once the entity creation is finished.
    // Each function will get a single argument -- the created entity.
    public delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    this.name = _.get(this.dto, 'show.id', '');
    this.type = _.get(this.dto, 'show.type', '') as NdmInterfaceType;
    this.rename = _.get(this.dto, 'sc.rename', '');

    this.description = new StringField(this, 'description');
    this.up = new BooleanField(this, 'up');
    this.schedule = new StringField(this, 'schedule');

    this.status = {
      link: _.get(this.dto, 'show.link') === 'up',
      up: _.get(this.dto, 'show.state') === 'up',
      connected: _.get(this.dto, 'show.connected') !== 'no',
    };

    this.delayedInitActions.push(({statusProcessor}) => {
      statusProcessor.plugProcessor(ConfLayerProcessor);
    });
  }

  /**
   * NDM does not generate human-readable descriptions for network interfaces.
   * But in the web UI we need to show the user a nice label instead of
   * something like 'GigabitEthernet0/Vlan123'.
   *
   * Since we agreed that some predefined interfaces should have language-specific labels
   * (e.g. Bridge0 -> 'Home network'/'Домашняя сеть'), this method does not return a label string,
   * but the data needed to generate the label string with a translation service instance.
   *
   * See `_getInterfaceLabel` inside `interfaces.service.js` in `ndw2` as a reference for this method overloads
   * @see https://github.com/ndmsystems/ndw2/blob/c2a9b2f0ac54b4bc2e87b87f119061aa4d332af6/src/app/services/interfaces.service.js#L611
   *
   * <! ATTENTION !>
   *   If you need to get labels for a list of entities
   *   (e.g. to generate an options list for a dropdown menu),
   *   you should use `InterfaceL10nService.getBaseEntityListLabels`
   *   or `InterfaceL10nService.getDetailedEntityListLabels` to avoid duplicate labels.
   *
   *   DO NOT use values returned by one of the following methods:
   *    - `entity.getLabelData`
   *    - `InterfaceL10nService.getBaseEntityLabel`
   *    - `InterfaceL10nService.getDetailedEntityLabel`
   *
   *   independently if your list of entities can include
   *   parts of a single "connection" (e.g. both `ipoe` and bound tunnel interfaces are in the same list)
   * <! ATTENTION !>
   */
  public getLabelData(): EntityLabelData {
    return {
      label: this.description.readConfig() || this.name,
    };
  }

  public getIndex(): number {
    return Number(_.get(this.dto, 'show.index', -1));
  }

  public getPriority(): number {
    return Number(_.get(this.dto, 'show.priority', -1));
  }

  public getGroup(): string {
    return String(_.get(this.dto, 'show.group', ''));
  }

  public canBeGlobal(): boolean {
    return _.has(this.dto, 'show.global');
  }

  public isGlobal(): boolean {
    return _.has(this.dto, 'sc.ip.global.order');
  }

  public getEntityByName(name: string): InterfaceEntityType | null {
    return this.collection.find((entity) => entity.name === name) || null;
  }

  public getUptime(): number {
    return _.get(this.dto.show, 'uptime', 0) as number;
  }

  public isPublic(): boolean {
    return _.get(this.dto, 'show.security-level', '') === SECURITY_LEVEL.PUBLIC;
  }

  public hasNdmTrait(trait: NdmTrait): boolean {
    const traitList = _.get(this.dto, 'show.traits', []) as NdmTrait[];

    return _.includes(traitList, trait);
  }

  public get usedby(): string[] {
    return _.get(this.dto.show, 'usedby', []) as string[];
  }

  public getIp46Children(): Array<Ip46Entity> {
    return this.collection
      .filter((entity) => entity.name.startsWith(`${this.name}/`))
      .filter((entity) => entity.hasNdmTrait('Ip46')) as Ip46Entity[];
  }

  public getConnectedIp46Child(): Ip46Entity | null {
    const connectedChild = this.getIp46Children().find((ip46Child) => {
      return ip46Child.getStatus().status === ENTITY_STATUS.CONNECTED;
    });

    return connectedChild || null;
  }

  public getIp46TypeParts(): EntityTypePart[] {
    const ip46Children = this.getIp46Children();

    return ip46Children[0]?.getTypeInfo().parts ?? [];
  }

  public getTypeInfo(): EntityTypeInfo {
    const parts: EntityTypePart[] = [_.get(this.constructor, 'NDM_TYPE', this.type)];

    if (!this.hasNdmTrait('Ip6')) {
      return {parts};
    }

    const firstIp46Child = this.getIp46Children()[0];

    if (firstIp46Child) {
      parts.push(...this.getIp46TypeParts());
    }

    return {parts};
  }

  public getStatus(inheritUnderlyingFailures: boolean = false): EntityStatusInfo {
    if (inheritUnderlyingFailures && _.has(this.dto.show, 'pending')) {
      const pending = this.dto.show.pending as InterfacePendingBlock;
      const blockingEntity = this.collection.find((item) => item.name === pending?.interface);

      if (blockingEntity) {
        return blockingEntity.getStatus(false);
      }

      const logMsg = [
        'Unable to get entity from the "pending" block',
        `"${this.name}" status will be returned as-is`,
      ]
        .join(';');

      this.NDM.logger.warning(logMsg);
    }

    const statusInfo = this.statusProcessor?.getStatus();

    if (statusInfo?.status === ENTITY_STATUS.CONNECTED_TO_IPV6) {
      // TODO: ask team2 to change the status data so that we can get this child through `ndm`.
      const ip4Over6 = this.getConnectedIp46Child();

      if (ip4Over6) {
        statusInfo.status = ENTITY_STATUS.CONNECTED;
      }
    }

    return statusInfo;
  }

  public onInit(): void {
    this.statusProcessor = new StatusProcessor(this);

    this.delayedInitActions.execute(this);
  }
}
