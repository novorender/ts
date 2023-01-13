# Artifacts

## Existing features

- [x] background/skybox
- [x] grid
- [x] test cube
- [x] octree traversal and rendering
- [x] basic ibl shading
- [x] textured terrain
- [x] loading/parsing in web worker
- [x] pick
- [x] measure (via pick sample disc)
- [x] **highlighting**
- [x] materials
- [x] large coordinates
- [x] terrain elevation
- [x] **gltf/glb objects**
- [x] clipping volumes
- [x] clipping box rendering (using volumes)
- [x] clipping outlines (only on cube, for now...)
- [x] point clouds (with variable sized point discs)
- [x] tonemapping (and debug shading)
- [x] default ibl (instead of sun light)
- [ ] camera headlight
- [x] watermark
- [ ] **proper test app**
- [ ] ocean?
- [ ] camera controllers
- [ ] device profile
- [ ] performance stats
- [ ] idle res/detail adjustments
- [ ] **ssao post effect**
- [ ] **taa post effect**

## Improvements

- [x] **handle loss of gl context**
- [x] **new binary format**
- [x] **filter-on-load**
- [x] async picking
- [x] pick sample disc (for measure and improve line picking)
- [x] **dynamic procedural geometry**
- [x] attribute defaults on no value
- [ ] attribute defaults on single value
- [ ] improved attribute packing
- [ ] basic edge rendering
- [ ] uv coords from pos (adjusted offset/scale)
- [x] antialiased grid
- [x] **immutable render state**
- [ ] render state validation
- [x] z-buffer prepass
- [ ] sort triangles by aread (zbuf prepass)
- [ ] logarithmic z-buffer
- [ ] points with spherical z-buffer
- [ ] double sided rendering (with "solid" backside)
- [x] clipping volume rendering
- [ ] pbr/ggx ibl shading
- [ ] *deferred shading?*
- [ ] msaa antialiasing
- [ ] msaa coverage transparency
- [ ] material textures
