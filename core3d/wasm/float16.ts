/** The webassembly instance for float16/32 conversion functions
 * @remarks
 * Ecmascript currently has no typed array for float16.
 * We work around this by using a Uint16Array and then do the bitwise conversion to and from float32 that javascript can understand.
 * @see
 * {@link https://en.wikipedia.org/wiki/Half-precision_floating-point_format#IEEE_754_half-precision_binary_floating-point_format:_binary16 | float16 }
 * {@link https://en.wikipedia.org/wiki/Single-precision_floating-point_format#IEEE_754_standard:_binary32 | float32 }
 */
export interface Float16Instance {
    /**
     * Convert a float16 to float32
     * @param f16 A float16, expressed as a 16 bit unsigned integer.
     * @returns The converted value as a regular floating point number.
     * @remarks
     * This function does not handle NANs or INFs.
     */
    float32(f16: number): number;
    /**
     * Convert a float32 to float16
     * @param f32 A float16, expressed as a regular floating point number.
     * @returns The converted value as a float16, expressed as a 16 bit unsigned integer
     * @remarks
     * This function does not handle NANs or INFs.
     */
    float16(f32: number): number;
}
