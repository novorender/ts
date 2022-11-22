import { RenderState, RenderContext } from "../../";
import { RenderModuleContext, RenderModule } from "..";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4, vec3 } from "gl-matrix";

export class BackgroundModule implements RenderModule {
    constructor(readonly state: RenderState) {
    }

    withContext(context: RenderContext) {
        return new BackgroundModuleInstance(context, this.state);
    }
}

class BackgroundModuleInstance implements RenderModuleContext {

    constructor(readonly context: RenderContext, readonly state: RenderState) {
        const { renderer } = context;
        // create static GPU resources here
    }

    render() {
        const { context, state } = this;
        const { renderer } = context;
        renderer.clear({ kind: "back_buffer", color: state.background.color, depth: 1.0 });
    }

    dispose() {
    }
}
