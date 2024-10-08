## Maturity status

Mostly a prototype to check if it would be possible to port to webgpu without altering the current api initially to then start to optimize. 

Background, cube, dynamic, grid and tonemap modules have been ported and are working including ts code and wgsl for their shaders.

Some basic resources have been ported as well in the webgpu folder and some common classes adapted to work with webgl and webgpu.

## To test

Use the webgpu app in https://github.com/novorender/webgpu-test-app