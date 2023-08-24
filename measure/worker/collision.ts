import { mat4, vec3, vec4 } from "gl-matrix";
import type { CylinderData, FaceData, ProductData } from "./brep";
import { cylinderCenterLine, fullCircleCylinder } from "./calculations";
import { matFromInstance, unitToScale } from "./loader";
import type { CollisionValues, MeasureSettings } from "measure";
import { MeasureTool } from "./scene";

export async function getFaceToFaceCollisionValues(
    productA: ProductData,
    faceIdxA: number,
    instanceIdxA: number,
    productB: ProductData,
    faceIdxB: number,
    instanceIdxB: number,
    setting?: MeasureSettings
): Promise<CollisionValues | undefined> {
    const faceDataA = productA.faces[faceIdxA];
    const surfaceDataA = productA.surfaces[faceDataA.surface];
    let surfaceA = {
        surf: MeasureTool.geometryFactory.getSurface(surfaceDataA, 1),
        instanceIdx: instanceIdxA,
        faceData: faceDataA,
        data: surfaceDataA,
        product: productA,
    };

    const faceDataB = productB.faces[faceIdxB];
    const surfaceDataB = productB.surfaces[faceDataB.surface];
    let surfaceB = {
        surf: MeasureTool.geometryFactory.getSurface(surfaceDataB, 1),
        instanceIdx: instanceIdxB,
        faceData: faceDataB,
        data: surfaceDataB,
        product: productB,
    };
    if (surfaceA.surf && surfaceB.surf) {
        if (surfaceA.surf.kind == "cylinder" && surfaceB.surf.kind == "cylinder") {
            if (!fullCircleCylinder(productA, faceDataA) || !fullCircleCylinder(productB, faceDataB)) {
                return undefined;
            }
            const cylinderA = surfaceA.data as CylinderData;
            const matA = matFromInstance(
                surfaceA.product.instances[surfaceA.instanceIdx]
            );

            const cylinderB = surfaceB.data as CylinderData;
            const matB = matFromInstance(
                surfaceB.product.instances[surfaceB.instanceIdx]
            );

            return getCylinderToCylnderCollisionValues(cylinderA,
                matA,
                surfaceA.product,
                surfaceA.faceData,
                unitToScale(surfaceA.product.units),
                cylinderB,
                matB,
                surfaceB.product,
                surfaceB.faceData,
                unitToScale(surfaceB.product.units),
                setting);
        }
    }
    return undefined;

}

type Ray = {
    start: vec3;
    dir: vec3;
}

function rayCyllinderCollision(ray: Ray, cylinderStart: vec3, cylinderDir: vec3, cylinderRad: number): vec3 | undefined {
    const parallel = vec3.equals(ray.dir, cylinderDir);
    if (parallel) { //Valid collision for parallel cylinders is probably unlikely so not handled
        return undefined;
    }

    const rc = vec3.sub(vec3.create(), ray.start, cylinderStart);
    const n = vec3.cross(vec3.create(), ray.dir, cylinderDir);
    const ln = vec3.len(n);
    vec3.normalize(n, n);
    const d = Math.abs(vec3.dot(rc, n));
    if (d <= cylinderRad) {
        const o = vec3.cross(vec3.create(), rc, cylinderDir);
        const t = -vec3.dot(o, n) / ln;
        const o2 = vec3.cross(vec3.create(), n, cylinderDir)
        vec3.normalize(o2, o2);
        const s = Math.abs(Math.sqrt(cylinderRad * cylinderRad - d * d) / vec3.dot(ray.dir, o2));
        const tIn = t - s;
        const tOut = t + s;
        const param = tIn < tOut ? tIn : tOut;
        const centerCol = vec3.scaleAndAdd(vec3.create(), ray.start, ray.dir, param);
        return centerCol;
    }
    return undefined;
}

async function getCylinderToCylnderCollisionValues(
    cylinderA: CylinderData,
    matA: mat4,
    productA: ProductData,
    faceDataA: FaceData,
    scaleA: number,
    cylinderB: CylinderData,
    matB: mat4,
    productB: ProductData,
    faceDataB: FaceData,
    scaleB: number,
    setting?: MeasureSettings
): Promise<CollisionValues | undefined> {
    const tolerance = 0.5;
    const [cylinderStartA, cylinderEndA] = await cylinderCenterLine(
        productA,
        faceDataA,
        cylinderA,
        matA,
    );
    const dirA = vec3.sub(vec3.create(), cylinderEndA, cylinderStartA);
    vec3.normalize(dirA, dirA);

    const [cylinderStartB, cylinderEndB] = await cylinderCenterLine(
        productB,
        faceDataB,
        cylinderB,
        matB,
    );
    const dirB = vec3.sub(vec3.create(), cylinderEndB, cylinderStartB);
    vec3.normalize(dirB, dirB);

    const radB = cylinderB.radius * scaleB;
    const radA = cylinderA.radius * scaleA;
    const ray = { start: cylinderStartA, dir: dirA };
    if (vec3.dist(ray.start, cylinderStartB) < vec3.dist(cylinderEndA, cylinderStartB)) { //inside so need to flip
        ray.start = cylinderEndA;
        vec3.negate(ray.dir, ray.dir);
    }

    if (Math.abs(vec3.dot(ray.dir, dirB)) > 0.99) {
        return undefined;
    }

    const colCenter = rayCyllinderCollision(ray, cylinderStartB, dirB, radB);
    if (colCenter) {
        const cylLen = vec3.dist(cylinderStartA, cylinderEndA) + tolerance;
        const p = vec4.fromValues(ray.dir[0], ray.dir[1], ray.dir[2], - vec3.dot(colCenter, ray.dir));
        if (Math.abs(vec4.dot(p, vec4.fromValues(ray.start[0], ray.start[1], ray.start[2], 1))) > cylLen) {
            return undefined;
        }
        if (!setting || setting?.cylinderMeasure === "center") {
            return { point: colCenter };
        }
        let side = vec3.fromValues(1, 0, 0);
        if (vec3.dot(ray.dir, side) === 1) {
            side = vec3.fromValues(0, 0, 1);
        }
        const up = vec3.cross(vec3.create(), ray.dir, side);
        vec3.normalize(up, up);
        const d = 1 / Math.abs(vec3.dot(up, dirB));
        if (setting.cylinderMeasure === "top") {
            const top = vec3.scaleAndAdd(vec3.create(), colCenter, dirB, radA * d);
            return { point: top };

        }
        const bottom = vec3.scaleAndAdd(vec3.create(), colCenter, dirB, -radA * d);
        return { point: bottom };
    }
    return undefined;
}