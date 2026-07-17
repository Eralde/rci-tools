export type GenericObject = Record<string, unknown>;

export type ObjectOrArray =
  | GenericObject
  | GenericObject[];

export type Values<T> = T[keyof T];
