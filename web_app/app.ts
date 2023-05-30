
import { type ReadonlyVec3, vec3, quat, vec4 } from "gl-matrix";
import { downloadScene, type RenderState, type RenderStateChanges, type RenderStateClippingPlane, defaultRenderState, initCore3D, mergeRecursive, modifyRenderStateFromCadSpace, RenderContext, type OctreeSceneConfig, type DeviceProfile } from "core3d";
import { ControllerInput, FlightController, OrbitController, OrthoController, PanoramaController, type BaseController } from "./controller";

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

export interface AppState {
    readonly msaa: number,
    readonly quit: boolean,
    controllerState: string
}

export class WebApp implements ViewStateContext {
    readonly scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    readonly alternateUrl = new URL("http://192.168.1.129:9090/").toString();
    public renderContext: RenderContext | undefined;
    public _renderState: RenderState;
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

    get renderState() {
        const { _renderState } = this;

        const flipZY = quat.fromValues(0.7071067811865475, 0, 0, 0.7071067811865476);
        const clippingPlanes: RenderStateClippingPlane[] = [];
        for (const plane of _renderState.clipping.planes) {
            if (plane) {
                const p = plane as RenderStateClippingPlane;
                const { normalOffset } = p;
                if (normalOffset) {
                    clippingPlanes.push({
                        normalOffset: vec4.fromValues(normalOffset[0], -normalOffset[2], normalOffset[1], normalOffset[3]),
                        color: p.color ?? undefined
                    });
                }
            }
        }
        return {
            ..._renderState,
            camera: {
                ..._renderState.camera,
                position: vec3.transformQuat(vec3.create(), _renderState.camera.position, flipZY),
                pivot: _renderState.camera.pivot ? vec3.transformQuat(vec3.create(), _renderState.camera.pivot, flipZY) : undefined,
                rotation: quat.mul(quat.create(), flipZY, _renderState.camera.rotation),
            },
            grid: {
                ..._renderState.grid,
                axisX: vec3.transformQuat(vec3.create(), _renderState.grid.axisX, flipZY),
                axisY: vec3.transformQuat(vec3.create(), _renderState.grid.axisY, flipZY),
                origin: vec3.transformQuat(vec3.create(), _renderState.grid.origin, flipZY)
            },
            clipping: {
                ..._renderState.clipping,
                planes: clippingPlanes
            },
            outlines: {
                ..._renderState.outlines,
                plane: vec4.fromValues(_renderState.outlines.plane[0], -_renderState.outlines.plane[2], _renderState.outlines.plane[1], _renderState.outlines.plane[3])
            }
        };
    }

    constructor(readonly canvas: HTMLCanvasElement, readonly appState: AppState) {
        initCore3D(deviceProfile, canvas, this.setRenderContext);
        this._renderState = defaultRenderState();
        const input = new ControllerInput(canvas);
        this.controllers = {
            flight: new FlightController(this, input),
            orbit: new OrbitController(input),
            ortho: new OrthoController(input),
            panorama: new PanoramaController(input)
        } as const
        this.activeController = this.controllers["flight"];
        this.activeController.attach();
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
        const { output } = this._renderState;
        if (width != output.width || height != output.height) {
            this._renderState = modifyRenderStateFromCadSpace(this._renderState, { output: { width, height } });
            // this.modifyRenderState({ output: { width, height } });
        }
    }

    /**
     * Retrieve list of available background/IBL environments.
     * @public
     * @param indexUrl The absolute or relative url of the index.json file. Relative url will be relative to the novorender api script url. If undefined, "/assets/env/index.json" will be used by default.
     * @returns A promise of a list of environments.
     */
    async availableEnvironments(indexUrl?: string): Promise<EnvironmentDescription[]> {
        let environments: EnvironmentDescription[] = [];
        const url = new URL(indexUrl ?? "/assets/env/index.json", this.scriptUrl);
        const response = await fetch(url.toString());
        if (response.ok) {
            const json = await response.json();
            environments = (json as string[]).map(name => {
                return { name, url: new URL(name, url).toString() + "/", thumnbnailURL: new URL(`thumbnails/${name}.png`, url).toString() } as EnvironmentDescription;
            });
        }
        return environments;
    }

    //* @internal */
    async loadScene(url: string, initPos: ReadonlyVec3 | undefined, centerPos: ReadonlyVec3 | undefined, autoFit = true): Promise<OctreeSceneConfig> {
        const scene = await downloadScene(url);

        const flipYZ = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
        const { config } = scene;
        const flippedConfig = {
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

        let center = initPos ?? flippedConfig.center ?? vec3.create();
        const radius = flippedConfig.boundingSphere.radius ?? 5;
        if (autoFit) {
            this.activeController.autoFit(center, radius);
        }
        const camera = this.activeController.stateChanges();
        center = centerPos ? centerPos : center;
        this.modifyRenderState({
            scene,
            camera,
            grid: { origin: center },
        });
        return flippedConfig;
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
            const cameraChanges = activeController.renderStateChanges(this._renderState.camera, renderTime - prevRenderTime);
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
                    if (this._renderState.quality.detail != activeDetailModifier) {
                        this.currentDetailBias = activeDetailModifier;
                        this.modifyRenderState({ quality: { detail: activeDetailModifier } });
                    }
                }

                if (this.stateChanges) {
                    this._renderState = modifyRenderStateFromCadSpace(this._renderState, this.stateChanges);
                    this.stateChanges = undefined;
                }
                const { _renderState } = this;
                if (prevState !== _renderState || renderContext.changed) {
                    prevState = _renderState;
                    const statsPromise = renderContext.render(_renderState);
                    //stats
                    pickRenderState = _renderState;
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

/** @internal */
export interface ViewStateContext {
    readonly scriptUrl: string;
    readonly renderContext: RenderContext | undefined;
    readonly _renderState: RenderState;
    // readonly clippingPlanes: readonly RenderStateClippingPlane[];
    readonly controllers: { readonly [key: string]: BaseController };
    activeController: BaseController;
    modifyRenderState(changes: RenderStateChanges): void;
    loadScene(sceneId: string | undefined, initPos: ReadonlyVec3 | undefined, centerPos: ReadonlyVec3 | undefined, autoFit: boolean): Promise<OctreeSceneConfig>;
    switchCameraController(kind: string): Promise<void>;
}

/** Background/IBL environment description
  *  @public
  */
export interface EnvironmentDescription {
    /** Display name of environment */
    readonly name: string;

    /** Data URL. */
    readonly url: string;

    /** Thumbnail URL. */
    readonly thumnbnailURL: string;
}
