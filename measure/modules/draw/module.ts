import type { ReadonlyVec2, ReadonlyVec3, } from "gl-matrix";
import { glMatrix, mat4, vec2, vec3, vec4 } from "gl-matrix";
import type { Camera, MeasureEntity, MeasureSettings, MeasureWorker } from "../../measure_view";
import { MeasureView } from "../../measure_view";
import { BaseModule } from "../base";
import type { DrawContext, DrawObject, DrawPart, DrawProduct, DrawableEntity, ElevationInfo, Line2d, LinesDrawSetting } from ".";
import type { DuoMeasurementValues } from "../core";
import type { ManholeMeasureValues } from "../manhole";
import { lineSegmentIntersection, type Intersection2d } from "../../calculations_2d";
import type { ObjectId } from "data";

const SCREEN_SPACE_EPSILON = 0.001;

/**
 * Module for converting measure data to drawable objects. 
 * functions will generally use Camera to object to project the objects to view space
 */

export class DrawModule extends BaseModule {

    constructor(readonly worker: MeasureWorker, readonly parent: MeasureView, readonly drawContext: DrawContext) {
        super(worker, parent);
    }

    /** @ignore */
    async getEntitiyObjects(
        entity: MeasureEntity,
        setting?: MeasureSettings
    ): Promise<DrawObject | undefined> {
        const workerScene = await this.worker;

        switch (entity.drawKind) {
            case "edge": {
                const wsVertices = await workerScene.getTesselatedEdge(
                    entity.ObjectId,
                    entity.pathIndex,
                    entity.instanceIndex
                );
                return {
                    kind: "edge", parts: [{ vertices3D: wsVertices, drawType: "lines" }]
                };
            }
            case "face": {
                const drawObjects = await workerScene.getFaceDrawObject(
                    entity.ObjectId,
                    entity.pathIndex,
                    entity.instanceIndex,
                    setting
                );
                return drawObjects;
            }
            case "vertex": {
                return {
                    kind: "vertex",
                    parts: [{ vertices3D: [entity.parameter as vec3], drawType: "vertex" }]
                };
            }
            case "curveSegment": {
                return await workerScene.getCurveSegmentDrawObject(
                    entity.ObjectId,
                    entity.pathIndex,
                    entity.instanceIndex,
                    setting?.segmentLabelInterval
                );
            }
        }
    }

    /** 
     * Updates the input draw objects with new 2d info based on camera properties
     * @param drawProduct The product that will be updated based on current camera.
     * @returns Corresponding 3D position at the view plane in world space, or undefined if there is no active render context.
     */
    updateProduct(drawProduct: DrawProduct, context = this.drawContext) {
        FillDrawInfo2D(context, drawProduct.objects);
    }

    /** Converts world space lines to on screen space lines 
     * @param points World space points that will be projected to screen space
     * @returns Screen space points, a path that will cut to the edge of the screen, 
     * points2d, all the points in 2d space regadless if they are within the current canvas size
     * and the original points removed from screen points
     */
    toScreenSpace(points: ReadonlyVec3[]): { screenPoints: ReadonlyVec2[], points2d: ReadonlyVec2[], indicesOnScreen: number[] } | undefined {
        const { drawContext } = this;
        const { width, height, camera } = drawContext;
        const { camMat, projMat } = getPathMatrices(width, height, camera);

        return toPathPointsFromMatrices(
            points,
            camMat,
            projMat,
            camera.near,
            width, height,
            camera.kind == "orthographic",
            camera.far
        );
    }

    /** Converts world space points to on screen space points
     * @param points World space points that will be projected to screen space
     * @returns Screen space points regadless if they are within the current canvas size
     * @deprecated use view.convert.worldSpaceToScreenSpace instead
     */
    toMarkerPoints(points: ReadonlyVec3[]): (ReadonlyVec2 | undefined)[] {
        const { drawContext } = this;
        const { width, height, camera } = drawContext;
        const { camMat, projMat } = getPathMatrices(width, height, camera);
        return points
            .map((p) => vec3.transformMat4(vec3.create(), p, camMat))
            .map((p, i, arr) => {
                if (camera.kind === "orthographic") {
                    if (p[2] > 0 && p[2] < 0.1) {
                        p[2] = -0.0001;
                    }
                }

                if (p[2] > SCREEN_SPACE_EPSILON) {
                    return undefined;
                }

                return toScreen(projMat, width, height, p)
            })
    }

