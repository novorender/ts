import { type ReadonlyVec3, vec3, vec2, type ReadonlyQuat, mat3, type ReadonlyVec2, type ReadonlyVec4, glMatrix, vec4, mat4 } from "gl-matrix";
import { downloadScene, type RenderState, type RenderStateChanges, defaultRenderState, initCore3D, mergeRecursive, RenderContext, type SceneConfig, modifyRenderState, type RenderStatistics, type DeviceProfile, type PickSample, type PickOptions, CoordSpace, type Core3DImports, type RenderStateCamera, validateRenderState, type Core3DImportMap, downloadCore3dImports } from "core3d";
import { builtinControllers, ControllerInput, type BaseController, type PickContext, type BuiltinCameraControllerType } from "./controller";
import { flipState } from "./flip";
import { MeasureView, createMeasureView, type MeasureEntity, downloadMeasureImports, type MeasureImportMap, type MeasureImports } from "measure";
import { inspectDeviations, type DeviationInspectionSettings, type DeviationInspections, type OutlineIntersection, outlineLaser } from "./buffer_inspect";
import { downloadOfflineImports, manageOfflineStorage, type OfflineImportMap, type OfflineImports, type OfflineViewState, type SceneIndex } from "offline"
import { loadSceneDataOffline, type DataContext } from "data";
import * as DataAPI from "data/api";
import { OfflineFileNotFoundError, hasOfflineDir, requestOfflineFile } from "offline/file";

/**
 * A view base class for Novorender content.
 * @template CameraControllerType Types of camera controllers used by this view.
 * @template CameraControllerKind The inferred camera controller kind string union.
 * @remarks
 * The view class wraps the complexities of the `Core3D` module into a high-level abstraction.
 * Notably, it implements a render loop in the {@link run} function, which deals with a number of issues, such as:
 * - Camera controllers.
 * - Rendering after {@link modifyRenderState | state changes}, saving energy and battery life.
 * - Adjust to resizing of canvas element.
 * - Managing idle vs active rendering, i.e. lower fidelity rendering while the camera is moving for better frame rates.
 * - Adaptive performance adjustment to maintain a target frame rate target.
 * - Post effects.
 * 
 * In the likely event that you want to change or extend some of the default behaviour,
 * you should make a derived View class of your own and override the methods you need.
 * @category Render View
 */
export class View<
    CameraControllerTypes extends CameraControllers = BuiltinCameraControllerType,
    CameraControllerKind extends string = Extract<keyof CameraControllerTypes, string>
