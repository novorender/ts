in float instance;
uniform float seed;

const float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio   

float gold_noise(in vec2 xy, in float seed) {
    return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
}

out vec4 fragColor;
void main() {
    // float v = gold_noise(gl_FragCoord.xy, instance / 1024. + seed);
    fragColor = vec4(seed, seed, seed, 1);
    // fragColor = vec4(v, v, v, .5);
    // fragColor = vec4(1);
}