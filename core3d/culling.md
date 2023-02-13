# Culling

Intel paper: [Masked software occlusion culling](https://www.intel.com/content/dam/develop/external/us/en/documents/masked-software-occlusion-culling.pdf)

WASM SIMD: [Proposal](https://github.com/WebAssembly/simd/blob/master/proposals/simd/SIMD.md)

## Occluder meshes

- Should be identified at the binary format generation stage.
  - Need to rearrange meshes and/or triangles
- We only need these from nodes close to camera
  - Or, more specifically, above a certain LOD.
- Few and large triangles

## Performance

- Web worker
- WASM
- SIMD
- Only render occluder meshes, filtered by projection size threshold.
- 3x16 bit position attributes only
  - indexed polygons?
- Tile based, hierarchical
- Fast AABB rejection
- Low latency (compared to GPU occlusion culling)
- Works well in dynamic environments

> But we are 99% static. What about anti-portals/occluders?

## Edged based occlusion

Occluder polygons = CSG expression of half spaces (from edges)
