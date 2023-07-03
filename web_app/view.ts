import { type ReadonlyVec3, vec3, type ReadonlyQuat } from "gl-matrix";
import { downloadScene, type RenderState, type RenderStateChanges, type RenderStateClippingPlane, defaultRenderState, initCore3D, mergeRecursive, RenderContext, type SceneConfig, modifyRenderState, type RenderStatistics, type DeviceProfile } from "core3d";
import { ControllerInput, FlightController, OrbitController, OrthoController, PanoramaController, type BaseController, CadFlightController } from "./controller";
import { flipState } from "./flip";

export abstract class View {
    readonly scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    readonly alternateUrl = new URL("https://blobs.novorender.com/").toString();
    abstract getSasKey(sceneId: string): string | undefined; // sas key, sans "?"
    public renderContext: RenderContext | undefined;
    private _deviceProfile: DeviceProfile;
    private _setDeviceProfile: (value: DeviceProfile) => void;
    protected renderStateGL: RenderState;
    protected renderStateCad: RenderState;
    protected prevRenderStateCad: RenderState | undefined;
    private stateChanges: RenderStateChanges | undefined;

    //* @internal */
    controllers;
    //* @internal */
    activeController: BaseController;
    //* @internal */
    clippingPlanes: RenderStateClippingPlane[] = [];
    private _statistics: { readonly render: RenderStatistics, readonly view: ViewStatistics } | undefined = undefined;

    // dynamic resolution scaling
    private resolutionModifier = 1;
    private drsHighInterval = 50;
    private drsLowInterval = 100;
    private lastQualityAdjustTime = 0;
    private resolutionTier: 0 | 1 | 2 = 2;

    private currentDetailBias: number = 1;

    constructor(readonly canvas: HTMLCanvasElement, deviceProfile: DeviceProfile) {
        this._deviceProfile = deviceProfile;
        this._setDeviceProfile = initCore3D(deviceProfile, canvas, this.setRenderContext);
        this.renderStateGL = defaultRenderState();
        this.renderStateCad = this.createRenderState(this.renderStateGL);

        const input = new ControllerInput(canvas);

        this.controllers = {
            flight: new FlightController(this, input),
            orbit: new OrbitController(input),
            ortho: new OrthoController(input),
            panorama: new PanoramaController(input),
            cad: new CadFlightController(this, input),
        } as const;
        this.activeController = this.controllers["flight"];
        this.activeController.attach();
        this.activeController.updateParams({ proportionalCameraSpeed: { min: 0.2, max: 1000 } }); // TL: why?

        const resizeObserver = new ResizeObserver(() => { this.resize(); });
        resizeObserver.observe(canvas);
    }

    dispose() {
        this.renderContext?.dispose();
        this.renderContext = undefined;
    }

    updateChanges(changes: RenderStateChanges) {
        this.prevRenderStateCad = this.renderStateCad;
        this.renderStateCad = mergeRecursive(this.renderStateCad, changes) as RenderState;
        flipState(changes, "CADToGL");
        this.renderStateGL = modifyRenderState(this.renderStateGL, changes);
    }

    createRenderState(state: RenderState) {
        const clone = structuredClone(state);
        flipState(clone, "GLToCAD");
        return clone;
    }

    get renderState() {
        return this.renderStateCad;
    }

    get prevRenderState() {
        return this.prevRenderStateCad;
    }

    get statistics() {
        return this._statistics;
    }

    // changing device profile will recreate the entire renderContext, so use with caution!
    get deviceProfile() { return this._deviceProfile; }
    set deviceProfile(value: DeviceProfile) {
        this._deviceProfile = value;
        this._setDeviceProfile?.(value); // this will in turn trigger this.useDeviceProfile
    }

    readonly setRenderContext = (context: RenderContext) => {
        this.renderContext = context;
        this.useDeviceProfile(this._deviceProfile);
    }

    private useDeviceProfile(deviceProfile: DeviceProfile) {
        this.resolutionModifier = deviceProfile.renderResolution;
        this.drsHighInterval = (1000 / deviceProfile.framerateTarget) * 1.2;
        this.drsLowInterval = (1000 / deviceProfile.framerateTarget) * 0.9;
    }

    private resize() {
        const scale = devicePixelRatio * this.resolutionModifier;
        // const scale = 1.0;
        let { width, height } = this.canvas.getBoundingClientRect();
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const { output } = this.renderStateGL;
        if (width != output.width || height != output.height) {
            this.updateChanges({ output: { width, height } });
        }
    }

