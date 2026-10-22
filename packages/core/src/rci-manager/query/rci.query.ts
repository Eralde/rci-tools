import type {GenericObject} from '../../type.utils';

export type QueryData =
  | string
  | number
  | boolean
  | object
  | object[];

// `PathType` can be narrowed to a subset of valid path strings
export interface RciQuery<PathType extends string = string> {
  path: PathType;
  data?: QueryData; // defaults to {}
  extractData?: boolean; // defaults to true
}

export type RciTask<PathType extends string = string> = RciQuery<PathType> | RciQuery<PathType>[];

export type TypedRciQuery<T, PathType extends string = string> =
  RciQuery<PathType> & {readonly '~response'?: T};

export type RciResponseOf<Q> = Q extends {readonly '~response'?: infer T}
  ? (unknown extends T ? GenericObject : T)
  : GenericObject;

export type RciResultsOf<Q extends readonly unknown[]> =
  {-readonly [K in keyof Q]: RciResponseOf<Q[K]> | undefined};
