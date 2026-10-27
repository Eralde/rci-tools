export type GenericObject = Record<string, any>;
export type StringMap = Record<string, string>;

export type Constructable<T = any> = new(...args: any[]) => T;

export type Values<T> = T[keyof T];

export type Without<T, U> = Partial<Record<Exclude<keyof T, keyof U>, undefined>>;

// ExclusiveOr<T, U> -- objects of the resulting type can "look like" T or U, but not both
export type ExclusiveOr<T, U> = (Without<T, U> & U) | (Without<U, T> & T);

// Implementation source: https://github.com/Microsoft/TypeScript/issues/14094#issuecomment-723571692 (requires TS >= 4.1)
// @see https://github.com/krzkaczor/ts-essentials/issues/183
export type RequireExactlyOneOf<T extends any[]> = T extends [infer Only] ? Only
  : T extends [infer A, infer B, ...infer Rest] ? RequireExactlyOneOf<[ExclusiveOr<A, B>, ...Rest]>
  : never;

export type RequireProp<T, K extends keyof T> =
  & {
    [X in Exclude<keyof T, K>]?: T[X];
  }
  & {
    [P in K]-?: T[P];
  };

export type RequireOneOfProps<T, P extends keyof T> = P extends any ? RequireProp<T, P> : never;

// All objects containing at least one of T's properties (i.e., non-empty `Partial<T>` objects)
export type RequireAtLeastOneProp<T> = RequireOneOfProps<T, keyof T>;
