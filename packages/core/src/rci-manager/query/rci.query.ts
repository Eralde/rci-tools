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
