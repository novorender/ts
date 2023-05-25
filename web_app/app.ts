
import { createTestSphere, createTestCube, createRandomInstances } from "core3d/geometry";
import { createColorSetHighlight, createHSLATransformHighlight, createNeutralHighlight, defaultRenderState, initCore3D, mergeRecursive, modifyRenderStateFromCadSpace, RenderContext, type OctreeSceneConfig, type RenderStateDynamicObject, type RenderStateScene } from "core3d";
import { type RenderState, type RenderStateChanges, type RenderStateClippingPlane } from "core3d";
import { downloadScene } from "core3d/scene";
import { type ReadonlyVec3, vec3, quat, mat3 } from "gl-matrix";
import { OrbitController } from "./controller/orbit";
import { OrthoController } from "./controller/ortho";
import { FlightController } from "./controller/flight";
import { BaseController } from "./controller/base";
import { ControllerInput } from "./controller/input";
import type { DeviceProfile } from "core3d/device";
import { PanoramaController } from "./controller/panorama";

const coreProfile = {
    features: {
        outline: true,
    },
    limits: {
        maxGPUBytes: 2_000_000_000,
        maxPrimitives: 100_000_000,
        maxSamples: 4, // MSAA
    },
    quirks: {
        iosShaderBug: false, // Older (<A15) IOS devices has a bug when using flat interpolation in complex shaders, which causes Safari to crash after a while. Update: Fixed with WEBGL_provoking_vertex extension!
    },
    detailBias: 0.6,
} as const satisfies DeviceProfile;


const deviceProfile = {
    ...coreProfile,
    renderResolution: 1,
    framerateTarget: 30 as number
} as const;

export interface ViewStateContext {
    readonly scriptUrl: string;
    readonly renderContext: RenderContext | undefined;
    readonly renderState: RenderState;
    // readonly clippingPlanes: readonly RenderStateClippingPlane[];
    readonly controllers: { readonly [key: string]: BaseController };
    activeController: BaseController;
    modifyRenderState(changes: RenderStateChanges): void;
    loadScene(sceneId: string | undefined, initPos: ReadonlyVec3 | undefined, centerPos: ReadonlyVec3 | undefined, autoFit: boolean): Promise<OctreeSceneConfig>;
    switchCameraController(kind: string): Promise<void>;
}

export interface AppState {
    readonly msaa: number,
    readonly quit: boolean,
    controllerState: string
}


export class WebApp implements ViewStateContext {
    readonly scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    readonly alternateUrl = new URL("http://192.168.1.129:9090/").toString();
    public renderContext: RenderContext | undefined;
    public renderState: RenderState;
    private stateChanges: RenderStateChanges | undefined;

    //* @internal */
    controllers;
    //* @internal */
    activeController: BaseController;
    //* @internal */
    clippingPlanes: RenderStateClippingPlane[] = [];


    //Drs
    private resolutionModifier: number = deviceProfile.renderResolution; //For dynamic resolution scaling
    private drsHighInterval = (1000 / deviceProfile.framerateTarget) * 1.2;
    private drsLowInterval = (1000 / deviceProfile.framerateTarget) * 0.9;
    private lastQualityAdjustTime = 0;
    private resolutionTier: 0 | 1 | 2 = 2;

    private currentDetailBias: number = 1;

    private setRenderContext = (context: RenderContext): void => {
        this.renderContext = context;
    }

    constructor(readonly canvas: HTMLCanvasElement, readonly appState: AppState) {
        initCore3D(deviceProfile, canvas, this.setRenderContext);
        this.renderState = defaultRenderState();
        const input = new ControllerInput(canvas);
        this.controllers = {
            flight: new FlightController(this, input),
            orbit: new OrbitController(input),
            ortho: new OrthoController(input),
            panorama: new PanoramaController(input)
        } as const
        this.activeController = this.controllers["flight"];
        this.activeController.updateParams({ proportionalCameraSpeed: { min: 0.2, max: 1000 } });

        const resizeObserver = new ResizeObserver(() => { this.resize(); });
        resizeObserver.observe(canvas);

        this.clippingPlanes = [
            { normalOffset: [1, 0, 0, 0], color: [1, 0, 0, 0.5] },
            { normalOffset: [0, 1, 0, 0], color: [0, 1, 0, 0.5] },
            { normalOffset: [0, 0, 1, 0], color: [0, 0, 1, 0.5] },
        ];
    }

    dispose() {
        this.renderContext?.dispose();
        this.renderContext = undefined;
    }

    private resize() {
        const scale = devicePixelRatio * this.resolutionModifier * (this.appState.msaa ? 0.5 : 1); // / 2;
        // const scale = 1.0;
        let { width, height } = this.canvas.getBoundingClientRect();
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const { output } = this.renderState;
        if (width != output.width || height != output.height) {
            this.renderState = modifyRenderStateFromCadSpace(this.renderState, { output: { width, height } });
            // this.modifyRenderState({ output: { width, height } });
        }
    }

