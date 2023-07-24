import { type ReadonlyQuat, glMatrix, quat, mat3, type ReadonlyVec3, vec3 } from "gl-matrix";

export class PitchRollYawOrientation {

    private _pitch = 30;
    private _yaw = 0;
    private _roll = 0;
    private _rot: ReadonlyQuat | undefined;

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

    get rotation() {
        if (!this._rot) {
            this._rot = this.computeRotation();
        }
        return this._rot;
    }

    decomposeRotation(rot: ReadonlyQuat) {
        const { yaw, pitch, roll } = decomposeRotation(rot);
        this.yaw = yaw * 180 / Math.PI;
        this.pitch = pitch * 180 / Math.PI;
        this.roll = roll * 180 / Math.PI;
        this._rot = rot;
    }

    private computeRotation(): ReadonlyQuat {
        //ported from https://github.com/BabylonJS/Babylon.js/blob/fe8e43bc526f01a3649241d3819a45455a085461/packages/dev/core/src/Maths/math.vector.ts
        const { _roll, _pitch, _yaw } = this;
        return computeRotation(_roll, _pitch, _yaw);
    }
}

export function computeRotation(roll: number, pitch: number, yaw: number) {
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
    return { yaw, pitch, roll } as const;
}

export function clamp(v: number, min: number, max: number) {
    if (v < min) {
        v = min;
    } else if (v > max) {
        v = max;
    }
    return v;
}

export function rotationFromDirection(dir: ReadonlyVec3, snapToAxis?: quat) {
    const up = glMatrix.equals(Math.abs(vec3.dot(vec3.fromValues(0, 0, 1), dir)), 1)
        ? vec3.fromValues(0, 1, 0)
        : vec3.fromValues(0, 0, 1);
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