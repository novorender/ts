export type RGB = readonly [red: number, green: number, blue: number];
export type RGBA = readonly [red: number, green: number, blue: number, alpha: number];
export type FixedSizeArray<N extends number, T> = N extends 0 ? never[] : { 0: T; length: N; } & ReadonlyArray<T>;
export type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]>; };
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