    //* @internal */
    async loadScene(url: string, initPos: ReadonlyVec3 | undefined, centerPos: ReadonlyVec3 | undefined, autoFit = true): Promise<OctreeSceneConfig> {
        const scene = await downloadScene(url);

        let center = initPos ?? scene.config.center ?? vec3.create();
        const radius = scene.config.boundingSphere.radius ?? 5;
        if (autoFit) {
            const autofit = vec3.clone(center);
            const tmp = autofit[1];
            autofit[1] = -autofit[2];
            autofit[2] = tmp;
            this.activeController.autoFit(autofit, radius);
        }
        const camera = this.activeController.stateChanges();
        center = centerPos ? centerPos : center;
        // const dir = vec3.fromValues(-0.5270090794146822, 0, -0.8498596532454572);
        // const pos = vec3.fromValues(115213.01647839644, 42.620445251464865, -1091231.5616925554);
        // const dot = vec3.dot(dir, pos);

        const centerDir = vec3.fromValues(0, 0, 1);
        vec3.normalize(centerDir, centerDir);
        const [cx, cy, cz] = centerDir;
        const offs = vec3.dot(centerDir, center);
        // offs = 10;

        this.clippingPlanes = [
            // { normalOffset: [1, 0, 0, center[0]], color: [1, 0, 0, 0.5] },
            // { normalOffset: [0, 1, 0, center[1]], color: [0, 1, 0, 0.5] },
            { normalOffset: [cx, cy, cz, offs], color: [0, 0, 1, 0.5] },
        ];
        // this.clippingPlanes = [
        //     // { normalOffset: [1, 0, 0, center[0]], color: [1, 0, 0, 0.5] },
        //     // { normalOffset: [0, 1, 0, center[1]], color: [0, 1, 0, 0.5] },
        //     { normalOffset: [dir[0], dir[1], dir[2], dot], color: [0, 0, 1, 0.5] },
        // ];
        this.modifyRenderState({
            scene,
            camera,
            grid: { origin: center },
        });

        const flipYZ = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
        const { config } = scene;
        return {
            ...config,
            center: vec3.transformQuat(vec3.create(), config.center, flipYZ),
            offset: vec3.transformQuat(vec3.create(), config.offset, flipYZ),
            boundingSphere: {
                radius: config.boundingSphere.radius,
                center: vec3.transformQuat(vec3.create(), config.boundingSphere.center, flipYZ),
            },
            aabb: {
                min: vec3.transformQuat(vec3.create(), config.aabb.min, flipYZ),
                max: vec3.transformQuat(vec3.create(), config.aabb.max, flipYZ),
            }
        }
    }


    async pick(x: number, y: number, sampleDiscRadius = 0) {
        const context = this.renderContext;
        if (context) {
            const samples = await context.pick(x, y, sampleDiscRadius);
            if (samples.length) {
                const flipYZ = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
                const centerSample = samples.reduce((a, b) => a.depth < b.depth ? a : b);
                const flippedSample = {
                    ...centerSample,
                    position: vec3.transformQuat(vec3.create(), centerSample.position, flipYZ),
                    normal: vec3.transformQuat(vec3.create(), centerSample.normal, flipYZ)
                }
                return flippedSample;
            }
        }
        return undefined;
    }

    async switchCameraController(kind: string) {
        function isControllerKind(kind: string, controllers: Object): kind is keyof WebApp["controllers"] {
            return kind in controllers;
        }
        if (!isControllerKind(kind, this.controllers))
            throw new Error(`Unknown controller kind: ${kind}!`);

        const { controllers, renderContext } = this;
        let { activeController } = this;

        // find minimum renderered distance
        let distance: number | undefined;
        if (renderContext) {
            renderContext.renderPickBuffers();
            const pick = (await renderContext.buffers.pickBuffers()).pick;
            const depths = await renderContext.getLinearDepths(pick);
            distance = Number.MAX_VALUE;
            for (const depth of depths) {
                distance = Math.min(distance, depth);
            }
        }

        // transfer what state we can from previous controller
        const prevState = activeController.serialize(true /* include derived properties as well */);
        const prevController = this.activeController;
        activeController = this.activeController = controllers[kind];
        const { position, rotation, pivot, fovDegrees, fovMeters } = prevState;
        // if (rotation) {
        //     const mat = mat3.fromQuat(mat3.create(), rotation);
        //     const up = vec3.fromValues(0, 1, 0);
        //     const dir = vec3.fromValues(mat[6], mat[7], mat[8]);
        //     const side = vec3.cross(vec3.create(), up, dir);
        //     const newDir = vec3.cross(vec3.create(), side, up);
        //     vec3.normalize(dir, dir);
        //     vec3.normalize(side, side);
        //     const mat2 = mat3.fromValues(
        //         side[0], side[1], side[2],
        //         up[0], up[1], up[2],
        //         newDir[0], newDir[1], newDir[2]
        //     );
        //     quat.fromMat3(rotation, mat2);
        // }

        activeController.init({ kind, position, rotation, pivot, distance, fovDegrees, fovMeters });
        const changes = activeController.stateChanges();
        this.modifyRenderState({ camera: changes });
    }