    /** Returns a hierarcical structure of the element, describing how it should be drawn in 2d
     * @param entity the entity that is being drawn to screen, this can be any object that furfill the DrawableEntity interface {@link DrawableEntity}
     * @param setting settings on how the entity is supposed to be displayed
     * @returns  hierarcical structure of the element, describing how it should be drawn in 2d, including labels and angles
     */
    async getDrawEntity(
        entity: DrawableEntity,
        setting?: MeasureSettings
    ): Promise<DrawProduct> {
        let drawObjects: DrawObject[] = [];
        let kind: "manhole" | "basic" | "measureResult" | undefined = undefined;
        if (entity.drawKind == "manhole") {
            drawObjects = await this.parent.manhole.getManholeDrawObject(entity as ManholeMeasureValues);
            kind = "manhole"
        }
        else if (entity.drawKind == "measureResult") {
            drawObjects = [getResultDrawObject(entity as DuoMeasurementValues, setting)];
            kind = "measureResult";
        }
        else {
            const drawObject = await this.getEntitiyObjects(entity as MeasureEntity, setting);
            if (drawObject) {
                drawObjects = [drawObject];
            }
            kind = "basic";
        }

        if (drawObjects) {
            FillDrawInfo2D(this.drawContext, drawObjects);
        }
        return {
            kind, objects: drawObjects
        };
    }



    /** Converts a list of points to draw parts, these can be added to a DrawObjects.
     * @param points Set of points describing a polygon or linestrip
     * @param setting settings on how the entity is supposed to be displayed
     * @returns  hierarcical structure of the element, describing how it should be drawn in 2d, including labels and angles
     */
    getDrawPartsFromPoints(points: ReadonlyVec3[], settings?: LinesDrawSetting, objectId?: number): DrawPart[] {
        if (points.length === 0) {
            return [];
        }
        const closed = settings?.closed ?? true;
        const angles = settings?.angles ?? true;
        const generateLengthLabels = settings?.generateLengthLabels ?? false;
        const decimals = settings?.decimals ?? 3;
        let generateSlopeLabels = false;
        if (settings?.generateSlope != undefined) {
            if (settings.generateSlope == true) {
                generateSlopeLabels = true;
            } else if (settings.generateSlope == false) { }
            else if (objectId != undefined && settings.generateSlope.has(objectId)) {
                generateSlopeLabels = true;
            }
        }

        const parts: DrawPart[] = [];
        if (points.length === 1) {
            parts.push({ drawType: "vertex", vertices3D: points });
        } else {
            let text: string[][] | undefined = undefined;
            const elevation: (ElevationInfo | undefined)[] = [];
            if (generateLengthLabels || generateSlopeLabels) {
                const labels: string[] = [];
                for (let i = 1; i < points.length; ++i) {
                    if (generateLengthLabels) {
                        labels.push(vec3.dist(points[i - 1], points[i]).toFixed(decimals));
                    } if (generateSlopeLabels) {
                        const SLOPE_EPSILON = 0.1;
                        const z1 = points[i - 1][2];
                        const z2 = points[i][2]
                        const zDist = Math.abs(z1 - z2);
                        const vec2A = vec2.fromValues(points[i - 1][0], points[i - 1][1]);
                        const vec2B = vec2.fromValues(points[i][0], points[i][1]);
                        const planarDist = vec2.distance(vec2A, vec2B);
                        const slope = Math.abs(zDist / planarDist) * 100;
                        if (planarDist > SCREEN_SPACE_EPSILON && slope > SLOPE_EPSILON && Math.abs(slope - 100) > SLOPE_EPSILON) {
                            elevation.push({ from: z1, to: z2, horizontalDisplay: false, slope })
                        } else {
                            elevation.push(undefined);
                        }
                    }
                }
                text = [labels];
            }
            parts.push({ drawType: closed ? "filled" : "lines", vertices3D: points, text, elevation: elevation.length == 0 ? undefined : elevation });
        }

        if (angles) {
            const endIdx = closed ? points.length : points.length - 1;
            for (let i = closed ? 0 : 1; i < endIdx; ++i) {
                const anglePt = points[i];
                const fromPIdx = i === 0 ? points.length - 1 : i - 1;
                const toPIdx = i === points.length - 1 ? 0 : i + 1;
                const fromP = points[fromPIdx];
                const toP = points[toPIdx];
                const diffA = vec3.sub(vec3.create(), points[fromPIdx], anglePt);
                const diffB = vec3.sub(vec3.create(), points[toPIdx], anglePt);
                const angle = vec3.angle(diffA, diffB) * (180 / Math.PI);
                if (angle > 0.1) {
                    parts.push({ text: angle.toFixed(1) + "°", drawType: "angle", vertices3D: [vec3.clone(anglePt), vec3.clone(fromP), vec3.clone(toP)] });
                }
            }
        }
        return parts;
    }