> implements Disposable {
    /** Available camera controller types. */
    controllers: CameraControllerTypes;

    private _renderContext: RenderContext | undefined;
    private _run = true;
    private _deviceProfile: DeviceProfile;
    private _setDeviceProfile: (value: DeviceProfile) => void;
    private _stateChanges: RenderStateChanges | undefined;
    private _activeController: BaseController;
    private _statistics: { readonly render: RenderStatistics, readonly view: ViewStatistics } | undefined = undefined;
    private _measureView: MeasureView | undefined;
    private _dataContext: DataContext | undefined;
    private _offline: OfflineContext | undefined;
    private _drawContext2d: {
        width: number,
        height: number,
        camera: RenderStateCamera
    };
    private readonly _resizeObserver: ResizeObserver;

    /** @internal */
    protected renderStateGL: RenderState;
    /** @internal */
    protected renderStateCad: RenderState;
    /** @internal */
    protected prevRenderStateCad: RenderState | undefined;

    // dynamic resolution scaling
    private resolutionModifier = 1;
    private baseRenderResolution = 1;
    private drsHighInterval = 50;
    private drsLowInterval = 100;
    private lastDrsAdjustTime = 0;
    private resolutionTier: 0 | 1 | 2 = 2;

    private currentDetailBias: number = 1;

    /**
     * @param canvas The HtmlCanvasElement used for rendering.
     * @param deviceProfile The device profile describing the host device's GPU performance characteristics and limitations.
     * @param imports Imported, non-javascript resources.
     * @remarks
     * Your browser must run in a {@link https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts | secure}
     * and {@link https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts | cross-origin isolated } context.
     */
    public constructor(
        /** The HTMLCanvasElement used for rendering. */
        readonly canvas: HTMLCanvasElement,
        deviceProfile: DeviceProfile, readonly imports: Core3DImports & MeasureImports & OfflineImports,
        controllersFactory: CameraControllersFactory<CameraControllerTypes> = (builtinControllers as unknown as CameraControllersFactory<CameraControllerTypes>)
    ) {
        if (!isSecureContext)
            throw new Error("Your browser is not running in an secure context!"); // see constructor tsdoc comments for more details
        if (!crossOriginIsolated)
            throw new Error("Your browser is not running in an cross-origin isolated context!"); // see constructor tsdoc comments for more details

        this._deviceProfile = deviceProfile;
        this._setDeviceProfile = initCore3D(deviceProfile, canvas, imports, this.setRenderContext);
        this.renderStateGL = defaultRenderState();
        this.renderStateCad = this.createRenderState(this.renderStateGL);
        this._drawContext2d = {
            camera: this.renderState.camera,
            width: 0,
            height: 0
        }

        const input = new ControllerInput(canvas);
        this.controllers = controllersFactory(input, this);
        this._activeController = Object.values(this.controllers)[0];
        this._activeController.attach();

        const resizeObserver = this._resizeObserver = new ResizeObserver(() => {
            this.recalcBaseRenderResolution();
        });
        resizeObserver.observe(canvas);
    }

    /** Dispose of the view's GPU resources. */
    [Symbol.dispose]() {
        this.dispose();
    }

    /** Dispose of the view's GPU resources. */
    dispose() {
        this._resizeObserver.disconnect();
        this._renderContext?.dispose();
        this._renderContext = undefined;
    }

    /** Get static data API functions that are independent of scene. */
    static get data(): typeof DataAPI {
        return DataAPI;
    }

    /**
     * Get the current measure view, or undefined if no scene has been loaded or has no measurement data.
     * @see {@link loadSceneFromURL}.
     */
    get measure(): MeasureView | undefined {
        return this._measureView;
    }

    /**
     * Get the current data context, or undefined if no scene has been loaded or has no meta data.
     * @see {@link loadSceneFromURL}.
     */
    get data(): DataContext | undefined {
        return this._dataContext;
    }

    /**
     * Get the current offline context, or undefined if no scene has been loaded.
     * @see {@link loadSceneFromURL}.
     */
    get offline(): OfflineContext | undefined {
        return this._offline;
    }

    // The active camera controller.
    get activeController(): BaseController {
        return this._activeController;
    }

    // The current render context.
    get renderContext(): RenderContext | undefined {
        return this._renderContext;
    }

    // The current render state.
    get renderState() {
        return this.renderStateCad;
    }

    // The render state from the previous frame, if any.
    get prevRenderState() {
        return this.prevRenderStateCad;
    }

    // The render statistics from the previous frame, if any.
    get statistics() {
        return this._statistics;
    }

    /**
     * The current device profile.
     * @remarks
     * Setting a new device profile will force a recreation of the entire render context and should generally be avoided.
     * Valid cases for doing so might be users manually overriding the GPU profile of their device, or for testing/diagnostics purposes.
     */
    get deviceProfile() { return this._deviceProfile; }
    set deviceProfile(value: DeviceProfile) {
        this._deviceProfile = value;
        this._setDeviceProfile?.(value); // this will in turn trigger this.useDeviceProfile
    }

    /**
     * Manage offline storage.
     * @returns An offline view state context used for offline storage management UI.
     */
    async manageOfflineStorage() {
        return await manageOfflineStorage(this.imports.ioWorker);
    }

    /** Determine if camera is looking straight down. */
    isTopDown() {
        const { _stateChanges, renderState } = this;
        const rot = (_stateChanges?.camera?.rotation ?? renderState.camera.rotation) as ReadonlyQuat;
        const mat = mat3.fromQuat(mat3.create(), rot);
        return Math.abs(mat[8]) > 0.98;
    }

    /**
     * Convert 2D pixel position to 3D position.
     * @param x Pixel x coordinate, in CSS pixels.
     * @param y Pixel y coordinate, in CSS pixels.
     * @returns Corresponding 3D position at the view plane in world space, or undefined if there is no active render context.
     */
    worldPositionFromPixelPosition(x: number, y: number) {
        const { _renderContext, canvas } = this;
        const { width, height } = this.renderState.output;
        if (_renderContext) {
            const rect = canvas.getBoundingClientRect(); // dim in css pixels
            const cssWidth = rect.width;
            const cssHeight = rect.height;
            const px = Math.min(Math.max(0, Math.round(x / cssWidth * width)), width);
            const py = Math.min(Math.max(0, Math.round((1 - (y + 0.5) / cssHeight) * height)), height);
            const xCS = ((px + 0.5) / width) * 2 - 1;
            const yCS = ((py + 0.5) / height) * 2 - 1;
            const viewClipMatrix = _renderContext["viewClipMatrix"];
            const viewWorldMatrix = _renderContext["viewWorldMatrix"];
            const posVS = vec3.fromValues((xCS / viewClipMatrix[0]), (yCS / viewClipMatrix[5]), 0);
            const pos = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrix);
            return vec3.fromValues(pos[0], -pos[2], pos[1]);
        }
    }

    /**
     * Retrieve list of available background/IBL environments.
     * @public
     * @param indexUrl
     * The absolute url of the index.json file.
     * @returns A promise of a list of environments.
     */
    static async availableEnvironments(indexUrl: URL): Promise<EnvironmentDescription[]> {
        let environments: EnvironmentDescription[] = [];
        const response = await fetch(indexUrl.toString(), { mode: "cors" });
        if (response.ok) {
            const json = await response.json();
            environments = (json as string[]).map(name => {
                return { name, url: new URL(name, indexUrl).toString() + "/", thumnbnailURL: new URL(`thumbnails/${name}.png`, indexUrl).toString() } as EnvironmentDescription;
            });
        }
        return environments;
    }

    /** @deprecated Use static {@link View.availableEnvironments} instead. */
    async availableEnvironments(indexUrl: URL): Promise<EnvironmentDescription[]> {
        return View.availableEnvironments(indexUrl);
    }

    /**
     * Retrieve list of network requests for given environment(s) for cache/offline purposes.
     * @param environments The environment description objects.
     * @remarks
     * The returned requests are suitable for [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll).
     */
    static environmentRequests(...environments: EnvironmentDescription[]): readonly Request[] {
        const urls: URL[] = [];
        for (const environment of environments) {
            const { url, thumnbnailURL } = environment;
            urls.push(new URL("radiance.ktx", url));
            urls.push(new URL("irradiance.ktx", url));
            urls.push(new URL("background.ktx", url));
            urls.push(new URL(thumnbnailURL));
        }
        return urls.map(url => (new Request(url, { mode: "cors" })));
    }

    /**
     * Load a scene.
    * @public
    * @param baseUrl The absolute base url to the folder containing the scenes with optional sas-key, e.g. `https://blobs.novorender.com/?sv=...`.
    * @param sceneId The scene id/guid.
    * @param version The hash of the desired scene version.
    * @param abortSignal Optional abort controller.
    * @remarks
    * The url typically contains the scene id as the latter part of the path, i.e. `https://.../<scene_guid>/`.
    */
    async loadScene(baseUrl: URL, sceneId: string, version: string, abortSignal?: AbortSignal): Promise<SceneConfig> {
        const baseSceneUrl = new URL(baseUrl);
        baseSceneUrl.pathname += `${sceneId}/`;
        function relativeUrl(path: string) {
            const url = new URL(baseSceneUrl);
            url.pathname += path; // preserve sas key
            return url;
        }
        async function getFile(path: string): Promise<Response> {
            const request = new Request(relativeUrl(path), { mode: "cors", signal: abortSignal });
            let response: Response | undefined;
            let err: unknown | undefined;
            try {
                response = await fetch(request);
            }
            catch (error) {
                err = error;
                //Try offline
            }
            if (response == undefined || !response.ok) {
                const offlineResponse = await requestOfflineFile(request);
                if (offlineResponse) {
                    response = offlineResponse;
                }
            }
            if (response == undefined || !response.ok) {
                if (response) {
                    throw new Error(response.statusText);
                }
                else if (err) {
                    throw err;
                }
                else {
                    throw new Error("Failed to load scene");
                }
            }
            return response;
        }

        try {
            const indexResponse = await getFile(version);
            const index = await indexResponse.json() as SceneIndex;
            // TODO: assign index to public member?
            const { render, measure, data, offline } = index;


            const scene = await downloadScene(baseSceneUrl, render.webgl2, abortSignal);
            const stateChanges = { scene };
            flipState(stateChanges, "GLToCAD");
            this.modifyRenderState(stateChanges);

            if (measure) {
                const measureView = await createMeasureView(this._drawContext2d, this.imports);
                await measureView.loadScene(baseSceneUrl, measure.brepLut); // TODO: include abort signal!
                this._measureView = measureView;
            }

            try {
                if (data) {
                    const dataContext = await loadSceneDataOffline(sceneId, data.jsonLut, data.json); // TODO: Add online variant
                    this._dataContext = dataContext;
                }
            } catch (error) {
                const offlineSetupError = error instanceof OfflineFileNotFoundError;
                //Only means that offline data is not downloaded
                if (!offlineSetupError) {
                    throw error;
                }
            }

            if (offline) {
                this._offline = {
                    manifestUrl: relativeUrl(offline.manifest),
                    isEnabled: async () => {
                        return await hasOfflineDir(sceneId);
                    },
                }
            }
            return stateChanges.scene.config;

        }
        catch (error) { //Legacy load
            const scene = await downloadScene(baseSceneUrl, "webgl2_bin/scene.json", abortSignal);
            const stateChanges = { scene };
            flipState(stateChanges, "GLToCAD");
            this.modifyRenderState(stateChanges);

            const measureView = await createMeasureView(this._drawContext2d, this.imports);
            await measureView.loadScene(baseSceneUrl, "brep/");
            this._measureView = measureView;
            return stateChanges.scene.config;
        }
    }


    /**
     * Inspect the deviations that is on screen
     * @public
     * @param settings Deviation settings, 
     * @returns Spaced out lables prioritizing the smallest or highest deviation values based on settings. 
     * Also returns a line trough the points if it is able to project the points on a line and the option is given.
     */
    async inspectDeviations(settings: DeviationInspectionSettings): Promise<DeviationInspections | undefined> {
        const context = this._renderContext;
        if (context) {
            const scale = devicePixelRatio * this.resolutionModifier;
            return inspectDeviations(await context.getDeviations(), scale, settings);
        }
    }

    /**
     * Create a list of intersections between the x and y axis through the tracer position
     * @public
     * @param laserPosition position where to calculate intersections,  
     * @param perspective For tracer to work in perspective the 3d tracer position and plane to intersect is required,  
     * @returns list of intersections (right, left, up ,down) 
     * results will be ordered from  closest to furthest from the tracer poitn
     */
    async outlineLaser(laserPosition: ReadonlyVec2, perspective?: { laserPosition3d: ReadonlyVec3, plane: ReadonlyVec4 }): Promise<OutlineIntersection | undefined> {
        const context = this._renderContext;
        const measure = this._measureView;
        if (context && measure) {
            const scale = devicePixelRatio * this.resolutionModifier;
            if (perspective) {
                const { laserPosition3d, plane } = perspective;
                const dir = vec3.fromValues(plane[0], plane[1], plane[2]);
                const u = glMatrix.equals(Math.abs(vec3.dot(vec3.fromValues(0, 0, 1), dir)), 1)
                    ? vec3.fromValues(0, 1, 0)
                    : vec3.fromValues(0, 0, 1);
                const r = vec3.cross(vec3.create(), u, dir);
                vec3.cross(u, dir, r);
                vec3.normalize(u, u);

                vec3.cross(r, u, dir);
                vec3.normalize(r, r);

                const pts = await measure.draw.toMarkerPoints([vec3.add(vec3.create(), laserPosition3d, r), vec3.add(vec3.create(), laserPosition3d, u)])
                if (pts[0] == undefined || pts[1] == undefined) {
                    return undefined;
                }
                const left = vec2.sub(vec2.create(), laserPosition, pts[0]);
                vec2.normalize(left, left);
                const right = vec2.fromValues(-left[0], -left[1]);
                const up = vec2.sub(vec2.create(), laserPosition, pts[1]);
                vec2.normalize(up, up);
                const down = vec2.fromValues(-up[0], -up[1]);
                return outlineLaser(await context.getOutlines(), laserPosition, scale,
                    { left, right, down, up, tracerPosition3d: vec3.fromValues(laserPosition3d[0], laserPosition3d[2], -laserPosition3d[1]) });

            }
            return outlineLaser(await context.getOutlines(), laserPosition, scale);
        }
    }

    /**
     * Get all object ids currently on screen
     * @public
     * @returns returns a set of all object ids on the screen 
     */
    async getOutlineObjectsOnScreen() {
        const context = this._renderContext;
        if (context) {
            context.renderPickBuffers();
            const pick = (await context.buffers.pickBuffers()).pick;
            return context.getOutlineObjects(pick);
        }
    }

    /**
     * Query parametric measure entity for the given coordinates
     * @param x Center x coordinate in css pixels.
     * @param y Center y coordinate in css pixels.
     * @param options Extra options.
     * @returns Parametric measure entity, if non exists in the current location, the poisiton will be retuned.
     */
    async pickMeasureEntity(x: number, y: number, options?: PickOptions): Promise<MeasureEntity | undefined> {
        const measure = this._measureView;
        const sample = await this.pick(x, y, options);
        if (sample && measure) {
            return (await measure.core.pickMeasureEntity(sample.objectId, sample.position)).entity;
        }
    }

    /**
     * Query object and geometry information for given view coordinate.
     * @param x Center x coordinate in css pixels.
     * @param y Center y coordinate in css pixels.
     * @param options Extra options.
     * @returns The sample within the sample disc that is closest to the camera, if any.
     */
    async pick(x: number, y: number, options?: PickOptions): Promise<PickSampleExt | undefined> {
        const context = this._renderContext;
        if (context) {
            const samples = await context.pick(x, y, options);
            if (samples.length) {
                let sampleType: "edge" | "corner" | "surface" = "surface";
                const edgeNormal1 = vec3.create();
                const edgeNormal2 = vec3.create();

                const edgeThreshold = 0.8; // the cos() value of the edge angle threshold.
                // select the sample that is closest to the camera.
                const centerSample = samples.reduce((a, b) => {
                    if (sampleType == "surface" && vec3.dot(a.normal, b.normal) < edgeThreshold) {
                        vec3.copy(edgeNormal1, a.normal);
                        vec3.copy(edgeNormal2, b.normal);
                        sampleType = "edge";
                    }
                    if (options?.pickOutline === true) {
                        if (b.clippingOutline == false) {
                            return a;
                        }
                    }
                    return a.depth < b.depth ? a : b
                });
                if (sampleType as any == "edge") {
                    samples.forEach(v => {
                        if (vec3.dot(v.normal, edgeNormal1) < edgeThreshold && vec3.dot(v.normal, edgeNormal2) < edgeThreshold) {
                            sampleType = "corner";
                        }
                    });
                }
                if (options?.pickOutline === true && centerSample.clippingOutline == false) {
                    return undefined;
                }
                const worldViewMatrixNormal = context.prevState?.matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View) ?? mat3.create();
                const flippedSample: PickSampleExt = {
                    ...centerSample,
                    position: vec3.fromValues(centerSample.position[0], -centerSample.position[2], centerSample.position[1]),
                    normal: vec3.fromValues(centerSample.normal[0], -centerSample.normal[2], centerSample.normal[1]),
                    sampleType,
                    normalVS: vec3.transformMat3(vec3.create(), centerSample.normal, worldViewMatrixNormal),
                    deviation: this.deviceProfile.quirks.adreno600 ? undefined : centerSample.deviation
                }
                return flippedSample;
            }
        }
    }

    /**
     * Switch to a new kind of camera controller.
     * @param kind The type of camera controller to switch to.
     * @param initialState Optional initial state for the new camera controller. Undefined properties will be copied/adapted from the current render state.
     * @param options Switch options.
     * @template T Kind of camera controller.
     * @returns The new camera controller.
     * @remarks
     * The function will also set the {@link RenderStateCamera.kind | camera projection model}.
     */
    async switchCameraController<T extends CameraControllerKind>(
        kind: T,
        initialState?: CameraControllerInitialValues,
        options?: CameraControllerOptions
    ): Promise<CameraControllerTypes[T]> {
        const autoInit = options?.autoInit ?? false;
        function isControllerKind(kind: string, controllers: Object): kind is CameraControllerKind {
            return kind in controllers;
        }
        if (!isControllerKind(kind, this.controllers))
            throw new Error(`Unknown controller kind: ${kind}!`);

        const { controllers, _renderContext } = this;
        let { _activeController } = this;

        // find minimum renderered distance
        let distance: number | undefined;
        if (autoInit && _renderContext && _renderContext.prevState) {
            _renderContext.renderPickBuffers();
            const pick = (await _renderContext.buffers.pickBuffers()).pick;
            const depths = _renderContext.getLinearDepths(pick);
            distance = Number.MAX_VALUE;
            for (const depth of depths) {
                distance = Math.min(distance, depth);
            }
        }

        // transfer what state we can from previous controller
        const prevState = _activeController.serialize(true /* include derived properties as well */);
        const controller = controllers[kind];
        _activeController = this._activeController = controller;
        const { position, rotation, pivot, fovMeters } = prevState;
        _activeController.init({ kind, position: initialState?.position ?? position, rotation: initialState?.rotation ?? rotation, pivot, distance, fovMeters: initialState?.fov ?? (kind != "panorama" ? fovMeters : undefined) });
        const changes = _activeController.stateChanges();
        this.modifyRenderState({ camera: changes });
        return controller;
    }

    /**
     * Start the main render loop for the view.
     * @param abortSignal Signal to abort any pending downloads and exit render loop.
     * @remarks
     * This method will not exit until you signal the abortSignal.
     */
    async run(abortSignal?: AbortSignal) {
        let prevState: RenderState | undefined;
        let prevRenderTime = performance.now();
        let wasCameraMoving = false;
        let idleFrameTime = 0;
        let wasIdle = false;
        const frameIntervals: number[] = [];
        let possibleChanges = false;
        while (this._run && !(abortSignal?.aborted ?? false)) {
            const { _renderContext, _activeController, deviceProfile } = this;
            const renderTime = await RenderContext.nextFrame(_renderContext);
            const frameTime = renderTime - prevRenderTime;
            const cameraChanges = _activeController.renderStateChanges(this.renderStateCad.camera, renderTime - prevRenderTime);
            if (cameraChanges) {
                this.modifyRenderState(cameraChanges);
            }

            const isIdleFrame = idleFrameTime > 500 && !this._activeController.moving;
            if (_renderContext && !_renderContext.isContextLost()) {
                _renderContext.poll(); // poll for events, such as async reads and shader linking

                if (isIdleFrame) { // increase resolution and detail bias on idle frame
                    if (deviceProfile.tier > 0 && this.renderState.toonOutline.on == false) {
                        // enable toonOutline when on idle frame
                        this.modifyRenderState({ toonOutline: { on: true } });
                    }
                    if (deviceProfile.tier > 0 && this.renderState.outlines.on == false) {
                        // enable outline when on idle frame.
                        this.modifyRenderState({ outlines: { on: true } });
                    }
                    if (!wasIdle) {
                        // set max quality and resolution when the camera stops moving
                        this.resolutionModifier = Math.min(1, this.baseRenderResolution * 2);
                        this.resize();
                        this.modifyRenderState({ quality: { detail: 1 } });
                        this.currentDetailBias = 1;
                        wasIdle = true;
                        // if pick is not already rendered then start to make the pick buffer available when the camera stops
                    }
                } else {
                    if (wasIdle) {
                        // reset back to default when camera starts moving
                        this.resolutionModifier = this.baseRenderResolution;
                        this.resolutionTier = 2;
                        // disable features when moving to increase performance - outlines are only disabled in pinhole
                        this.modifyRenderState({ toonOutline: { on: false }, outlines: { on: this.renderState.camera.kind == "orthographic" } });
                        wasIdle = false;
                    } else {
                        frameIntervals.push(frameTime);
                        this.dynamicQualityAdjustment(frameIntervals);
                    }
                    const activeDetailModifier = 0.5;
                    if (this.renderStateGL.quality.detail != activeDetailModifier) {
                        this.currentDetailBias = activeDetailModifier;
                        this.modifyRenderState({ quality: { detail: activeDetailModifier } });
                    }
                }

                this.animate?.(renderTime);

                if (this._stateChanges) {
                    this.applyChanges(this._stateChanges);
                    this._stateChanges = undefined;
                }

                const { renderStateGL } = this;
                if (prevState !== renderStateGL || _renderContext.changed) {
                    prevState = renderStateGL;
                    const statsPromise = _renderContext.render(renderStateGL);
                    statsPromise.then((stats) => {
                        this._statistics = { render: stats, view: { resolution: this.resolutionModifier, detailBias: deviceProfile.detailBias * this.currentDetailBias, fps: stats.frameInterval ? 1000 / stats.frameInterval : undefined } };
                        this.render?.(isIdleFrame);
                        possibleChanges = true;
                    });
                } else if (possibleChanges) {
                    this.render?.(isIdleFrame);
                    if (isIdleFrame) {
                        // render pick buffer if there is nothing else to render and camera is not moving
                        // make it feel better for slower devices when picking idle frame
                        _renderContext.renderPickBuffers();
                    }
                }
            }

            if (this._activeController.moving) {
                wasCameraMoving = true;
                idleFrameTime = 0;
            } else if (!wasCameraMoving) {
                idleFrameTime += frameTime;
            }
            wasCameraMoving = this._activeController.moving;
            prevRenderTime = renderTime;
        }
    }

    /** Signal the render loop to exit.
     * @see {@link run}.
     * @deprecated Use {@link run} `abortSignal` instead.
     */
    exit() {
        this._run = false;
    }

    /** Accumulate render state changes.
     * @param changes The changes to apply to the current view render state.
     * @remarks
     * These changes will be applied and a single call to the {@link modifyRenderState} function just prior to rendering each frame.
     */
    modifyRenderState(changes: RenderStateChanges): void {
        this._stateChanges = mergeRecursive(this._stateChanges, changes);
    }

    /**
     * Validate render state changes made since last rendered frame.
     * @param changes The render state changes to validate, or undefined to validate changes applied via {@link View.modifyRenderState} since last rendered frame.
     * @returns An array of validation errors, if any.
     * @see {@link View.modifyRenderState}
     * @remarks
     * Validation is useful for catching potential bugs and problems early.
     * It should not be performed in production code, however, since it is non-trivial in terms of performance, particularly on large sets of dynamic objects.
     */
    validateRenderState(changes?: RenderStateChanges): readonly Error[] {
        changes ??= this._stateChanges;
        const changesCopy = { ...changes };
        flipState(changesCopy, "CADToGL"); // we assume this will only mutate root properties.
        const newState = mergeRecursive(this.renderStateGL, changesCopy) as RenderState;
        return validateRenderState(newState, changesCopy);
    }

    /**
     * Override this in a derived class to modify render state just prior to rendering.
     * @param time The frame render timestamp in millisecond.
     * @virtual
     */
    animate?(time: number): void;

    /**
     * Override this in a derived class to handle render state validation.
     * @param newState The new render state about to be rendered
     * @param changes The changes that went into the new render state.
     * @virtual
     */
    validate?(newState: RenderState, changes: RenderStateChanges): void;

    /**
     * Override this in a derived class for custom rendering of e.g. 2D content, such as text and lines etc.
     * @param isIdleFrame Was the camera moving or not.
     * @virtual
     */
    render?(isIdleFrame: boolean): void;

    /** 
     * Callback function to update render context.
     * @param context A new render context.
     * @remarks
     * A new render context may be set each time the underlying webgl context is lost and restored,
     * or when certain state changes are made that forces a recreation of the context, such as setting a new {@link deviceProfile}.
     * @virtual
     */
    protected readonly setRenderContext = (context: RenderContext) => {
        this._renderContext = context;
        this.useDeviceProfile(this._deviceProfile);
    }

    private useDeviceProfile(deviceProfile: DeviceProfile) {
        this.resolutionModifier = deviceProfile.renderResolution;
        this.baseRenderResolution = deviceProfile.renderResolution;
        this.recalcBaseRenderResolution();
        this.drsHighInterval = (1000 / deviceProfile.framerateTarget) * 1.2;
        this.drsLowInterval = (1000 / deviceProfile.framerateTarget) * 0.9;
    }

    private resize() {
        const scale = devicePixelRatio * this.resolutionModifier;
        // const scale = 1.0;
        let { width, height } = this.canvas.getBoundingClientRect();
        this._drawContext2d.width = width;
        this._drawContext2d.height = height;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const { output } = this.renderStateGL;
        if (width != output.width || height != output.height) {
            this.applyChanges({ output: { width, height } });
        }
    }

    private recalcBaseRenderResolution() {
        const { deviceProfile } = this;
        if (deviceProfile.tier < 2) {
            const maxRes = deviceProfile.tier == 0 ? 720 * 1280 : 1440 * 2560;
            let baseRenderResolution = deviceProfile.renderResolution / devicePixelRatio;
            const { width, height } = this.canvas.getBoundingClientRect();
            let idleRes = baseRenderResolution * 2 * width * height;
            if (idleRes > maxRes) {
                baseRenderResolution *= maxRes / idleRes;
            }
            this.baseRenderResolution = baseRenderResolution;
            this.resolutionModifier = baseRenderResolution;
        }
        this.resize();
    }

    private applyChanges(changes: RenderStateChanges) {
        this.prevRenderStateCad = this.renderStateCad;
        this.renderStateCad = mergeRecursive(this.renderStateCad, changes) as RenderState;
        this._drawContext2d.camera = this.renderStateCad.camera;
        flipState(changes, "CADToGL");
        this.renderStateGL = modifyRenderState(this.renderStateGL, changes);
        this.validate?.(this.renderStateGL, changes);
    }

    private createRenderState(state: RenderState) {
        const clone = structuredClone(state);
        flipState(clone, "GLToCAD");
        return clone;
    }


    //Dynamically change the quality of rendering based on the last 9 frames 
    private dynamicQualityAdjustment(frameIntervals: number[]) {
        const samples = 9;
        if (frameIntervals.length == samples) {
            const sortedIntervals = [...frameIntervals];
            sortedIntervals.sort();
            const medianInterval = sortedIntervals[Math.floor(samples / 2)];
            frameIntervals.splice(0, 1);
            const cooldown = 3000;
            const now = performance.now();
            //To handle dynamic on and off clipping outline based on framerate.
            if (now > this.lastDrsAdjustTime + cooldown) { // add a cooldown period before changing anything
                this.dynamicResolutionScaling(medianInterval, now);
            }
        }
    }

    private dynamicResolutionScaling(medianInterval: number, now: number) {
        const highFrameInterval = this.drsHighInterval;
        const lowFrameInterval = this.drsLowInterval;

        const resolutionTiers = [0.4, 0.6, 1];
        if (medianInterval > highFrameInterval) {
            if (this.resolutionTier != 0) {
                this.resolutionModifier = this.baseRenderResolution * resolutionTiers[--this.resolutionTier];
                this.resize();
            }
            this.lastDrsAdjustTime = now; // reset cooldown whenever we encounter a slow frame so we don't change back to high res too eagerly
            return;
        } else if (medianInterval < lowFrameInterval) {
            if (this.resolutionTier != 2) {
                this.resolutionModifier = this.baseRenderResolution * resolutionTiers[++this.resolutionTier];
                this.lastDrsAdjustTime = now; // reset cooldown whenever we encounter a slow frame so we don't change back to high res too eagerly
                this.resize();
            }
            return;
        }
    }

    static async downloadImports(map: ViewImportmap): Promise<ViewImports> {
        const core3dPromise = downloadCore3dImports(map);
        const measurePromise = downloadMeasureImports(map);
        const offlinePromise = downloadOfflineImports(map);
        const [core3d, measure, offline] = await Promise.all([core3dPromise, measurePromise, offlinePromise]);
        return {
            ...core3d,
            ...measure,
            ...offline,
        }
    }
}

