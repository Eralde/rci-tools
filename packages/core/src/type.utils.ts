export type GenericObject = Record<string, unknown>;

export type ObjectOrArray =
  | GenericObject
  | GenericObject[];

// Result delivered to a queued task: single-query tasks get one response,
// multi-query tasks get one response per query; `undefined` means the
// device response did not contain the query's path.
export type TaskResult =
  | GenericObject
  | undefined
  | Array<GenericObject | undefined>;

export type Values<T> = T[keyof T];
