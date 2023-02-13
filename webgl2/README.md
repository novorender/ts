## WebGL 2 module

This module provides a set of utility functions for the [webgl2 api](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext).
The main goal is to avoid common pitfalls and plain annoying boiler-plate aspects of the opengl API while retaining most of its functionality.
An important sub-goal is to make good use ot typescript to maintain a productive editing experience, helping the developer discover the available functions and valid sets of parameters.

Inspirations: 
- https://github.com/regl-project/regl
- https://github.com/greggman/twgl.js

The module encourages more modern styles of GPU api, using immutable batch updates rather than piecemeal mutations and binding.
Furthermore, some functionality is deliberately ignored where better options are available.
For example, uniform buffers should be used instead of setting uniforms piecemeal and Vertex Array Objects should be used instead of binding vertex attributes one at a time.

(example...)

Broadly speaking, there are three categories of functions:
1) Resource management
2) State management
3) Commands

## Resource management

This involves the creation, updating and destruction of GPU resources, such as buffers, textures, framebuffers, shaders, etc.
Creation of vertex array objects are made simpler by providing an array of attribute descriptors, rather than multiple binding

## State management

The entire gl state is described as a strongly typed data structure.
You can apply changes using a partial state object of the same type. 
The default gl state is available as an object if you wish to reset all or part of the gl state to a default/known configuration.

## Commands

Once you've created your resource and set up your state, you may call functions such as `glClear()`, `glDraw()` and `glCopy()` that actually executes GPU instructions.
A number of variants and extensions are merged into a single function, expressing the desired behavior in the set of parameters rather than by function name.
This is to keep the api simple and help you quickly discover how to achieve what you want, while also keeping the code compact and readable.

Some of the paramenters names have been changed to make things more consistent and also better convey the exact meaning of e.g. a stride, size or offset.
Whenever this parameter is defined in bytes, the names is changed to `byteStride`, `byteSize` and `byteOffset`, etc.
This is to help make things more clear and avoid common bugs.

## GL Runtime constants

Common runtime constants, such as max texture size, max # attributes, etc. are read out at creation and stored in immutable JS object for your convenience.

## Shaders

Shader programs are compiled and linked in a single function call.
Link-time Shader bindings may be specified as optional paramenters.
Information about shader uniforms and attributes are returned as a js object.

## Async reads
Synchronous reads of frame buffers will typically stall the entire pipeline and are generally bad.
Instead, async, promise based alternatives are provided for read operations and queries.
To check and potentially trigger these promises, `poll()` must be called on a fairly regular basis, e.g. once per frame.

## Testing

A browser context that supports webgl2 is required to run this mdoule, so automated testing is non-trivial.
This is one of the reason why this code is kept small and simple.
Since it wraps a relatively static API with new extensions being published rather sparsely, the code should be tested thoroughly manually and then left unchanged.

## Examples

TODO