/** Background/IBL environment description
 * @category Render View
 */
export interface EnvironmentDescription {
    /** Display name of environment */
    readonly name: string;

    /** Data URL. */
    readonly url: string;

    /** Thumbnail URL. */
    readonly thumnbnailURL: string;
}

/** View related render statistics.
 * @category Render View
 */
export interface ViewStatistics {
    /** Effective resolution factor. */
    readonly resolution: number,

    /** Effective detail bias factor. */
    readonly detailBias: number,

    /** Effective frames per second, if available. */
    readonly fps?: number,
}

/** Extended pick sample information.
 * @category Render View
 */
export interface PickSampleExt extends PickSample {
    /** Sample normal, in view space. */
    readonly normalVS: ReadonlyVec3;

    /** Whether sample lies on an edge, corner or surface. */
    readonly sampleType: "edge" | "corner" | "surface";
}

/** @ignore */
export type CameraControllers<T extends string = string> = {
    readonly [P in T]: BaseController;
}

/** Camera controller factory function signature type.
 * @template T dude
 */
export type CameraControllersFactory<T extends CameraControllers> = (input: ControllerInput, pick: PickContext) => T;

/** Optional values to initialize camera controller. */
export interface CameraControllerInitialValues {
    /** The camera position. */
    readonly position?: ReadonlyVec3;
    /** The camera rotation. */
    readonly rotation?: ReadonlyQuat;
    /** The camera field of view.
     * @see {@link RenderStateCamera.fov}.
     */
    readonly fov?: number;
}

/** Camera controller switch options.
 * @category Camera Controller
 * @category Render View
 */
export interface CameraControllerOptions {
    /** Whether to attempt an auto initializion of camera position or not.
     * @remarks
     * This is a heuristic won't work well for scenes with clusters of geometry scattered far apart.
     * Georeferenced autocad models that contains "meta" geometry at origo are often problematic and may require you to supply a position manually.
     */
    readonly autoInit?: boolean;
}

export type ViewImports = Core3DImports & MeasureImports & OfflineImports;
export type ViewImportmap = Core3DImportMap & MeasureImportMap & OfflineImportMap;


export interface OfflineContext {
    readonly manifestUrl: URL;
    isEnabled(): Promise<boolean>;
    // TODO: Add last sync date and size?
}
