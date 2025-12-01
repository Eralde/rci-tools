export type EmptyObject = {[key: string]: never};
export type Values<T> = T[keyof T];
