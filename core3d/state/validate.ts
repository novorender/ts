import { vec3, type ReadonlyVec3, type ReadonlyVec4 } from "gl-matrix";
import type { RGB, RenderState, RenderStateBackground, RenderStateCamera, RenderStateChanges, RenderStateClipping, RenderStateColorGradient, RenderStateDynamicObjects, RenderStateGrid, RenderStateHighlightGroups, RenderStateOutlines, RenderStateOutput, RenderStatePick, RenderStatePointCloud, RenderStateQuality, RenderStateScene, RenderStateTerrain, RenderStateTonemapping, RenderStateToonOutline } from ".";
import type { RGBA } from "webgl2";

/**
 * Validate render state changes.
 * @param newState The new render state to validate.
 * @param changes The changes that was applied to the baseline state to produce this state.
 * @returns Array of validation errors, if any.
 * @remarks
 * This function performs some basic validation of the state changes, focusing on value ranges and states that would generate run-time exceptions.
 * @category Render State
 */
export function validateRenderState(newState: RenderState, changes: RenderStateChanges): readonly Error[] {
    const validate = new ValidationContext();
    if (changes.background) {
        validate.background(newState.background);
    }
    if (changes.camera) {
        validate.camera(newState.camera);
    }
    if (changes.clipping) {
        validate.clipping(newState.clipping);
    }
    if (changes.dynamic) {
        validate.dynamic(newState.dynamic);
    }
    if (changes.grid) {
        validate.grid(newState.grid);
    }
    if (changes.highlights) {
        validate.highlights(newState.highlights);
    }
    if (changes.outlines) {
        validate.outlines(newState.outlines);
    }
    if (changes.output) {
        validate.output(newState.output);
    }
    if (changes.pick) {
        validate.pick(newState.pick);
    }
    if (changes.points) {
        validate.points(newState.points);
    }
    if (changes.quality) {
        validate.quality(newState.quality);
    }
    if (changes.scene && newState.scene) {
        validate.scene(newState.scene);
    }
    if (changes.terrain) {
        validate.terrain(newState.terrain);
    }
    if (changes.toonOutline) {
        validate.toonOutline(newState.toonOutline);
    }
    if (changes.tonemapping) {
        validate.tonemapping(newState.tonemapping);
    }
    return validate.errors;
}

class ValidationContext {
    readonly errors: Error[] = [];

    background(state: RenderStateBackground) {
        const { blur, url } = state;
        if (blur != undefined) {
            this.numeric(blur).rangeInclusive(0, 1).report("background.blur");
        }
        if (url != undefined) {
            this.url(url).valid().report("background.url");
        }
    }

    camera(state: RenderStateCamera) {
        const { fov, near, far } = state;
        // TODO: verify rotation quaternion?
        this.numeric(fov).rangeExclusive(0, 180).report("camera.fov");
        this.numeric(near).positive().report("camera.near");
        this.numeric(far).min(near, "camera.near").report("camera.far");
    }

    clipping(state: RenderStateClipping) {
        const { planes } = state;
        this.numeric(planes.length).max(6).report("clipping.planes.length");
        for (let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            this.plane(plane.normalOffset).valid().hasErrors()?.report(`clipping.planes[${i}].normalOffset`);
        }
    }

