import {GenericObject} from '../../type.utils';

// `PathType` can be narrowed to a subset of valid path strings
export interface RciQuery<PathType extends string = string> {
  path: PathType;
  data?: GenericObject; // defaults to {}
  extractDataByPath?: boolean; // defaults to true
}

export type RciTask<PathType extends string = string> = RciQuery<PathType> | RciQuery<PathType>[];
