import { RenderStateColorGradient, RGB, RGBA } from "core3d";
import { vec4 } from "gl-matrix";

export function gradientRange(gradient: RenderStateColorGradient<RGB | RGBA>) {
    if (gradient.knots.length == 0)
        return [0, 0] as const;
    return [gradient.knots[0].position, gradient.knots[gradient.knots.length - 1].position] as const;
}

export function computeGradientColors(size: number, gradient: RenderStateColorGradient<RGB | RGBA>): Uint8ClampedArray {
    const { knots } = gradient;
    const n = knots.length;
    const pixels = new Uint8ClampedArray(size * 4);
    if (n > 0) {
        const minValue = knots[0].position;
        const maxValue = knots[n - 1].position;
        let prevIndex = 0;
        function getColor(index: number) {
            const [r, g, b, a] = knots[index].color;
            return vec4.fromValues(r, g, b, a ?? 1);
        }
        const color = getColor(0);
        for (let i = 0; i < size; i++) {
            const texel = (i + 0.5) / size * (maxValue - minValue) + minValue;
            for (let j = prevIndex; j < n - 1; j++) {
                prevIndex = j;
                const e0 = knots[j].position;
                const e1 = knots[j + 1].position;
                const c0 = getColor(j);
                const c1 = getColor(j + 1);
                if (texel >= e0 && texel < e1) {
                    const t = (texel - e0) / (e1 - e0);
                    vec4.lerp(color, c0, c1, t);
                    break;
                }
            }
            const [r, g, b, a] = color;
            pixels[i * 4 + 0] = r * 255;
            pixels[i * 4 + 1] = g * 255;
            pixels[i * 4 + 2] = b * 255;
            pixels[i * 4 + 3] = a * 255;
        }
    }
    return pixels;
}