    /** Converts a list of points to a drawable polygon or linestrip
     * @param points Set of points describing a polygon or linestrip
     * @param setting settings on how the entity is supposed to be displayed
     * @param context Optional to display the drawn object in another context
     * @returns  hierarcical structure of the element, describing how it should be drawn in 2d, including labels and angles
     */
    getDrawObjectFromPoints(points: ReadonlyVec3[], settings?: LinesDrawSetting, context?: DrawContext): DrawProduct | undefined {
        var parts = this.getDrawPartsFromPoints(points, settings);

        if (parts.length === 0) {
            return undefined;
        }
        const drawObjects: DrawObject[] = [];
        drawObjects.push({ kind: "complex", parts });
        FillDrawInfo2D(context ?? this.drawContext, drawObjects);
        return { kind: "basic", objects: drawObjects };
    }

    /** Combines multiple segments into a single drawable object. 
     * @param segments Line segments to be added to the list, These can be of any lenght 
     * @param setting settings on how the entity is supposed to be displayed
     * @param context Optional to display the drawn object in another context
     * @returns  hierarcical structure of the element, describing how it should be drawn in 2d, including labels and angles
     */
    getDrawObjectFromLineSegments(segments: ReadonlyVec3[][], id: ObjectId, settings?: LinesDrawSetting, context?: DrawContext): DrawProduct | undefined {
        const parts: DrawPart[] = [];
        for (var seg of segments) {
            parts.push(...this.getDrawPartsFromPoints(seg, settings));
        }
        if (parts.length === 0) {
            return undefined;
        }
        const drawObjects: DrawObject[] = [];
        drawObjects.push({ kind: "complex", parts });
        FillDrawInfo2D(context ?? this.drawContext, drawObjects);
        return { kind: "basic", objects: drawObjects, ObjectId: id };
    }


    /** Returns a draw object that places a text based on input points.
     * @param points Set of points for where the text should be placed.
     * @param text Text
     * @param context Optional to display the drawn object in another context
     * @returns  Draw product for displaying the text at chosen locations
     */
    getDrawText(points: ReadonlyVec3[], text: string, context?: DrawContext): DrawProduct | undefined {
        if (points.length === 0) {
            return undefined;
        }
        const parts: DrawPart[] = [];
        parts.push({ drawType: "text", vertices3D: points, text });

        const drawObjects: DrawObject[] = [];
        drawObjects.push({ kind: "complex", parts });

        FillDrawInfo2D(context ?? this.drawContext, drawObjects);
        return { kind: "basic", objects: drawObjects };
    }

