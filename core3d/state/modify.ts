
import type { RenderState, RenderStateChanges, RenderStateClipping, RenderStateOutput } from ".";

/**
 * Create a new copy of render state with specified modifications.
 * @param state The baseline render state.
 * @param changes The changes to apply to the baseline state.
 * @returns A new render state with all the changes applied.
 * @remarks
 * This function helps you modify render state in an immutable fashion,
 * which is key for correct and efficient render updates.
 * More specifically, it leaves all the unchanged sub objects of the returned render state alone.
 * This enables checking for changes using {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality | strict equality}.
 * Making unnecessary copies of unchanged sub objects will reduce render/update performance.
 * 
 * This function also performs some basic validation of the new state changes, at a slight performance cost.
 * To mitigate this overhead, accumulating all the changes for a frame into a single object may be beneficial.
 * The {@link mergeRecursive} function may be useful in for this.
 * @category Render State
 */
export function modifyRenderState(state: RenderState, changes: RenderStateChanges): RenderState {
    const newState = mergeRecursive(state, changes) as RenderState;
    if (changes.output) {
        verifyOutputState(newState.output);
    }
    if (changes.clipping) {
        verifyClippingState(newState.clipping);
    }
    return newState;
}

/**
 * Utility function for merging the properties of two objects recursively
 * @param original Original, baseline object.
 * @param changes Changes to be applied to baseline object.
 * @returns A clone of the original with all the changes applied.
 * @remarks
 * This function is similar to {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign | Object.assign}, only recursive.
 */
export function mergeRecursive(original: any, changes: any) {
    const clone = { ...original };
    for (const key in changes) {
        const originalValue = original ? original[key] : undefined;
        const changedValue = changes[key];
        if (changedValue != undefined && typeof changedValue == "object" && !Array.isArray(changedValue) && !ArrayBuffer.isView(changedValue) && !(changedValue instanceof Set)) {
            clone[key] = mergeRecursive(originalValue, changedValue);
        } else {
            clone[key] = changedValue;
        }
    }
    return clone;
}

function verifyOutputState(state: RenderStateOutput) {
    const { width, height } = state;
    if (!Number.isInteger(width) || !Number.isInteger(height))
        throw new Error(`Output size dimentions (width:${width}, height:${height}) must be integers!`);
}

function verifyClippingState(state: RenderStateClipping) {
    const { planes } = state;
    if (planes.length > 6)
        throw new Error(`A maximum of six clippings planes are allowed!`);
}
