import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";

/*
nurbs_wrapper.js
To work with ESbuild replace :

if (typeof exports === 'object' && typeof module === 'object')
    module.exports = Module;
else if (typeof define === 'function' && define['amd'])
    define([], function () { return Module; });
else if (typeof exports === 'object')
    exports["Module"] = Module;

with:
export default Module;
*/

// https://kripken.github.io/emscripten-site/docs/api_reference/module.html

export function makeNurbsCurve3D(instance: any, knots: number[], controlPoints: ReadonlyVec3[], weights: number[] | undefined, order: number) {
    const degree = order - 1;
    var knotsPtr = instance._malloc(8 * knots.length);
    var knotsHeap = new Float64Array(instance.HEAPF64.buffer, knotsPtr, knots.length);
    knotsHeap.set(knots);

    var controlPointsPtr = instance._malloc(controlPoints.length * 24);
    var controlPointsHeap = new Float64Array(instance.HEAPF64.buffer, controlPointsPtr, controlPoints.length * 3);
    var ctrlPoints = new Float64Array(controlPoints.length * 3);
    controlPoints.forEach((point, index) => {
        ctrlPoints[index * 3] = point[0];
        ctrlPoints[(index * 3) + 1] = point[1];
        ctrlPoints[(index * 3) + 2] = point[2];
    });
    controlPointsHeap.set(ctrlPoints);

    var nurbs = undefined;
    if (weights != undefined && weights.length > 0) {
        var weightsPtr = instance._malloc(8 * weights.length);
        var weightsHeap = new Float64Array(instance.HEAPF64.buffer, weightsPtr, weights.length);
        weightsHeap.set(weights);
        nurbs = instance._getNurbsCurve3DWithWeights(degree, controlPoints.length, knotsHeap.byteOffset,
            controlPointsHeap.byteOffset, weightsHeap.byteOffset);
        instance._free(weightsHeap.byteOffset);
    }
    else {
        nurbs = instance._getNurbsCurve3D(degree, controlPoints.length, knotsHeap.byteOffset,
            controlPointsHeap.byteOffset, 0);
    }
    instance._free(knotsHeap.byteOffset);
    instance._free(controlPointsHeap.byteOffset);
    return nurbs;
}

export function makeNurbsCurve2D(instance: any, knots: number[], controlPoints: ReadonlyVec2[], weights: number[] | undefined, order: number) {
    const degree = order - 1;
    var knotsPtr = instance._malloc(8 * knots.length);
    var knotsHeap = new Float64Array(instance.HEAPF64.buffer, knotsPtr, knots.length);
    knotsHeap.set(knots);

    var controlPointsPtr = instance._malloc(controlPoints.length * 16);
    var controlPointsHeap = new Float64Array(instance.HEAPF64.buffer, controlPointsPtr, controlPoints.length * 2);
    var ctrlPoints = new Float64Array(controlPoints.length * 2);
    controlPoints.forEach((point, index) => {
        ctrlPoints[index * 2] = point[0];
        ctrlPoints[(index * 2) + 1] = point[1];
    });
    controlPointsHeap.set(ctrlPoints);

    var nurbs = undefined;
    if (weights != undefined && weights.length > 0) {
        var weightsPtr = instance._malloc(8 * weights.length);
        var weightsHeap = new Float64Array(instance.HEAPF64.buffer, weightsPtr, weights.length);
        weightsHeap.set(weights);
        nurbs = instance._getNurbsCurve2DWithWeights(degree, controlPoints.length, knotsHeap.byteOffset,
            controlPointsHeap.byteOffset, weightsHeap.byteOffset);
        instance._free(weightsHeap.byteOffset);
    }
    else {
        nurbs = instance._getNurbsCurve2D(degree, controlPoints.length, knotsHeap.byteOffset,
            controlPointsHeap.byteOffset, 0);
    }
    instance._free(knotsHeap.byteOffset);
    instance._free(controlPointsHeap.byteOffset);
    return nurbs;
}



export function makeNurbsSurface(instance: any, knots: number[], dimU: number, dimV: number, controlPoints: ReadonlyVec3[], weights: number[] | undefined, orderU: number, orderV: number) {
    const degreeU = orderU - 1;
    const degreeV = orderV - 1;
    var knotsPtr = instance._malloc(8 * knots.length);
    var knotsHeap = new Float64Array(instance.HEAPF64.buffer, knotsPtr, knots.length);
    knotsHeap.set(knots);

    var controlPointsPtr = instance._malloc(controlPoints.length * 24);
    var controlPointsHeap = new Float64Array(instance.HEAPF64.buffer, controlPointsPtr, controlPoints.length * 3);
    var ctrlPoints = new Float64Array(controlPoints.length * 3);
    controlPoints.forEach((point, index) => {
        ctrlPoints[index * 3] = point[0];
        ctrlPoints[(index * 3) + 1] = point[1];
        ctrlPoints[(index * 3) + 2] = point[2];
    });
    controlPointsHeap.set(ctrlPoints);

    var nurbs = undefined;

    if (weights != undefined && weights.length > 0) {
        var weightsPtr = instance._malloc(8 * weights.length);
        var weightsHeap = new Float64Array(instance.HEAPF64.buffer, weightsPtr, weights.length);
        weightsHeap.set(weights);
        nurbs = instance._getNurbsSurfaceWithWeights(degreeU, degreeV, dimU, dimV, knotsHeap.byteOffset,
            controlPointsHeap.byteOffset, weightsHeap.byteOffset);
        instance._free(weightsHeap.byteOffset);
    }
    else {
        nurbs = instance._getNurbsSurface(degreeU, degreeV, dimU, dimV, knotsHeap.byteOffset,
            controlPointsHeap.byteOffset, 0);
    }
    instance._free(knotsHeap.byteOffset);
    instance._free(controlPointsHeap.byteOffset);
    return nurbs;
}