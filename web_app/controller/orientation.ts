import { type ReadonlyQuat, glMatrix, quat, mat3, type ReadonlyVec3, vec3 } from "gl-matrix";


/** A 3D rotation expressed as pitch, roll and yaw angles.
 * @see {@link https://en.wikipedia.org/wiki/Aircraft_principal_axes}
 * @category Camera Controllers
 */
export class PitchRollYawOrientation {
    private _pitch = 0;
    private _yaw = 0;
    private _roll = 0;
    private _rot: ReadonlyQuat | undefined;

    /**
     * @param pitch Pitch angle, in degrees.
     * @param yaw Yaw angle, in degrees.
     * @param roll Roll angle, in degrees.
     */
    constructor(pitch: number = 0, yaw: number = 0, roll: number = 0) {
        this.pitch = pitch;
        this.yaw = yaw;
        this.roll = roll;
    }

    /** Pitch angle, in degrees. */
    get pitch() {
        return this._pitch;
    }
    set pitch(value: number) {
        value = clamp(value, -90, 90);
        if (value != this._pitch) {
            this._pitch = value;
            this._rot = undefined;
        }
    }

    /** Roll angle, in degrees. */
    get roll() {
        return this._roll;
    }
    set roll(value: number) {
        while (value >= 360) value -= 360;
        while (value < 0) value += 360;
        if (value != this._roll) {
            this._roll = value;
            this._rot = undefined;
        }
    }

    /** Yaw angle, in degrees. */
    get yaw() {
        return this._yaw;
    }
    set yaw(value: number) {
        while (value >= 360) value -= 360;
        while (value < 0) value += 360;
        if (value != this._yaw) {
            this._yaw = value;
            this._rot = undefined;
        }
    }

    /** Rotation expressed as a quaternion.
     * @remarks
     * The rotation will return a new object if after pitch, roll or yaw angles have changed since last time this accessor was called.
     * Othewise, it returns the previous, cached, object.
     * This enables {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality | strict equality}
     * to determine when the rotation remains unchanged.
     * @see {@link https://glmatrix.net/docs/module-quat.html}
     */
    get rotation() {
        if (!this._rot) {
            this._rot = this.computeRotation();
        }
        return this._rot;
    }

    /** Set pitch, roll and yaw angles from rotation quaternion.
     * @param rot The rotation quaternion to decompose into angles.
     */
    decomposeRotation(rot: ReadonlyQuat) {
        const { yaw, pitch, roll } = decomposeRotation(rot);
        this.yaw = yaw * 180 / Math.PI;
        this.pitch = pitch * 180 / Math.PI;
        this.roll = roll * 180 / Math.PI;
        this._rot = rot;
    }

    private computeRotation(): ReadonlyQuat {
        const { _roll, _pitch, _yaw } = this;
        return computeRotation(_roll, _pitch, _yaw);
    }
}

/** Compute rotation quaternion from roll, pitch and yaw angles.
 * @param roll Roll angle in degrees,
 * @param pitch Pitch angle in degrees,
 * @param yaw Yaw angle in degrees,
 * @category Camera Controllers
 */
export function computeRotation(roll: number, pitch: number, yaw: number) {
    //ported from https://github.com/BabylonJS/Babylon.js/blob/fe8e43bc526f01a3649241d3819a45455a085461/packages/dev/core/src/Maths/math.vector.ts
    const halfYaw = glMatrix.toRadian(yaw) * 0.5;
    const halfPitch = glMatrix.toRadian(pitch) * 0.5;
    const halfRoll = glMatrix.toRadian(roll) * 0.5;

    const sinRoll = Math.sin(halfRoll);
    const cosRoll = Math.cos(halfRoll);
    const sinPitch = Math.sin(halfPitch);
    const cosPitch = Math.cos(halfPitch);
    const sinYaw = Math.sin(halfYaw);
    const cosYaw = Math.cos(halfYaw);

    const x = cosYaw * sinPitch * cosRoll + sinYaw * cosPitch * sinRoll;
    const y = sinYaw * cosPitch * cosRoll - cosYaw * sinPitch * sinRoll;
    const z = cosYaw * cosPitch * sinRoll - sinYaw * sinPitch * cosRoll;
    const w = cosYaw * cosPitch * cosRoll + sinYaw * sinPitch * sinRoll;
    const flipYZ = quat.fromValues(0.7071067811865475, 0, 0, 0.7071067811865476);
    return quat.mul(quat.create(), flipYZ, quat.fromValues(x, y, z, w));
}

