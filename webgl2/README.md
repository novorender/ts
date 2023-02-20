## WebGL 2 module

This module provides a set of utility functions for the [webgl2 api](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext).
The main goal is to avoid common pitfalls and boiler-plate aspects of the opengl API while retaining most of its functionality.
GL objects are not wrapped or hidden, making it easy to call native GL functions at any point.
An important sub-goal is to make good use ot typescript to maintain a productive editing experience, helping the developer discover the available functions and valid sets of parameters.

Inspirations: 
- https://github.com/regl-project/regl
- https://github.com/greggman/twgl.js

The module encourages more modern styles of GPU api, using immutable batch updates rather than piecemeal mutations and binding.
Furthermore, some functionality is deliberately left out where better options are available.
For example, Vertex Array Objects should be used instead of binding vertex attributes one at a time.

(example...)

Broadly speaking, there are three categories of functions:
1) Resource management
2) State management
3) Commands

## Resource management

This involves the creation, updating and destruction of GPU resources, such as buffers, textures, framebuffers, shaders, etc.
Creation of vertex array objects are made simpler by providing an array of attribute descriptors, rather than multiple bindings.
`glDelete()` lets you delete any type of GL resource, or an object with multiple resources in a single call.

## State management

The entire gl state is described as a strongly typed data structure.
You can apply changes using a partial state object of the same type. 
The default gl state is available as an object if you wish to reset all or part of the gl state to a default/known configuration.
The utility function for gl state has a little overhead and is best used for batch updates. For performance critical inner loops with few state changes, you may want to use the native API instead.

## Commands

Once you've created your resource and set up your state, you may call functions such as `glClear()`, `glDraw()` and `glCopy()` that actually executes GPU operations.
A number of variants and extensions are merged into a single function, expressing the desired behavior in the set of parameters rather than by function name.
This is to keep the api simple and help you quickly discover how to achieve what you want, while also keeping the code compact and readable.

Some of the paramenters names have been changed to make things more consistent and also better convey the exact meaning of e.g. a stride, size or offset.
Whenever this parameter is defined in bytes, the names is changed to `byteStride`, `byteSize` and `byteOffset`, etc. Names without "byte" in them, such as `first` or `count` typically indicates # of elements or vertices rather than # bytes.
This is to help make things more clear and avoid common bugs.

## Shaders

Shader programs are compiled and linked in a single function call.
You may inject common/shared code as part of the parameters.
Explicit layout of vertex attributes, draw buffers and and uniform buffers is encouraged.

## Vertex array objects

When creating VAOs using `glVertexArray()`, the attribute index is inferred from the index of the descriptor in the `attributes` array. Hence, you should also use use explicit layout qualifiers in your glsl code to ensure the indices really do match.

## Uniform buffers

To ease the use of uniform buffers, `glUBOProxy()` lets you create a typescript proxy object using a descriptor object. This will let you assign individual values by name within the uniform buffer. The modified range of bytes can then be copied into the VBO from the proxy's byte array.

> Offsets are computed, not queried, so the shader uniform buffer MUST use the `std140` layout!

## Misc utility functions

Common runtime constants, such as max texture size, max # attributes, etc. are available from `glLimits()`. The result is cached to make it performant enough for most use cases.

The `EXT_disjoint_timer_query_webgl2` timer functionality is wrapped in a Timer class with a CPU timer fallback via the `createTimer()` function. If only CPU timer is available, you should make sure to stall the GPU pipeline just prior to starting and stopping the timer, e.g. using `gl.getError()`. Doing so is not recommended for production code.

`glUniformLocations()` returns a js object with the locations of multiple uniforms by name `glUniformsInfo()` return more comprehensive information about a program's uniforms.

`glAttributesInfo` returns a js array with information about the program's active vertex attributes.

## Testing

A browser context that supports webgl2 is required to run this module, so automated testing is non-trivial.
This is one of the reason why this code is kept small and simple.
Since it wraps a relatively static API with new extensions being published rather sparsely, the code should be thoroughly tested manually when changed.

## Examples

TODO