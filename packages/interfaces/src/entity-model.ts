import * as _ from 'lodash-es';
import {type ModelContext, type ModelLogger, type RuntimeInput, createModelContext} from './context';
import {corePlugin} from './core-plugin';
import type {EntityResolver, ModelPlugin} from './plugin.types';
import {
  type CreatableEntityType,
  DelayedInitActions,
  type EntityDto,
  type InterfaceEntityType,
  NDM_INTERFACE_TYPE,
  type NdmRciIpoeListItem,
  type NdmRciIpvcListItem,
} from './entity-model.types';
import type {BaseTrait} from './traits';
import type {NdmTrait} from './ndm-trait';
import {getNextName} from './helpers';
import type {Constructable, GenericObject} from './rci';

const NO_OP_LOGGER: ModelLogger = {
  info: () => undefined,
  warning: () => undefined,
  error: () => undefined,
};

export interface EntityModelOptions {
  plugins?: ModelPlugin[];
  runtime: () => RuntimeInput;
  logger?: ModelLogger; // no-op by default
}

// Device responses (the keys correspond to the requested RCI commands)
export interface DeviceResponses {
  sc: GenericObject; // `show sc interface`
  show: GenericObject; // `show interface`
  ipoe?: GenericObject; // `show sc interface ipoe`
  ipvc?: GenericObject; // `show sc interface ipvc`
}

export interface CreateEntityOptions {
  parent?: InterfaceEntityType | null;
  index?: number | null;
}

export interface EntityModel {
  readonly context: ModelContext;

  toDtoList(responses: DeviceResponses): EntityDto[];

  /** The entity is not attached to any collection (see `entity.collection`) */
  fromDto(dto: EntityDto): InterfaceEntityType;

  /** Entities share a single collection; `trait` limits the collection to the matching entities */
  fromResponses(responses: DeviceResponses, options?: {trait?: NdmTrait}): InterfaceEntityType[];

  createEntity<T extends CreatableEntityType>(
    collection: InterfaceEntityType[],
    entityClass: Constructable<T>,
    options?: CreateEntityOptions,
  ): T;
}

const sortResolvers = (resolvers: EntityResolver[]): EntityResolver[] => {
  // `sortBy` is stable: the resolvers with equal priority keep their registration order
  return _.sortBy(resolvers, (resolver) => -resolver.priority);
};

const collectResolvers = (plugins: ModelPlugin[]): EntityResolver[] => {
  const resolvers: EntityResolver[] = [];

  [corePlugin, ...plugins].forEach((plugin) => {
    (plugin.entities ?? []).forEach((resolver) => {
      const index = resolvers.findIndex((item) => item.id === resolver.id);

      // The same `id` replaces the previous resolver
      if (index >= 0) {
        resolvers.splice(index, 1);
      }

      resolvers.push(resolver);
    });
  });

  return sortResolvers(resolvers);
};

// eslint-disable-next-line max-lines-per-function
export const createEntityModel = (options: EntityModelOptions): EntityModel => {
  const context = createModelContext(options.runtime, options.logger ?? NO_OP_LOGGER);
  const resolvers = collectResolvers(options.plugins ?? []);

  const toDtoList = (responses: DeviceResponses): EntityDto[] => {
    const ipoeList = _.map(
      responses.ipoe ?? {},
      (ipoe, id): NdmRciIpoeListItem => ({...ipoe, id}) as NdmRciIpoeListItem,
    );
    const ipvcList = _.map(
      responses.ipvc ?? {},
      (ipvc, id): NdmRciIpvcListItem => ({...ipvc, id}) as NdmRciIpvcListItem,
    );

    return _.values(responses.show).map((showData: GenericObject): EntityDto => {
      // It is possible that data from the `show interface` command,
      // which is not present in the data from the `show sc interface` command
      // @see https://ndm.atlassian.net/browse/NDM-3738
      const sc = _.get(responses.sc, showData['id'], {}); // interface configuration (cached)

      return {
        sc,
        show: showData,
        allIpoe: ipoeList,
        allIpvc: ipvcList,
      };
    });
  };

  const fromDto = (dto: EntityDto): InterfaceEntityType => {
    const resolver = resolvers.find((item) => item.match(dto, context));

    if (!resolver) {
      throw new Error(`model: no resolver found for "${_.get(dto, 'show.id')}"`);
    }

    return new resolver.ctor(dto, context, new DelayedInitActions<BaseTrait>());
  };

  const initCollection = (collection: InterfaceEntityType[]): InterfaceEntityType[] => {
    // We add a reference to the entire collection to each entity.
    // This makes finding related entities much more convenient.
    collection.forEach((entity) => {
      entity.collection = collection;

      entity.onInit();
    });

    return collection;
  };

  const fromResponses: EntityModel['fromResponses'] = (responses, {trait} = {}) => {
    const entities = toDtoList(responses).map(fromDto);

    return initCollection(trait ? entities.filter((entity) => entity.hasNdmTrait(trait)) : entities);
  };

  const createEntity: EntityModel['createEntity'] = (collection, entityClass, {parent = null, index = null} = {}) => {
    const type: string = _.get(entityClass, 'NDM_TYPE', '');

    const firstEntity = collection[0];
    const allIpoe = _.get(firstEntity, 'dto.allIpoe', []);
    const allIpvc = _.get(firstEntity, 'dto.allIpvc', []);

    const usedNames: string[] = collection
      .filter((entity) => String(entity.type) === type)
      .filter((entity) => !parent || entity.name.startsWith(parent.name))
      .map((entity) => entity.name);

    // VLAN interface index must be positive
    const startIndex = type === NDM_INTERFACE_TYPE.Vlan ? 1 : 0;
    const prefix = parent ? `${parent.name}/` : '';
    // Changing `name` once an entity is created won't work as expected:
    // `this.entity.name` inside field properties will reference the initial name value (an empty string).
    //
    // So we need to pass proper 'free' id to the entity constructor
    const id = index !== null
      ? `${prefix}${type}${index}`
      : getNextName(type, usedNames, {prefix, startIndex});

    if (usedNames.includes(id)) {
      throw new Error(`Can't create ${type} entity with used index = ${index}`);
    }

    // Minimal proper DTO object
    const dto = {sc: {}, show: {type, id}, allIpoe, allIpvc};

    const instance = new entityClass(dto, context, new DelayedInitActions<BaseTrait>());

    collection.push(instance);

    instance.collection = collection;

    instance.onInit();

    return instance;
  };

  return {context, toDtoList, fromDto, fromResponses, createEntity};
};
