/** Color, expressed as a tuple of red, green and blue with values between 0.0 and 1.0. */
export type RGB = readonly [red: number, green: number, blue: number];
/** Color with alpha opacity, expressed as a tuple of red, green, blue and alpha with values between 0.0 and 1.0. */
export type RGBA = readonly [red: number, green: number, blue: number, alpha: number];
/** Helper type for arrays of fixed size */
export type FixedSizeArray<N extends number, T> = N extends 0 ? never[] : { 0: T; length: N; } & ReadonlyArray<T>;
/** Helper type, like typescript's `Partial<T>`, only recursive. */
export type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]>; };
/** Helper type, like typescript's `Partial<T>`, but where at least one property must be defined. */
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