    /** @internal */
    dynamicResolutionScaling(frameIntervals: number[]) {
        const samples = 9;
        if (frameIntervals.length == samples) {
            const highFrameInterval = this.drsHighInterval;
            const lowFrameInterval = this.drsLowInterval;
            const sortedIntervals = [...frameIntervals];
            sortedIntervals.sort();
            const medianInterval = sortedIntervals[Math.floor(samples / 2)];
            frameIntervals.splice(0, 1);
            const cooldown = 3000;
            const now = performance.now();
            if (now > this.lastQualityAdjustTime + cooldown) { // add a cooldown period before changing anything
                const resolutionTiers = [0.66, 0.75, 1];
                if (medianInterval > highFrameInterval) {
                    if (this.resolutionTier != 0) {
                        this.resolutionModifier = deviceProfile.renderResolution * resolutionTiers[--this.resolutionTier];
                        this.resize();
                    }
                    this.lastQualityAdjustTime = now; // reset cooldown whenever we encounter a slow frame so we don't change back to high res too eagerly
                    return;
                } else if (medianInterval < lowFrameInterval) {
                    if (this.resolutionTier != 2) {
                        this.resolutionModifier = deviceProfile.renderResolution * resolutionTiers[++this.resolutionTier];
                        this.lastQualityAdjustTime = now; // reset cooldown whenever we encounter a slow frame so we don't change back to high res too eagerly
                        this.resize();
                    }
                    return;
                }
            }
        }
    }

    async run() {
        let prevState: RenderState | undefined;
        let pickRenderState: RenderState | undefined;
        let prevRenderTime = performance.now();
        let wasCameraMoving = false;
        let idleFrameTime = 0;
        let wasIdle = false;
        const frameIntervals: number[] = [];
        for (; ;) {
            const { renderContext, activeController } = this;
            const renderTime = await RenderContext.nextFrame(renderContext);
            const frameTime = renderTime - prevRenderTime;
            if (this.appState.quit) {
                break;
            }
            this.resize();
            const cameraChanges = activeController.renderStateChanges(this.renderState.camera, renderTime - prevRenderTime);
            if (cameraChanges) {
                this.modifyRenderState(cameraChanges);
            }

            const isIdleFrame = idleFrameTime > 500;
            if (renderContext && !renderContext.isContextLost()) {
                renderContext.poll(); // poll for events, such as async reads and shader linking
                renderContext.isIdleFrame = isIdleFrame;

                if (isIdleFrame) { //increase resolution and detail bias on idleFrame
                    if (!wasIdle) {
                        this.resolutionModifier = Math.min(deviceProfile.renderResolution * 2, 1);
                        this.resize();
                        this.modifyRenderState({ quality: { detail: 1 } });
                        this.currentDetailBias = 1;
                        wasIdle = true;
                        if (pickRenderState) {
                            renderContext.renderPickBuffers();
                            pickRenderState = undefined;
                        }
                    }
                } else {
                    if (wasIdle) {
                        this.resolutionModifier = deviceProfile.renderResolution;
                        this.resolutionTier = 2;
                        wasIdle = false;
                    } else {
                        frameIntervals.push(frameTime);
                        this.dynamicResolutionScaling(frameIntervals);
                    }
                    const activeDetailModifier = 0.5;
                    if (this.renderState.quality.detail != activeDetailModifier) {
                        this.currentDetailBias = activeDetailModifier;
                        this.modifyRenderState({ quality: { detail: activeDetailModifier } });
                    }
                }

                if (this.stateChanges) {
                    this.renderState = modifyRenderStateFromCadSpace(this.renderState, this.stateChanges);
                    this.stateChanges = undefined;
                }
                const { renderState } = this;
                if (prevState !== renderState || renderContext.changed) {
                    prevState = renderState;
                    const statsPromise = renderContext.render(renderState);
                    //stats
                    pickRenderState = renderState;
                }
            }
            if (activeController.changed && isIdleFrame) {
                const controllerState = this.activeController.serialize();
                this.appState.controllerState = JSON.stringify(controllerState);
            }

            if (this.activeController.moving) {
                wasCameraMoving = true;
                idleFrameTime = 0;
            } else if (!wasCameraMoving) {
                idleFrameTime += frameTime;
            }
            wasCameraMoving = this.activeController.moving;
            prevRenderTime = renderTime;
        }
    }

    /** @public */
    modifyRenderState(changes: RenderStateChanges): void {
        this.stateChanges = mergeRecursive(this.stateChanges, changes);
    }
}