    dynamic(state: RenderStateDynamicObjects) {
        const { objects } = state;
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (obj.baseObjectId != undefined) {
                this.numeric(obj.baseObjectId).integer().min(0xf000_0000).lessThan(0xffff_fff0).hasErrors()?.report(`dynamic.objects[${i}].baseObjectId`);
            }
            const { primitives } = obj.mesh;
            for (let j = 0; j < primitives.length; j++) {
                const primitive = primitives[j];
                const primitivePath = (name: string) => `dynamic.objects[${i}].mesh.primitives[${j}].${name}`; // we don't want to execute this unless there is an error, hence the .hasError() predicate.
                const { material, geometry } = primitive;
                if (material.kind == "ggx") {
                    const metallicFactor = material.metallicFactor ?? 1;
                    const roughnessFactor = material.roughnessFactor ?? 1;
                    this.numeric(metallicFactor).rangeInclusive(0, 1).hasErrors()?.report(primitivePath("material.metallicFactor"));
                    this.numeric(roughnessFactor).rangeInclusive(0, 1).hasErrors()?.report(primitivePath("material.roughnessFactor"));
                }
                var indices = typeof geometry.indices == "number" ? geometry.indices : geometry.indices.length;
                let numericValidator = this.numeric(indices).integer().positive();
                switch (geometry.primitiveType) {
                    case "LINES": {
                        numericValidator = numericValidator.divisibleBy(2);
                        break;
                    }
                    case "LINE_STRIP": {
                        numericValidator = numericValidator.min(2);
                        break;
                    }
                    case "TRIANGLES": {
                        numericValidator = numericValidator.divisibleBy(3);
                        break;
                    }
                    case "TRIANGLE_STRIP":
                    case "TRIANGLE_FAN": {
                        numericValidator = numericValidator.min(3);
                        break;
                    }
                }
                numericValidator.hasErrors()?.report(primitivePath("geometry.indices"));
            }
        }
    }

    highlights(state: RenderStateHighlightGroups) {
        const { groups } = state;
        this.numeric(groups.length).max(250).report("groups.length");
    }

    grid(state: RenderStateGrid) {
        const { size1, size2, distance, axisX, axisY } = state;
        this.numeric(size1).positive().report("grid.size1");
        this.numeric(size2).positive().report("grid.size2");
        this.numeric(distance).positive().report("grid.distance");
        this.vector3(axisX).normal().report("grid.axisX");
        this.vector3(axisY).normal().report("grid.axisY");
        this.vector3(axisX).perpendicularTo(axisY, "grid.axisY").report("grid.axisX");
    }

    outlines(state: RenderStateOutlines) {
        const { planes, linearThickness, minPixelThickness, maxPixelThickness, vertexObjectIdBase } = state;
        for (const plane of planes) {
            this.plane(plane).valid().report("outline.plane.normalOffset");
        }
        this.numeric(linearThickness).positive().report("outline.linearThickness");
        this.numeric(minPixelThickness).positive().report("outline.minPixelThickness");
        this.numeric(maxPixelThickness).greaterThanOrEqual(minPixelThickness, "outline.minPixelThickness").max(511).report("outline.maxPixelThickness");
        this.numeric(vertexObjectIdBase).integer().positive().report("outline.vertexObjectIdBase");
    }

    output(state: RenderStateOutput) {
        const { width, height, samplesMSAA } = state;
        this.numeric(width).integer().positive().report("output.width");
        this.numeric(height).integer().positive().report("output.height");
        this.numeric(samplesMSAA).integer().rangeInclusive(1, 16).report("output.samplesMSAA");
    }

    pick(state: RenderStatePick) {
        const { opacityThreshold } = state;
        this.numeric(opacityThreshold).rangeInclusive(0, 1).report("pick.opacityThreshold");
    }

    points(state: RenderStatePointCloud) {
        const { size, deviation } = state;
        if (size.pixel) {
            this.numeric(size.pixel).positive().report("points.size.pixel");
        }
        if (size.maxPixel) {
            this.numeric(size.maxPixel).positive().report("points.size.maxPixel");
        }
        if (size.metric) {
            this.numeric(size.metric).positive().report("points.size.metric");
        }
        this.numeric(deviation.colorGradients.length).rangeInclusive(0, 6).report("points.colorGradients.length");
        for (const gradient of deviation.colorGradients) {
            this.gradient(gradient).valid().report("points.deviation.colorGradient");
        }
        this.gradient(state.classificationColorGradient).valid().report("points.classificationColorGradient");
    }

    quality(state: RenderStateQuality) {
        const { detail } = state;
        this.numeric(detail).positive().report("quality.detail");
    }

    scene(state: RenderStateScene) {
        const { url } = state;
        if (url != undefined) {
            this.url(url).valid().report("scene.url");
        }
    }

    terrain(state: RenderStateTerrain) {
        const { elevationGradient } = state;
        this.gradient(elevationGradient).valid().report("terrain.elevationGradient");
    }

    toonOutline(state: RenderStateToonOutline) {
    }

    tonemapping(state: RenderStateTonemapping) {
    }

    numeric(value: number) {
        return new NumericValidator(this, value);
    }

    vector3(value: ReadonlyVec3) {
        return new Vector3Validator(this, value);
    }

    plane(value: ReadonlyVec4) {
        return new PlaneValidator(this, value);
    }

    gradient(value: RenderStateColorGradient<RGB | RGBA>) {
        return new GradientValidator(this, value);
    }

    url(value: string) {
        return new UrlValidator(this, value);
    }
}

