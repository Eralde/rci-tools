import type {Constructable} from './rci';
import type {ModelContext} from './context';
import type {EntityDto, InterfaceEntityType} from './entity-model.types';

export interface EntityResolver {
  id: string; // a resolver with the same `id` replaces the previously registered one
  priority: number; // resolvers are checked in the descending priority order
  match(dto: EntityDto, ctx: ModelContext): boolean;
  ctor: Constructable<InterfaceEntityType>;
}

export interface ModelPlugin {
  name: string;
  entities?: EntityResolver[];
}