    /** Returns a draw object that traces intersection between the 2d paths and displays the 3d distance as a label
     * @param objects Products that are being traced.
     * @param line Line that traces over objects.
     * @returns  Draw product for displaying lines between intersections and distance labels.
     */
    getTraceDrawOject(objects: DrawProduct[], line: Line2d, align?: ReadonlyVec2): DrawProduct {
        if (objects.length > 1) {
            const parts: DrawPart[] = [];
            const getIntersections = (line: Line2d) => {
                const intersections: {
                    intersection: Intersection2d, point3d: ReadonlyVec3, line: Line2d
                }[] = [];
                const emptyVertex = vec3.create();
                objects.forEach(obj => {
                    if (obj.kind == "basic") {
                        obj.objects.forEach(drawobj => {
                            if (drawobj.kind == "complex" || drawobj.kind == "curveSegment" || drawobj.kind == "edge") {
                                drawobj.parts.forEach(part => {
                                    if (part.vertices2D && (part.drawType == "lines" || part.drawType == "curveSegment" || part.drawType == "filled")) {

                                        for (let i = 1; i < part.vertices2D.length; ++i) {
                                            const prev3dPoint = part.indicesOnScreen ? part.vertices3D[part.indicesOnScreen[i - 1]] : part.vertices3D[i - 1];
                                            const current3dPoint = part.indicesOnScreen ? part.vertices3D[part.indicesOnScreen[i]] : part.vertices3D[i];
                                            if (vec3.equals(prev3dPoint, emptyVertex) || vec3.equals(current3dPoint, emptyVertex)) {
                                                continue;
                                            }
                                            const lineB = { start: part.vertices2D[i - 1], end: part.vertices2D[i] };
                                            const intersection = lineSegmentIntersection(line, lineB);
                                            if (intersection) {
                                                const dir = vec3.sub(vec3.create(), current3dPoint, prev3dPoint);
                                                intersections.push({ intersection, point3d: vec3.scaleAndAdd(vec3.create(), prev3dPoint, dir, intersection.u), line: lineB });
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
                return intersections;
            }
            if (align) {
                const verticalIntersections = getIntersections(line);
                let closest: Line2d | undefined;
                let dist = Number.MAX_SAFE_INTEGER;
                const intersectionPoint = vec2.create();
                for (const i of verticalIntersections) {
                    const d = vec2.dist(i.intersection.p, align);
                    if (d < dist) {
                        dist = d;
                        closest = i.line;
                        vec2.copy(intersectionPoint, i.intersection.p);
                    }
                }
                if (closest) {
                    const dx = closest.end[0] - closest.start[0];
                    const dy = closest.end[1] - closest.start[1];
                    const normal = vec2.fromValues(-dy, dx);
                    const tangent = vec2.fromValues(dx, dy);
                    vec2.normalize(normal, normal);
                    vec2.normalize(tangent, tangent);
                    const anglePointA = vec2.scaleAndAdd(vec2.create(), intersectionPoint, normal, 20);
                    const anglePointB = vec2.scaleAndAdd(vec2.create(), anglePointA, tangent, 20);
                    const anglePointC = vec2.scaleAndAdd(vec2.create(), intersectionPoint, tangent, 20);
                    parts.push({ drawType: "lines", vertices3D: [], vertices2D: [anglePointA, anglePointB, anglePointC] })
                    line = {
                        start: vec2.scaleAndAdd(vec2.create(), intersectionPoint, normal, this.drawContext.height),
                        end: vec2.scaleAndAdd(vec2.create(), intersectionPoint, normal, -this.drawContext.height),
                    };
                }

            }

            const intersections = getIntersections(line);
            if (intersections.length > 1) {
                intersections.sort((a, b) => a.intersection.t - b.intersection.t);
                const vertices3D: ReadonlyVec3[] = [vec3.create()];
                const vertices2D: ReadonlyVec2[] = [line.start];
                const labels: string[] = [""];
                intersections.forEach(intersection => {
                    vertices2D.push(intersection.intersection.p);
                });
                vertices2D.push(line.end);
                for (let i = 0; i < intersections.length; ++i) {
                    if (i != 0) {
                        labels.push(vec3.dist(intersections[i].point3d, intersections[i - 1].point3d).toFixed(3));
                    }
                    vertices3D.push(intersections[i].point3d);
                }
                vertices3D.push(vec3.create());
                labels.push("");

                parts.push({ drawType: "lines", vertices3D, vertices2D, text: [labels] });

                const drawObjects: DrawObject[] = [];
                drawObjects.push({ kind: "complex", parts });
                return { kind: "basic", objects: drawObjects };
            }

        }
        const parts: DrawPart[] = [];
        parts.push({ drawType: "lines", vertices3D: [], vertices2D: [line.start, line.end] });
        const drawObjects: DrawObject[] = [];
        drawObjects.push({ kind: "complex", parts });
        return { kind: "basic", objects: drawObjects };
    }

    /** returs the 2d normal of the first draw part the line hits  
     * @param object Product with parts
     * @param line Line that needs to intersect the product. 
     * @returns  The 2d normal of the drawn object at the intersection of the input line.
     */
    get2dNormal(object: DrawProduct, line: { start: ReadonlyVec2, end: ReadonlyVec2 }): { normal: ReadonlyVec2, position: ReadonlyVec2 } | undefined {
        if (object.kind != "basic") {
            return undefined;
        }
        const intersections: {
            intersection: Intersection2d, line: { start: ReadonlyVec2, end: ReadonlyVec2 }
        }[] = [];
        const emptyVertex = vec3.create();
        object.objects.forEach(drawobj => {
            if (drawobj.kind == "complex" || drawobj.kind == "curveSegment" || drawobj.kind == "edge") {
                drawobj.parts.forEach(part => {
                    if (part.vertices2D && (part.drawType == "lines" || part.drawType == "curveSegment" || part.drawType == "filled")) {
                        for (let i = 1; i < part.vertices2D.length; ++i) {
                            if (vec3.equals(part.vertices3D[i - 1], emptyVertex) || vec3.equals(part.vertices3D[i], emptyVertex)) {
                                continue;
                            }
                            const lineB = { start: part.vertices2D[i - 1], end: part.vertices2D[i] };
                            const intersection = lineSegmentIntersection(line, lineB);
                            if (intersection) {
                                intersections.push({ intersection, line: lineB });
                            }
                        }
                    }
                });
            }
        });
        if (intersections.length > 0) {
            intersections.sort((a, b) => a.intersection.t - b.intersection.t);
            const line = intersections[0].line;
            const dx = line.end[0] - line.start[0];
            const dy = line.end[1] - line.start[1];
            const normal = vec2.fromValues(-dy, dx);
            vec2.normalize(normal, normal);
            return {
                normal, position: intersections[0].intersection.p
            };
        }
        return undefined;
    }

}



function getPathMatrices(width: number, height: number, camera: Camera): { camMat: mat4; projMat: mat4 } {
    const camMat = mat4.fromRotationTranslation(
        mat4.create(),
        camera.rotation,
        camera.position
    );
    mat4.invert(camMat, camMat);
    if (camera.kind == "pinhole") {
        const projMat = mat4.perspective(
            mat4.create(),
            glMatrix.toRadian(camera.fov),
            width / height,
            camera.near,
            camera.far
        );
        return { camMat, projMat };
    } else {
        const aspect = width / height;
        const halfHeight = camera.fov / 2;
        const halfWidth = halfHeight * aspect;
        const projMat = mat4.ortho(
            mat4.create(),
            -halfWidth,
            halfWidth,
            -halfHeight,
            halfHeight,
            camera.near,
            camera.far
        );
        return { camMat, projMat };
    }
}
function toOnscreenText(points: ReadonlyVec3[],
    directions: ReadonlyVec3[] | undefined,
    camMat: mat4,
    projMat: mat4,
    near: number,
    width: number,
    height: number,
    ortho: boolean,
    cameraFar: number) {

    const intdices: number[] = [];
    const angles: number[] = [];
    const screenPoints: ReadonlyVec2[] = [];

    const offset = vec3.create();
    const point = vec3.create();

    // Allow text anchor point to be 200px outside screen bounds
    // to account for long text and offsets
    const threshold = 200;

    points.forEach((pointWorldSpace, i) => {
        vec3.transformMat4(point, pointWorldSpace, camMat);

        //Avoid objects very near the camera or past the far plane
        if (ortho && (point[2] < -cameraFar)) {
            return;
        }
        if (point[2] > SCREEN_SPACE_EPSILON) {
            return;
        }
        const _p = toScreen(projMat, width, height, point);
        if (_p[0] < -threshold || _p[0] > width + threshold || _p[1] < -threshold || _p[1] > height + threshold) {
            return;
        }
        intdices.push(i);
        if (directions) {
            vec3.scaleAndAdd(offset, point, directions[i], 1000);
            const offset2d = toScreen(projMat, width, height, offset);
            vec2.sub(offset2d, offset2d, _p);
            const angle = Math.atan2(offset2d[1], offset2d[0]);
            angles.push(angle);
        }
        screenPoints.push(_p);
    });
    
    if (screenPoints.length) {
        return { screenPoints, intdices, angles: angles.length === 0 ? undefined : angles };
    }
    return undefined;
}

function toPathPointsFromMatrices(
    points: ReadonlyVec3[],
    camMat: mat4,
    projMat: mat4,
    near: number,
    width: number,
    height: number,
    ortho: boolean,
    cameraFar: number
): { screenPoints: ReadonlyVec2[], points2d: ReadonlyVec2[], indicesOnScreen: number[] } | undefined {
    const clip = (out: vec3, p: vec3, p0: vec3) => {
        const d = vec3.sub(out, p0, p);
        vec3.scale(d, d, (-near - p[2]) / d[2]);
        return vec3.add(d, d, p);
    };

    const points2d: ReadonlyVec2[] = [];
    const indicesOnScreen: number[] = [];
    let currentIdx = 0;

    const clipVec = vec3.create();
    const prevHead = vec3.create();
    const head = vec3.create();
    const screenPoints = points.reduce((tail, point, i) => {
        if (i !== 0) {
            vec3.copy(prevHead, head);
        }
        vec3.transformMat4(head, point, camMat);
        if (ortho) {
            //Avoid objects very near the camera, put them behind instead
            if (head[2] > 0 && head[2] < 0.1) {
                head[2] = -0.0001;
            }
            if (head[2] < -cameraFar) {
                currentIdx++
                return tail;
            }
        }
        if (head[2] > SCREEN_SPACE_EPSILON) {
            if (i === 0 || prevHead[2] > 0) {
                currentIdx++
                return tail;
            }
            const p0 = clip(clipVec, prevHead, head);
            const _p = toScreen(projMat, width, height, p0);
            points2d.push(_p);
            indicesOnScreen.push(currentIdx++);
            tail.push(_p);
            return tail;
        }
        const _p = toScreen(projMat, width, height, head);
        points2d.push(_p);
        if (i !== 0 && prevHead[2] > SCREEN_SPACE_EPSILON) {
            const p0 = clip(clipVec, head, prevHead);
            const _p0 = toScreen(projMat, width, height, p0);
            indicesOnScreen.push(currentIdx);
            indicesOnScreen.push(currentIdx++);
            tail.push(_p0, _p);
            return tail;
        }
        indicesOnScreen.push(currentIdx++);
        tail.push(_p);
        return tail;
    }, [] as ReadonlyVec2[]);
    if (screenPoints.length) {
        return { screenPoints, points2d, indicesOnScreen };
    }
    return undefined;
}

const toScreen = (() => {
    const _toScreenVec1Buf = vec4.create();
    const _toScreenVec2Buf = vec4.create();
    return function toScreen(projMat: mat4, width: number, height: number, p: ReadonlyVec3): vec2 {
        vec4.set(_toScreenVec2Buf, p[0], p[1], p[2], 1);
        const _p = vec4.transformMat4(
            _toScreenVec1Buf,
            _toScreenVec2Buf,
            projMat
        );

        const pt = vec2.fromValues(
            Math.round(((_p[0] * 0.5) / _p[3] + 0.5) * width),
            Math.round((0.5 - (_p[1] * 0.5) / _p[3]) * height)
        );

        if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
            vec2.set(pt, -100, -100);
        }
        return pt;
    };
})();

/**
 * @internal 
 */

export function FillDrawInfo2DOnPart(context: DrawContext, drawPart: DrawPart) {
    const { width, height, camera } = context;
    const { camMat, projMat } = getPathMatrices(width, height, camera);
    if (drawPart.drawType == "text") { // Pure text can use simplified conversion to 2d
        const points = toOnscreenText(
            drawPart.vertices3D,
            drawPart.directions3D,
            camMat,
            projMat,
            camera.near,
            width,
            height,
            camera.kind == "orthographic",
            camera.far + 0.2
        );
        drawPart.vertices2D = points?.screenPoints;
        drawPart.angles2D = points?.angles;
        drawPart.indicesOnScreen = points?.intdices;
    }
    else {
        const points = toPathPointsFromMatrices(
            drawPart.vertices3D,
            camMat,
            projMat,
            camera.near,
            width,
            height,
            camera.kind == "orthographic",
            camera.far + 0.2
        );
        if (points) {
            const { screenPoints, indicesOnScreen } = points;
            drawPart.vertices2D = screenPoints;
            drawPart.indicesOnScreen = screenPoints.length == drawPart.vertices3D.length ? undefined : indicesOnScreen;
        }
        else {
            drawPart.indicesOnScreen = undefined;
            drawPart.vertices2D = undefined;
        }
        if (drawPart.voids) {
            drawPart.voids.forEach((drawVoid, j) => {
                const voidPoints = toPathPointsFromMatrices(
                    drawVoid.vertices3D,
                    camMat,
                    projMat,
                    camera.near,
                    width,
                    height,
                    camera.kind == "orthographic",
                    camera.far
                );
                if (voidPoints) {
                    const { screenPoints, indicesOnScreen } = voidPoints;
                    drawVoid.vertices2D = screenPoints;
                    drawVoid.indicesOnScreen = screenPoints.length == drawVoid.vertices3D.length ? undefined : indicesOnScreen;
                }
                else {
                    drawVoid.vertices2D = undefined;
                }
            });
        }
    }
}

export function FillDrawInfo2D(context: DrawContext, drawObjects: DrawObject[]) {
    for (const drawObject of drawObjects) {
        for (const drawPart of drawObject.parts) {
            FillDrawInfo2DOnPart(context, drawPart);
        }
    }
}



function getResultDrawObject(result: DuoMeasurementValues, setting?: MeasureSettings): DrawObject {
    const parts: DrawPart[] = [];
    if (result.measureInfoA?.point && result.measureInfoB?.point) {
        const measurePoints = [result.measureInfoA?.point, result.measureInfoB?.point];
        const flip = measurePoints[0][2] > measurePoints[1][2];
        let pts = flip ? [measurePoints[1], measurePoints[0]] : [measurePoints[0], measurePoints[1]];
        const diff = vec3.sub(vec3.create(), pts[0], pts[1]);
        const measureLen = vec3.len(diff);
        parts.push({ name: "result", text: measureLen.toFixed(3), drawType: "lines", vertices3D: [vec3.clone(measurePoints[0]), vec3.clone(measurePoints[1])] });

        if (setting?.planeMeasure) {
            const plane = setting?.planeMeasure;
            const dir = vec3.fromValues(plane[0], plane[1], plane[2]);
            const up = glMatrix.equals(Math.abs(vec3.dot(vec3.fromValues(0, 0, 1), dir)), 1)
                ? vec3.fromValues(0, 1, 0)
                : vec3.fromValues(0, 0, 1);

            const right = vec3.cross(vec3.create(), up, dir);
            vec3.cross(up, dir, right);
            vec3.normalize(up, up);

            vec3.cross(right, up, dir);
            vec3.normalize(right, right);

            const tx = vec3.dot(diff, right);
            const ty = vec3.dot(diff, up);
            const py = vec3.scaleAndAdd(vec3.create(), pts[1], up, ty);

            parts.push({ name: "y-axis", text: Math.abs(ty).toFixed(3), drawType: "lines", vertices3D: [vec3.clone(py), vec3.clone(pts[1])] });
            parts.push({ name: "x-axis", text: Math.abs(tx).toFixed(3), drawType: "lines", vertices3D: [vec3.clone(pts[0]), vec3.clone(py)] });

            //Angles:
            const xDiff = vec3.sub(vec3.create(), pts[0], py);
            const angle = vec3.angle(diff, xDiff) * (180 / Math.PI);
            if (angle > 0.1) {
                parts.push({ name: "x-angle", text: angle.toFixed(1) + "°", drawType: "angle", vertices3D: [vec3.clone(pts[0]), vec3.clone(py), vec3.clone(pts[1])] });
            }

            const yDiff = vec3.sub(vec3.create(), py, pts[1]);
            const yAngle = vec3.angle(diff, yDiff) * (180 / Math.PI);
            if (yAngle > 0.1) {
                parts.push({ name: "y-angle", text: yAngle.toFixed(1) + "°", drawType: "angle", vertices3D: [vec3.clone(pts[1]), vec3.clone(pts[0]), vec3.clone(py)] });
            }
        }
        else {
            pts = [
                pts[0],
                vec3.fromValues(pts[1][0], pts[0][1], pts[0][2]),
                vec3.fromValues(pts[1][0], pts[1][1], pts[0][2]),
                pts[1],
            ];

            parts.push({ name: "x-axis", text: Math.abs(diff[0]).toFixed(3), drawType: "lines", vertices3D: [vec3.clone(pts[0]), vec3.clone(pts[1])] });
            parts.push({ name: "y-axis", text: Math.abs(diff[1]).toFixed(3), drawType: "lines", vertices3D: [vec3.clone(pts[1]), vec3.clone(pts[2])] });
            parts.push({ name: "z-axis", text: Math.abs(diff[2]).toFixed(3), drawType: "lines", vertices3D: [vec3.clone(pts[2]), vec3.clone(pts[3])] });


            const planarDiff = vec2.len(vec2.fromValues(diff[0], diff[1]));
            const xyPt1 = vec3.fromValues(pts[0][0], pts[0][1], Math.min(pts[0][2], pts[3][2]));
            const xyPt2 = vec3.fromValues(pts[3][0], pts[3][1], Math.min(pts[0][2], pts[3][2]));
            parts.push({ name: "xy-plane", text: planarDiff.toFixed(3), drawType: "lines", vertices3D: [xyPt1, xyPt2] });

            //Angles:
            const zDiff = vec3.sub(vec3.create(), pts[2], pts[3]);
            const angle = vec3.angle(diff, zDiff) * (180 / Math.PI);
            if (angle > 0.1) {
                const fromP = flip ? vec3.clone(measurePoints[1]) : vec3.clone(measurePoints[0]);
                const toP = vec3.clone(pts[2]);
                parts.push({ name: "z-angle", text: angle.toFixed(1) + "°", drawType: "angle", vertices3D: [vec3.clone(pts[3]), fromP, toP] });
            }

            const xzDiff = vec3.sub(vec3.create(), xyPt1, xyPt2);
            const xzAngle = vec3.angle(diff, xzDiff) * (180 / Math.PI);
            if (xzAngle > 0.1) {
                const fromP = flip ? vec3.clone(measurePoints[0]) : vec3.clone(measurePoints[1]);
                parts.push({ name: "xz-angle", text: xzAngle.toFixed(1) + "°", drawType: "angle", vertices3D: [vec3.clone(xyPt1), fromP, vec3.clone(xyPt2)] });
            }
        }


    }

    if (result.angle) {
        parts.push({
            name: "cylinder-angle", text: (result.angle.radians * (180 / Math.PI)).toFixed(1) + "°", drawType: "angle",
            vertices3D: [vec3.clone(result.angle.angleDrawInfo[0]), vec3.clone(result.angle.angleDrawInfo[1]), vec3.clone(result.angle.angleDrawInfo[2])]
        });
        if (result.angle.additionalLine) {
            parts.push({ name: "cylinder-angle-line", drawType: "lines", vertices3D: [vec3.clone(result.angle.additionalLine[0]), vec3.clone(result.angle.additionalLine[1])] });
        }
    }

    if (result.normalPoints) {
        const dist = vec3.len(vec3.sub(vec3.create(), result.normalPoints[0], result.normalPoints[1]));
        parts.push({ name: "normal", text: dist.toFixed(3), drawType: "lines", vertices3D: [vec3.clone(result.normalPoints[0]), vec3.clone(result.normalPoints[1])] });
    }
    return { parts, kind: "complex" }
}