class BaseValidator<T extends { toString: () => string }> {
    errors: string[] = [];
    constructor(readonly context: ValidationContext, readonly value: T) { }

    error(message: string) {
        this.errors.push(message);
    }

    hasErrors() {
        return this.errors.length > 0 ? this : undefined;
    }

    report(path: string) {
        if (this.errors.length) {
            const message = `${path}=${this.formatValue()}: ${this.errors.join(" ")}`;
            this.context.errors.push(new Error(message));
        }
    }

    formatValue() {
        return this.value.toString();
    }
}

class NumericValidator extends BaseValidator<number> {
    integer() {
        if (!Number.isInteger(this.value)) {
            this.error(`must be an integer!`);
        }
        return this;
    }

    positive() {
        if (this.value <= 0) {
            this.error(`must be larger than zero!`);
        }
        return this;
    }

    min(min: number, minText?: string) {
        if (this.value < min) {
            this.error(`must be greater or equal to ${minText ?? min}!`);
        }
        return this;
    }

    max(max: number, maxText?: string) {
        if (this.value > max) {
            this.error(`must be less or equal to ${maxText ?? max}!`);
        }
        return this;
    }

    greaterThan(ref: number, refText?: string) {
        if (this.value <= ref) {
            this.error(`must be greater than ${refText ?? ref}!`);
        }
        return this;
    }

    lessThan(ref: number, refText?: string) {
        if (this.value >= ref) {
            this.error(`must be less than ${refText ?? ref}!`);
        }
        return this;
    }

    greaterThanOrEqual(ref: number, refText?: string) {
        if (this.value < ref) {
            this.error(`must be greater than or equal to ${refText ?? ref}!`);
        }
        return this;
    }

    lessThanOrEqual(ref: number, refText?: string) {
        if (this.value > ref) {
            this.error(`must be less than or equal to ${refText ?? ref}!`);
        }
        return this;
    }

    rangeInclusive(min = 0, max = 1) {
        this.min(min);
        this.max(max);
        return this;
    }

    rangeExclusive(min = 0, max = 1) {
        this.greaterThan(min);
        this.lessThan(max);
        return this;
    }

    divisibleBy(divisor: number) {
        if (!Number.isInteger(this.value / divisor)) {
            this.error(`is not divisible by ${divisor}!`);
        }
        return this;
    }
}

class Vector3Validator extends BaseValidator<ReadonlyVec3> {
    normal(epsilon = 1E-6) {
        const len = vec3.length(this.value);
        if (len < 1 - epsilon || len > 1 + epsilon) {
            this.error(`must be normal, i.e. length = 1!`);
        }
        return this;
    }

    perpendicularTo(vec: ReadonlyVec3, vecText?: string, epsilon = 1E-6) {
        const dp = vec3.dot(this.value, vec);
        if (dp < -epsilon || dp > 1 + epsilon) {
            this.error(`must be perpendicular to ${vecText ?? vec.toString()}`);
        }
        return this;
    }

    nonZero() {
        if (vec3.dot(this.value, this.value) == 0) {
            this.error(`must be non-zero!`);
        }
        return this;
    }
}

class PlaneValidator extends BaseValidator<ReadonlyVec4> {
    valid(epsilon = 1E-6) {
        const [x, y, z] = this.value;
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len < 1 - epsilon || len > 1 + epsilon) {
            this.error(`plane must have a valid normal, i.e. [xyz].length = 1!`);
        }
        return this;
    }
}

class GradientValidator extends BaseValidator<RenderStateColorGradient<RGB | RGBA>> {
    valid() {
        const { knots } = this.value;
        if (knots.length > 0) {
            var prevPos = knots[0].position;
            for (let i = 1; i < knots.length; i++) {
                const nextPos = knots[i].position;
                if (nextPos < prevPos) {
                    this.error("must have knot positions in ascending order!")
                }
                prevPos = nextPos;
            }
        } else {
            this.error('must have more than zero knots!');
        }
        return this;
    }
}

class UrlValidator extends BaseValidator<string> {
    valid() {
        try {
            new URL(this.value);
        } catch {
            this.error("is not a valid absolute url!")
        }
        return this;
    }
}