    /**
     * Retrieve list of available background/IBL environments.
     * @public
     * @param indexUrl
     * The absolute or relative url of the index.json file.
     * Relative url will be relative to the novorender api script url.
     * If undefined, "/assets/env/index.json" will be used by default.
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

    /**
     * Load a scene from a url.
    * @public
    * @param url The absolute url to the folder containing the scene.
    * @remarks
    * The url typically contains the scene id as the latter part of the path, i.e. `https://.../<scene_guid>/`.
    */
    async loadSceneFromURL(url: URL): Promise<SceneConfig> {
        const scene = await downloadScene(url.toString());
        const stateChanges = { scene };
        flipState(stateChanges, "GLToCAD");
        this.modifyRenderState(stateChanges);
        return scene.config;
    }

    async pick(x: number, y: number, sampleDiscRadius = 0) {
        const context = this.renderContext;
        if (context) {
            const samples = await context.pick(x, y, sampleDiscRadius);
            if (samples.length) {
                const centerSample = samples.reduce((a, b) => a.depth < b.depth ? a : b);
                const flippedSample = {
                    ...centerSample,
                    position: vec3.fromValues(centerSample.position[0], -centerSample.position[2], centerSample.position[1]),
                    normal: vec3.fromValues(centerSample.normal[0], -centerSample.normal[2], centerSample.normal[1])
                }
                return flippedSample;
            }
        }
        return undefined;
    }

    async switchCameraController(kind: string, initState?: { position?: ReadonlyVec3, rotation?: ReadonlyQuat, fov?: number }) {
        function isControllerKind(kind: string, controllers: Object): kind is keyof View["controllers"] {
            return kind in controllers;
        }
        if (!isControllerKind(kind, this.controllers))
            throw new Error(`Unknown controller kind: ${kind}!`);

        const { controllers, renderContext } = this;
        let { activeController } = this;

        // find minimum renderered distance
        let distance: number | undefined;
        if (renderContext && renderContext.prevState) {
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

        activeController.init({ kind, position: initState?.position ?? position, rotation: initState?.rotation ?? rotation, pivot, distance, fovDegrees, fovMeters: initState?.fov ?? fovMeters });
        const changes = activeController.stateChanges();
        this.modifyRenderState({ camera: changes });
    }

    /** @internal */
    dynamicResolutionScaling(frameIntervals: number[]) {
        const samples = 9;
        if (frameIntervals.length == samples) {
            const { deviceProfile } = this;
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

    // called before render state changes are applied, i.e. you can still call modifyRenderState() here.
    animate?(time: number): void;

    // called after all render state changes has been applied, i.e. this is a good time to do custom rendering, e.g. 2D content such as text and lines etc.
    render?(isIdleFrame: boolean): void;

    async run() {
        let prevState: RenderState | undefined;
        let pickRenderState: RenderState | undefined;
        let prevRenderTime = performance.now();
        let wasCameraMoving = false;
        let idleFrameTime = 0;
        let wasIdle = false;
        const frameIntervals: number[] = [];
        for (; ;) {
            const { renderContext, activeController, deviceProfile } = this;
            const renderTime = await RenderContext.nextFrame(renderContext);
            const frameTime = renderTime - prevRenderTime;
            this.resize();
            const cameraChanges = activeController.renderStateChanges(this.renderStateCad.camera, renderTime - prevRenderTime);
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
                    if (this.renderStateGL.quality.detail != activeDetailModifier) {
                        this.currentDetailBias = activeDetailModifier;
                        this.modifyRenderState({ quality: { detail: activeDetailModifier } });
                    }
                }

                this.animate?.(renderTime);

                if (this.stateChanges) {
                    this.updateChanges(this.stateChanges);
                    this.stateChanges = undefined;
                }

                const { renderStateGL } = this;
                if (prevState !== renderStateGL || renderContext.changed) {
                    prevState = renderStateGL;
                    this.render?.(isIdleFrame);
                    const statsPromise = renderContext.render(renderStateGL);
                    statsPromise.then((stats) => {
                        this._statistics = { render: stats, view: { resolution: this.resolutionModifier, detailBias: deviceProfile.detailBias * this.currentDetailBias, fps: stats.frameInterval ? 1000 / stats.frameInterval : undefined } };
                    });
                    pickRenderState = renderStateGL;
                }
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

export interface AppState {
    readonly msaa: number,
    readonly quit: boolean,
    controllerState: string
}

export interface ViewStatistics {
    readonly resolution: number,
    readonly detailBias: number,
    readonly fps?: number,
}