/** Decompose rotation quaternioan into roll, pitch and yaw angles.
 * @param rot Rotation quaternion.
 * @returns Rotation angles in radians.
 * @category Camera Controllers
 */
export function decomposeRotation(rot: ReadonlyQuat) {
    //ported from https://github.com/BabylonJS/Babylon.js/blob/fe8e43bc526f01a3649241d3819a45455a085461/packages/dev/core/src/Maths/math.vector.ts
    const flipXZ = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);

    const [qx, qy, qz, qw] = quat.mul(quat.create(), flipXZ, rot);
    const zAxisY = qy * qz - qx * qw;
    const limit = 0.4999999;

    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    if (zAxisY < -limit) {
        yaw = 2 * Math.atan2(qy, qw);
        pitch = Math.PI / 2;
        roll = 0;
    } else if (zAxisY > limit) {
        yaw = 2 * Math.atan2(qy, qw);
        pitch = -Math.PI / 2;
        roll = 0;
    } else {
        const sqw = qw * qw;
        const sqz = qz * qz;
        const sqx = qx * qx;
        const sqy = qy * qy;
        roll = Math.atan2(2.0 * (qx * qy + qz * qw), -sqz - sqx + sqy + sqw);
        pitch = Math.asin(-2.0 * zAxisY);
        yaw = Math.atan2(2.0 * (qz * qx + qy * qw), sqz - sqx - sqy + sqw);
    }
    return {
        /** The yaw angle, in radians. */
        yaw,
        /** The pitch angle, in radians. */
        pitch,
        /** The roll angle, in radians. */
        roll
    } as const;
}


/** @internal */
export function clamp(value: number, min: number, max: number) {
    if (value < min) {
        value = min;
    } else if (value > max) {
        value = max;
    }
    return value;
}

/** Retuns a quaternion computed for the given direction.
  * Will compute rotation with Y as the up vector unless direction is Y or snapToAxis is given
  * @param dir Direction vector.
  * @param snapToAxis Snap to custom rotation, uses Y as up otherwise 
  * @returns Rotation computed for the given direction and snap axis.
  * @category Camera Controllers
  */
export function rotationFromDirection(dir: ReadonlyVec3, snapToAxis?: quat, customUp?: vec3) {
    const up = customUp ?? (glMatrix.equals(Math.abs(vec3.dot(vec3.fromValues(0, 0, 1), dir)), 1)
        ? vec3.fromValues(0, 1, 0)
        : vec3.fromValues(0, 0, 1));
    if (snapToAxis) {
        vec3.transformQuat(up, up, snapToAxis);
    }

    const right = vec3.cross(vec3.create(), up, dir);
    if (snapToAxis) {
        const [x, y, z] = right;
        right[0] = right[1] = right[2] = 0;
        const ax = Math.abs(x);
        const ay = Math.abs(y);
        const az = Math.abs(z);
        if (ax > ay && ax > az) {
            right[0] = Math.sign(x);
        } else if (ay > az) {
            right[1] = Math.sign(y);
        } else {
            right[2] = Math.sign(z);
        }
    }

    vec3.cross(up, dir, right);
    vec3.normalize(up, up);

    vec3.cross(right, up, dir);
    vec3.normalize(right, right);

    return quat.fromMat3(
        quat.create(),
        mat3.fromValues(right[0], right[1], right[2], up[0], up[1], up[2], dir[0], dir[1], dir[2])
    );
}