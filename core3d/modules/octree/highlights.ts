import type { RenderStateHighlightGroup } from "core3d";
import { mergeSorted } from "core3d/iterate";
import type { OctreeNode } from "./node";

export function createHighlightsMap(groups: readonly RenderStateHighlightGroup[], nodes: readonly OctreeNode[]) {
    const idMap = new Map<number, number>();
    // initialize map with all relevant object ids 
    for (const node of nodes) {
        for (const mesh of node.meshes) {
            for (const { objectId } of mesh.objectRanges) {
                idMap.set(objectId, 0);
            }
        }
    }

    // assign groups to relevant object ids
    for (const { value, sourceIndex } of traverseObjectIds(groups)) {
        const highlight = groups[sourceIndex].rgbaTransform !== null ? sourceIndex + 1 : 0xff;
        if (idMap.get(value) == 0) {
            idMap.set(value, highlight);
        }
    }
    return idMap;
}

// this functon returns all the objectIDs from highlight groups in ascending order, along with their respective highlight index.
// brute force iteration is slower than using maps or lookup arrays, but requires less memory.
function traverseObjectIds(groups: readonly RenderStateHighlightGroup[]) {
    const iterators = groups.map(g => g.objectIds[Symbol.iterator]());
    return mergeSorted(iterators);
}
