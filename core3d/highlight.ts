import type { AtLeastOne, RGB, RGBA, RGBATransform } from "./state";

export function createNeutralHighlight(): RGBATransform {
    return [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0,
    ] as const
}

export function createTransparentHighlight(opacity: number): RGBATransform {
    return [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, opacity, 0,
    ] as const
}

export function createColorSetHighlight(color: RGB | RGBA): RGBATransform {
    const [r, g, b, a] = color;
    return [
        0, 0, 0, 0, r,
        0, 0, 0, 0, g,
        0, 0, 0, 0, b,
        0, 0, 0, 0, a ?? 1,
    ] as const
}

export function createRGBATransformHighlight(options: AtLeastOne<RGBAOptions>): RGBATransform {
    const r = normalizeLinearTransform(options.red);
    const g = normalizeLinearTransform(options.green);
    const b = normalizeLinearTransform(options.blue);
    const a = normalizeLinearTransform(options.opacity);
    return [
        r[0], 0, 0, 0, r[1],
        0, g[0], 0, 0, g[1],
        0, 0, b[0], 0, b[1],
        0, 0, 0, a[0], a[1],
    ] as const
}

export function createHSLATransformHighlight(options: AtLeastOne<HSLAOptions>): RGBATransform {
    const [ls, lo] = normalizeLinearTransform(options.lightness);
    const [as, ao] = normalizeLinearTransform(options.opacity);

    function mix(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    const ss = options.saturation ?? 1;
    const s0 = mix(1 / 3, 1, ss) * ls;
    const s1 = mix(1 / 3, 0, ss) * ls;
    // TODO: Weigh RGB differently based on perceived brightness ~(0.3, 0.6, 0.1)?
    // TODO: Add hue offset?

    return [
        s0, s1, s1, 0, lo,
        s1, s0, s1, 0, lo,
        s1, s1, s0, 0, lo,
        0, 0, 0, as, ao,
    ] as const;
}

function isLinearTransform(transform: LinearTransform | number | undefined): transform is LinearTransform {
    return typeof (transform) == "object";
}

function normalizeLinearTransform(transform: LinearTransform | number | undefined) {
    let scale = 1;
    let offset = 0;
    if (isLinearTransform(transform)) {
        if (transform.scale != undefined) {
            scale = transform.scale;
        }
        if (transform.offset != undefined) {
            offset = transform.offset;
        }
    } else if (typeof transform == "number") {
        scale = 0;
        offset = transform;
    }
    return [scale, offset];
}

/** Options for RGBA + alpha color transformation.
 * @remarks
 * All input values are between 0 and 1.
 */
export interface RGBAOptions {
    /** Red color adjustment. */
    readonly red: number | LinearTransform;
    /** Green color adjustment. */
    readonly green: number | LinearTransform;
    /** Blue color adjustment. */
    readonly blue: number | LinearTransform;
    /** Opacity/alpha adjustment. */
    readonly opacity: number | LinearTransform;
}

/** Options for HSL + alpha color transformation.
 * @remarks
 * All input values are between 0 and 1.
 * See [Wikipedia](https://en.wikipedia.org/wiki/HSL_and_HSV) for more details on the HSV color space.
 */
export interface HSLAOptions {
    /** Lightness adjustment. */
    readonly lightness: number | LinearTransform;
    /** Saturation adjustment (scale). */
    readonly saturation: number;
    // /** Hue adjustment (offset). */
    // readonly hue: number;
    /** Opacity/alpha adjustment. */
    readonly opacity: number | LinearTransform;
}


/** Linear transform options.
 * @remarks
 * The transform is performed by first applying scale, then adding offset, i.e.: result = value * scale + offset.
 * If scale = 0, offset will effectively replace input value.
 */
export interface LinearTransform {
    /** Multiplicand for input value. Default = 1.*/
    readonly scale?: number;
    /** Addend for scaled input value. Default = 0. */
    readonly offset?: number;
}
