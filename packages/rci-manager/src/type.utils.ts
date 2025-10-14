export type GenericObject = Record<string, unknown>;
export type ObjectOrArray =
  | GenericObject
  | GenericObject[]
  | GenericObject[][]; // to treat `[[]]` as a valid `ObjectOrArray` value (which it is)

export type Values<T> = T[keyof T];
