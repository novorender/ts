import { type ReadonlyVec3, vec3, vec2, type ReadonlyQuat, mat3, type ReadonlyVec2, type ReadonlyVec4, glMatrix, vec4, mat4 } from "gl-matrix";
import { downloadScene, type RenderState, type RenderStateChanges, defaultRenderState, initCore3D, mergeRecursive, RenderContext, type SceneConfig, modifyRenderState, type RenderStatistics, type DeviceProfile, type PickSample, type PickOptions, CoordSpace, type Core3DImports, type RenderStateCamera, validateRenderState, type Core3DImportMap, downloadCore3dImports, type PBRMaterialInfo, type RGB, type RenderStateTextureReference, type ActiveTextureIndex, type MaxActiveTextures, emptyActiveTexturesArray, type AABB } from "core3d";
import { builtinControllers, ControllerInput, type BaseController, type PickContext, type BuiltinCameraControllerType } from "./controller";
import { flipGLtoCadVec, flipState } from "./flip";
import { MeasureView, createMeasureView, type MeasureEntity, downloadMeasureImports, type MeasureImportMap, type MeasureImports, type ObjectId, type DrawProduct, type LinesDrawSetting, type DrawContext } from "measure";
import { inspectDeviations, type DeviationInspectionSettings, type DeviationInspections } from "./buffer_inspect";
import { downloadOfflineImports, manageOfflineStorage, type OfflineImportMap, type OfflineImports, type OfflineViewState, type SceneIndex } from "offline"
import { loadSceneDataOffline, type DataContext } from "data";
import * as DataAPI from "data/api";
import { OfflineFileNotFoundError, hasOfflineDir, requestOfflineFile } from "offline/file";
import { outlineLaser, type Intersection } from "./outline_inspect";
import { ScreenSpaceConversions } from "./screen_space_conversions";

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

    static readonly terrainMaxId = 99;
    static readonly maxHighlightGroups = 250;

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
    private _screenSpaceConversions: ScreenSpaceConversions;
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
        this._screenSpaceConversions = new ScreenSpaceConversions(this._drawContext2d);
        this.controllers = controllersFactory(input, this, this._screenSpaceConversions);
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
        this._renderContext?.dispose();
        this._renderContext = undefined;
        this._deviceProfile = value;
        this._setDeviceProfile?.(value); // this will in turn trigger this.useDeviceProfile
    }

    /**
     * Convert between different spaces like world, view and screen.
     */
    get convert() {
        return this._screenSpaceConversions;
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
        const mat = mat3.fromQuat(mat3.create(), rot); // TODO: Rotate vector instead?
        return Math.abs(mat[8]) > 0.98;
    }

    /**
     * Convert 2D pixel position to 3D position.
     * @param x Pixel x coordinate, in CSS pixels.
     * @param y Pixel y coordinate, in CSS pixels.
     * @returns Corresponding 3D position at the view plane in world space, or undefined if there is no active render context.
     * @deprecated use view.convert.screenSpaceToWorldSpace instead
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
    static async availableEnvironments(indexUrl: URL): Promise<readonly EnvironmentDescription[]> {
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
    async availableEnvironments(indexUrl: URL): Promise<readonly EnvironmentDescription[]> {
        return View.availableEnvironments(indexUrl);
    }

    /**
     * Retrieve list of network requests for given environment(s) for cache/offline purposes.
     * @param environments The environment description objects.
     * @remarks
     * The returned requests are suitable for [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll).
     */
    static environmentRequests(...environments: readonly EnvironmentDescription[]): readonly Request[] {
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
     * Retrieve list of available textures.
     * @public
     * @param indexUrl
     * The absolute url of the index.json file.
     * @returns A promise of a list of environments.
     */
    async availableTextures(indexUrl: URL): Promise<readonly TextureDescription[]> {
        let materials: Readonly<Record<string, TextureDescription>> = {};
        const response = await fetch(indexUrl.toString(), { mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} from ${indexUrl}`);
        }
        // TODO: Handle varing resolutions.
        const materialIndex = await response.json();
        console.assert(materialIndex.width != this.renderContext?.materialCommon);
        materials = materialIndex.materials as Readonly<Record<string, TextureDescription>>;
        return Object.entries(materials).map(([name, value]) => (
            { ...value, name, url: new URL(`${name}.tex`, indexUrl).toString(), thumnbnailURL: new URL(`${name}_1k.jpg`, indexUrl).toString() }
        )).sort((a, b) => (a.name.localeCompare(b.name)));
    }

    /**
     * Retrieve list of network requests for given texture(s) for cache/offline purposes.
     * @param environments The texture description objects.
     * @remarks
     * The returned requests are suitable for [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll).
     */
    static textureRequests(...textures: readonly TextureDescription[]): readonly Request[] {
        const urls: URL[] = [];
        for (const texture of textures) {
            urls.push(new URL(texture.url));
            // urls.push(texture.thumnbnailURL);
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
            this.applyChanges(stateChanges);

            const measureView = await createMeasureView(this._drawContext2d, this.imports);
            await measureView.loadScene(baseSceneUrl, measure ? measure.brepLut : ""); // TODO: include abort signal!
            this._measureView = measureView;

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
     * @returns Spaced out labels prioritizing the smallest or highest deviation values based on settings. 
     * Also returns a line trough the points if it is able to project the points on a line and the option is given.
     */
    async inspectDeviations(settings: DeviationInspectionSettings): Promise<DeviationInspections | undefined> {
        const context = this._renderContext;
        if (context) {
            const scale = devicePixelRatio * this.resolutionModifier;
            const deviations = await context.getDeviations();
            const { output } = this.renderStateGL;
            if (deviations.length < (output.height * output.width) / 20) {
                return inspectDeviations(deviations, scale, settings);
            }
        }
    }

    screenSpaceLaser(laserPosition: ReadonlyVec3, xDir: ReadonlyVec3, yDir: ReadonlyVec3, zDir: ReadonlyVec3): Intersection | undefined {
        const context = this._renderContext;
        if (context) {
            const { width, height } = this.renderStateGL.output;
            const { convert } = this;
            const xDirPos = vec3.add(vec3.create(), laserPosition, xDir);
            const yDirPos = vec3.add(vec3.create(), laserPosition, yDir);
            const zDirPos = vec3.add(vec3.create(), laserPosition, zDir);
            const points2d = convert.worldSpaceToScreenSpace([laserPosition, xDirPos, yDirPos, zDirPos], { width, height, round: false });
            if (points2d[0] === undefined) {
                return;
            }
            const normalize = (dir?: vec2) => {
                if (dir && vec2.dot(dir, dir) != 0) {
                    vec2.normalize(dir, dir);
                    return dir;
                }
            }

            for (const point of points2d) {
                if (point) {
                    (point as vec2)[1] = height - point[1];
                }
            }

            const xDir2d = normalize(points2d[1] ? vec2.sub(vec2.create(), points2d[1], points2d[0]) : undefined);
            const yDir2d = normalize(points2d[2] ? vec2.sub(vec2.create(), points2d[2], points2d[0]) : undefined);
            const zDir2d = normalize(points2d[3] ? vec2.sub(vec2.create(), points2d[3], points2d[0]) : undefined);
            return context.screenSpaceLaser(points2d[0], xDir2d, yDir2d, zDir2d);
        }
    }


    /**
     * Create a list of intersections between the x and y axis through the tracer position
     * @public
     * @param laserPosition position where to calculate intersections,  
     * @param planeType choose if planes under clipping or outlines should be used
     * @param planeIndex The index of the plane where tracer should be placed, based on the list in render state
     * @param rotation rotation of the lasers in the plane, if undefined then x,y will be used
     * @param autoAlign Auto align the lasers to the geometry, "model" will try to align to the highest number of lines it will intersect with 
     *                  while "closest" will align to the closest line it intersects with
     * @returns list of intersections (right, left, up ,down) 
     * results will be ordered from  closest to furthest from the tracer point
     */

    outlineLaser(laserPosition: ReadonlyVec3, planeType: "clipping" | "outline", planeIndex: number, rotation?: number, autoAlign?: "model" | "closest"): Intersection | undefined {
        const context = this._renderContext;
        const { renderStateGL } = this;
        if (context) {
            const rotationAngle = rotation ?? 0;
            const flipToGl = (v: ReadonlyVec3) => vec3.fromValues(v[0], v[2], -v[1]);
            const flipToCad = (v: ReadonlyVec3) => vec3.fromValues(v[0], -v[2], v[1]);
            const { outlineRenderers } = context;
            const outlineRenderer = outlineRenderers.get(planeType == "clipping" ? renderStateGL.clipping.planes[planeIndex].normalOffset : renderStateGL.outlines.planes[planeIndex]);
            if (outlineRenderer) {
                const lines: [ReadonlyVec2, ReadonlyVec2][] = [];
                for (const cluster of outlineRenderer.getLineClusters()) {
                    for (const l of outlineRenderer.get2dLines(cluster)) {
                        lines.push(l);
                    }
                }

                const { up, down, right, left } = outlineLaser(
                    lines,
                    outlineRenderer.transformToPlane(flipToGl(laserPosition)),
                    vec2.fromValues(Math.cos(rotationAngle), Math.sin(rotationAngle)),
                    vec2.fromValues(Math.cos(rotationAngle + (Math.PI / 2)), Math.sin(rotationAngle + (Math.PI / 2))),
                    autoAlign);
                return {
                    up: up.map(v => flipToCad(outlineRenderer.transformFromPlane(v))),
                    down: down.map(v => flipToCad(outlineRenderer.transformFromPlane(v))),
                    right: right.map(v => flipToCad(outlineRenderer.transformFromPlane(v))),
                    left: left.map(v => flipToCad(outlineRenderer.transformFromPlane(v))),
                }
            }
        }
        return undefined;
    }

    /**
     * Get current oultine drawable objects. 
     * 
     * @param planeType choose if planes under clipping or outlines should be used
     * @param planeIndex the index of the plane to look up
     * @param drawContext Option to convert the 2d positions to another draw context
     * @returns Outlines as drawable objects for the 2d egnine.
     */

    getOutlineDrawObjects(planeType: "clipping" | "outline", planeIndex: number, drawContext?: DrawContext,
        settings: LinesDrawSetting = { closed: false, angles: true, generateLengthLabels: true, generateSlope: false }, filter?: Set<ObjectId>) {
        const context = this._renderContext;
        const { renderStateGL } = this;
        const drawProducts: DrawProduct[] = [];
        if (!this._measureView) {
            return drawProducts;
        }
        if (context) {
            const flipToCad = (v: ReadonlyVec3) => vec3.fromValues(v[0], -v[2], v[1]);
            const { outlineRenderers } = context;
            const outlineRenderer = outlineRenderers.get(planeType == "clipping" ? renderStateGL.clipping.planes[planeIndex].normalOffset : renderStateGL.outlines.planes[planeIndex]);
            if (outlineRenderer) {
                const objToLines = new Map<ObjectId, ReadonlyVec3[][]>();
                for (const cluster of outlineRenderer.getLineClusters()) {
                    let lines = objToLines.get(cluster.objectId);
                    if (filter && !filter.has(cluster.objectId)) {
                        continue;
                    }
                    if (!lines) {
                        lines = [];
                        objToLines.set(cluster.objectId, lines);
                    }
                    for (const l of outlineRenderer.getLines(cluster)) {
                        lines.push(l.map(p => flipToCad(p)) as [ReadonlyVec3, ReadonlyVec3]);
                    }
                }
                for (const lines of objToLines) {
                    for (let i = 0; i < lines[1].length; ++i) {
                        const lineA = lines[1][i];
                        for (let j = i + 1; j < lines[1].length; ++j) {
                            const lineB = lines[1][j];
                            const remove = () => {
                                lines[1].splice(j, 1);
                                j = i;
                            }
                            if (vec3.exactEquals(lineA[0], lineB[0])) {
                                lineA.unshift(lineB[1]);
                                remove();
                            } else if (vec3.exactEquals(lineA[0], lineB[1])) {
                                lineA.unshift(lineB[0]);
                                remove();
                            } else if (vec3.exactEquals(lineA[lineA.length - 1], lineB[0])) {
                                lineA.push(lineB[1]);
                                remove();
                            } else if (vec3.exactEquals(lineA[lineA.length - 1], lineB[1])) {
                                lineA.push(lineB[0]);
                                remove();
                            }
                        }
                    }
                }
                for (const lines of objToLines) {
                    const dirA = vec3.create();
                    const dirB = vec3.create();
                    for (const seg of lines[1]) {
                        for (let i = 1; i < seg.length - 1; ++i) {
                            const curr = seg[i];
                            const next = seg[i + 1];
                            const prev = seg[i - 1];
                            vec3.sub(dirA, curr, prev);
                            vec3.sub(dirB, next, curr);
                            const angle = vec3.angle(dirA, dirB);
                            if (angle < 0.01745329) { //1 degree
                                seg.splice(i, 1);
                                --i;
                            }
                        }
                    }
                }
                for (const lines of objToLines) {
                    const product = this._measureView?.draw.getDrawObjectFromLineSegments(lines[1], lines[0], settings, drawContext);
                    if (product) {
                        drawProducts.push(product);
                    }
                }
            }
        }
        return drawProducts;
    }

    /**
     * Find bounding rectangle on the given plane for the selected objects, converted to world coordinates.
     * 
     * @param planeType choose if planes under clipping or outlines should be used
     * @param planeIndex the index of the plane to look up
     * @param objectIds set of object IDs to check
     * @returns bounding rectangle of all the selected object ID vertices lying on the give plane.
     *          Bounds are calculated in plane coordinates and returned in world coordinates
     */
    getObjectsOutlinePlaneBoundingRectInWorld(planeType: "clipping" | "outline", planeIndex: number, objectIds: Set<number>): AABB | undefined {
        const context = this._renderContext;
        const { renderStateGL } = this;
        if (context) {
            const { outlineRenderers } = context;
            const outlineRenderer = outlineRenderers.get(planeType == "clipping" ? renderStateGL.clipping.planes[planeIndex].normalOffset : renderStateGL.outlines.planes[planeIndex]);
            if (outlineRenderer) {
                const min = vec2.fromValues(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
                const max = vec2.fromValues(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

                const v = vec2.create();
                for (const cluster of outlineRenderer.getLineClusters()) {
                    if (objectIds.has(cluster.objectId)) {
                        for (let i = 0; i < cluster.vertices.length; i += 2) {
                            vec2.set(v, cluster.vertices[i], cluster.vertices[i + 1]);
                            vec2.min(min, min, v);
                            vec2.max(max, max, v);
                        }
                    }
                }

                const flipToCad = (v: ReadonlyVec3) => vec3.fromValues(v[0], -v[2], v[1]);

                return min[0] === Number.MAX_SAFE_INTEGER ? undefined : {
                    min: flipToCad(outlineRenderer.transformFromPlane(min)),
                    max: flipToCad(outlineRenderer.transformFromPlane(max))
                }
            }
        }
        return undefined;
    }

    /**
     * Select outline point based on the proximity to the input point.
     * @param position Input position, outline points will be tested againts this.
     * @param threshold Threshold in meters, if no points are within this proxmitiy of the input point undefined will be returned
     * @public
     * @returns returns the closest point to the input position.
     */
    selectOutlinePoint(position: ReadonlyVec3, threshold: number) {
        const context = this._renderContext;
        const planes = this.renderStateGL.clipping.planes;
        let currentMaxDis = Math.pow(threshold, 2);
        const point = vec3.create();
        if (context) {
            const flip = (v: ReadonlyVec3) => vec3.fromValues(v[0], -v[2], v[1]);
            const { outlineRenderers } = context;
            for (const plane of planes) {
                if (plane.outline) {
                    const outlineRenderer = outlineRenderers.get(plane.normalOffset);
                    if (outlineRenderer) {
                        for (const cluster of outlineRenderer.getLineClusters()) {
                            for (const v of outlineRenderer.getVertices(cluster)) {
                                const fv = flip(v);
                                const d = vec3.sqrDist(fv, position);
                                if (d < currentMaxDis) {
                                    currentMaxDis = d;
                                    vec3.copy(point, fv);
                                }
                            }
                        }
                    }
                }
            }
        }
        return vec3.dot(point, point) != 0 ? point : undefined;
    }

    /**
     * Get all object ids currently on screen
     * @public
     * @returns returns a set of all object ids on the screen 
     */
    getOutlineObjectsOnScreen() {
        const context = this._renderContext;
        const planes = this.renderStateGL.clipping.planes;
        const objectIds = new Set<number>();
        if (context) {
            const { outlineRenderers } = context;
            for (const plane of planes) {
                if (plane.outline) {
                    const outlineRenderer = outlineRenderers.get(plane.normalOffset);
                    if (outlineRenderer) {
                        for (const { objectId } of outlineRenderer.getLineClusters()) {
                            objectIds.add(objectId);
                        }
                    }
                }
            }
        }
        return objectIds;
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
                    if (a.objectId <= View.terrainMaxId && b.objectId > View.terrainMaxId) {
                        return b;
                    } else if (b.objectId <= View.terrainMaxId) {
                        return a;
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
                    pointFactor: this.deviceProfile.quirks.adreno600 ? undefined : centerSample.pointFactor
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
        _activeController.init({ kind, position: initialState?.position ?? position, rotation: initialState?.rotation ?? rotation, pivot: initialState?.pivot ?? pivot, distance, fovMeters: initialState?.fov ?? (kind != "panorama" ? fovMeters : undefined) });
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
            const { moving } = _activeController;

            const isIdleFrame = idleFrameTime > 500 && !moving;
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
                        this.resize();
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
                        this.render?.({ isIdleFrame, cameraMoved: moving });
                        possibleChanges = true;
                    });
                } else if (possibleChanges) {
                    this.render?.({ isIdleFrame, cameraMoved: moving });
                    if (isIdleFrame) {
                        // render pick buffer if there is nothing else to render and camera is not moving
                        // make it feel better for slower devices when picking idle frame
                        _renderContext.renderPickBuffers();
                    }
                }
            }

            if (moving) {
                wasCameraMoving = true;
                idleFrameTime = 0;
            } else if (!wasCameraMoving) {
                idleFrameTime += frameTime;
            }
            wasCameraMoving = moving;
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
     * @param isIdleFrame If this frame is an idle frame, a frame with more visual features and higher resolution, 
     *                    delayed triggered when camera stopped movinbg.
     * @param cameraMoved Was the camera moving or not during the current frame.
     * @virtual
     */
    render?(params: { isIdleFrame: boolean, cameraMoved: boolean }): void;

    /**
     * Helper function for assigning an index to the specified texture reference.
     * @param texture Texture reference to assign index to.
     * @param addCB Optional callback to be called if the texture reference
     * @returns A valid texture index slot and a flag indictating whether the slot existed or not.
     * @remarks
     * This function check if the reference object already exists in the current render state and if so, return the existing index.
     * If not, it will find the first available slot that currently has no references, i.e. no highlight groups referring to it.
     * In the latter case, it will update the render state to reflect the new texture reference.
     * If the maximum amount of textures {@link MaxActiveTextures} are exceeded, this function will throw an exception.
     */
    assignTextureSlot(texture: RenderStateTextureReference): TextureSlot {
        const { highlights } = this.currentRenderState;
        let { groups, textures } = highlights;
        textures ??= emptyActiveTexturesArray();
        const idx = textures.indexOf(texture); // this variant relies on object reference comparison, rather than similartiy
        // const idx = textures.findIndex(t => texture.url.localeCompare(t?.url ?? ""));
        const n: MaxActiveTextures = 10;
        let existed = true;
        let index: ActiveTextureIndex | undefined = idx >= 0 && idx < n ? idx as ActiveTextureIndex : undefined;
        if (index == undefined) {
            existed = false;
            // build set of referenced texture indices
            var refs = new Set<number>();
            for (const { texture } of groups) {
                if (texture) {
                    refs.add(texture.index);
                }
            }
            // find the first unreferenced/available texture index/slot, if any
            for (let i = 0; i < n; i++) {
                if (!refs.has(i)) {
                    index = i as ActiveTextureIndex;
                    this.modifyRenderState({ highlights: { textures: textures.with(index, texture) } })
                    break;
                }
            }
        }
        if (index == undefined) {
            throw new Error("No available texture slot!");
        }
        return { index, existed };
    }

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

    private get currentRenderState() {
        const state = this.renderStateCad;
        const changes = this._stateChanges;
        return changes ? mergeRecursive(state, changes) as RenderState : state;
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
            const scale = deviceProfile.tier == 0 ? 720 + 1280 : 1440 + 2560;
            const { width, height } = this.canvas.getBoundingClientRect();
            let baseRenderResolution = ((scale / (width + height)) / 2) / devicePixelRatio;
            if (baseRenderResolution > 0.5) {
                baseRenderResolution = 0.5;
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

/** PBR Material texture description
 * @category Render View
 */
export interface TextureDescription extends RenderStateTextureReference, PBRMaterialInfo {
    /** Display name of texture. */
    readonly name: string;

    /** Texture tags. */
    readonly tags: readonly string[];

    /** Thumbnail URL. */
    readonly thumnbnailURL?: string;
}

/** Texture slot assignment return value.
 * @see {@link View.assignTextureSlot}
 */
export interface TextureSlot {
    /* The assigned index assign to this texture reference. */
    readonly index: ActiveTextureIndex;
    /* True if the texture reference already existed in the current render state, false if not. */
    readonly existed: boolean;
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
export type CameraControllersFactory<T extends CameraControllers> = (input: ControllerInput, pick: PickContext, conversions: ScreenSpaceConversions) => T;

/** Optional values to initialize camera controller. */
export interface CameraControllerInitialValues {
    /** The camera pivot position. */
    readonly pivot?: ReadonlyVec3;
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
