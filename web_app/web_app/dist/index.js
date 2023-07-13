var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var __toBinary = /* @__PURE__ */ (() => {
  var table = new Uint8Array(128);
  for (var i = 0; i < 64; i++)
    table[i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i * 4 - 205] = i;
  return (base64) => {
    var n = base64.length, bytes = new Uint8Array((n - (base64[n - 1] == "=") - (base64[n - 2] == "=")) * 3 / 4 | 0);
    for (var i2 = 0, j = 0; i2 < n; ) {
      var c0 = table[base64.charCodeAt(i2++)], c1 = table[base64.charCodeAt(i2++)];
      var c2 = table[base64.charCodeAt(i2++)], c3 = table[base64.charCodeAt(i2++)];
      bytes[j++] = c0 << 2 | c1 >> 4;
      bytes[j++] = c1 << 4 | c2 >> 2;
      bytes[j++] = c2 << 6 | c3;
    }
    return bytes;
  };
})();

// ../node_modules/gl-matrix/esm/common.js
var common_exports = {};
__export(common_exports, {
  ARRAY_TYPE: () => ARRAY_TYPE,
  EPSILON: () => EPSILON,
  RANDOM: () => RANDOM,
  equals: () => equals,
  setMatrixArrayType: () => setMatrixArrayType,
  toRadian: () => toRadian
});
var EPSILON = 1e-6;
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
var RANDOM = Math.random;
function setMatrixArrayType(type) {
  ARRAY_TYPE = type;
}
var degree = Math.PI / 180;
function toRadian(a) {
  return a * degree;
}
function equals(a, b) {
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}
if (!Math.hypot)
  Math.hypot = function() {
    var y = 0, i = arguments.length;
    while (i--) {
      y += arguments[i] * arguments[i];
    }
    return Math.sqrt(y);
  };

// ../node_modules/gl-matrix/esm/mat3.js
var mat3_exports = {};
__export(mat3_exports, {
  add: () => add,
  adjoint: () => adjoint,
  clone: () => clone,
  copy: () => copy,
  create: () => create,
  determinant: () => determinant,
  equals: () => equals2,
  exactEquals: () => exactEquals,
  frob: () => frob,
  fromMat2d: () => fromMat2d,
  fromMat4: () => fromMat4,
  fromQuat: () => fromQuat,
  fromRotation: () => fromRotation,
  fromScaling: () => fromScaling,
  fromTranslation: () => fromTranslation,
  fromValues: () => fromValues,
  identity: () => identity,
  invert: () => invert,
  mul: () => mul,
  multiply: () => multiply,
  multiplyScalar: () => multiplyScalar,
  multiplyScalarAndAdd: () => multiplyScalarAndAdd,
  normalFromMat4: () => normalFromMat4,
  projection: () => projection,
  rotate: () => rotate,
  scale: () => scale,
  set: () => set,
  str: () => str,
  sub: () => sub,
  subtract: () => subtract,
  translate: () => translate,
  transpose: () => transpose
});
function create() {
  var out = new ARRAY_TYPE(9);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }
  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}
function fromMat4(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[4];
  out[4] = a[5];
  out[5] = a[6];
  out[6] = a[8];
  out[7] = a[9];
  out[8] = a[10];
  return out;
}
function clone(a) {
  var out = new ARRAY_TYPE(9);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  return out;
}
function copy(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  return out;
}
function fromValues(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
  var out = new ARRAY_TYPE(9);
  out[0] = m00;
  out[1] = m01;
  out[2] = m02;
  out[3] = m10;
  out[4] = m11;
  out[5] = m12;
  out[6] = m20;
  out[7] = m21;
  out[8] = m22;
  return out;
}
function set(out, m00, m01, m02, m10, m11, m12, m20, m21, m22) {
  out[0] = m00;
  out[1] = m01;
  out[2] = m02;
  out[3] = m10;
  out[4] = m11;
  out[5] = m12;
  out[6] = m20;
  out[7] = m21;
  out[8] = m22;
  return out;
}
function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}
function transpose(out, a) {
  if (out === a) {
    var a01 = a[1], a02 = a[2], a12 = a[5];
    out[1] = a[3];
    out[2] = a[6];
    out[3] = a01;
    out[5] = a[7];
    out[6] = a02;
    out[7] = a12;
  } else {
    out[0] = a[0];
    out[1] = a[3];
    out[2] = a[6];
    out[3] = a[1];
    out[4] = a[4];
    out[5] = a[7];
    out[6] = a[2];
    out[7] = a[5];
    out[8] = a[8];
  }
  return out;
}
function invert(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2];
  var a10 = a[3], a11 = a[4], a12 = a[5];
  var a20 = a[6], a21 = a[7], a22 = a[8];
  var b01 = a22 * a11 - a12 * a21;
  var b11 = -a22 * a10 + a12 * a20;
  var b21 = a21 * a10 - a11 * a20;
  var det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det;
  out[7] = (-a21 * a00 + a01 * a20) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}
function adjoint(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2];
  var a10 = a[3], a11 = a[4], a12 = a[5];
  var a20 = a[6], a21 = a[7], a22 = a[8];
  out[0] = a11 * a22 - a12 * a21;
  out[1] = a02 * a21 - a01 * a22;
  out[2] = a01 * a12 - a02 * a11;
  out[3] = a12 * a20 - a10 * a22;
  out[4] = a00 * a22 - a02 * a20;
  out[5] = a02 * a10 - a00 * a12;
  out[6] = a10 * a21 - a11 * a20;
  out[7] = a01 * a20 - a00 * a21;
  out[8] = a00 * a11 - a01 * a10;
  return out;
}
function determinant(a) {
  var a00 = a[0], a01 = a[1], a02 = a[2];
  var a10 = a[3], a11 = a[4], a12 = a[5];
  var a20 = a[6], a21 = a[7], a22 = a[8];
  return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
}
function multiply(out, a, b) {
  var a00 = a[0], a01 = a[1], a02 = a[2];
  var a10 = a[3], a11 = a[4], a12 = a[5];
  var a20 = a[6], a21 = a[7], a22 = a[8];
  var b00 = b[0], b01 = b[1], b02 = b[2];
  var b10 = b[3], b11 = b[4], b12 = b[5];
  var b20 = b[6], b21 = b[7], b22 = b[8];
  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22;
  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
  out[5] = b10 * a02 + b11 * a12 + b12 * a22;
  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
  out[8] = b20 * a02 + b21 * a12 + b22 * a22;
  return out;
}
function translate(out, a, v) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], x = v[0], y = v[1];
  out[0] = a00;
  out[1] = a01;
  out[2] = a02;
  out[3] = a10;
  out[4] = a11;
  out[5] = a12;
  out[6] = x * a00 + y * a10 + a20;
  out[7] = x * a01 + y * a11 + a21;
  out[8] = x * a02 + y * a12 + a22;
  return out;
}
function rotate(out, a, rad) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], s = Math.sin(rad), c = Math.cos(rad);
  out[0] = c * a00 + s * a10;
  out[1] = c * a01 + s * a11;
  out[2] = c * a02 + s * a12;
  out[3] = c * a10 - s * a00;
  out[4] = c * a11 - s * a01;
  out[5] = c * a12 - s * a02;
  out[6] = a20;
  out[7] = a21;
  out[8] = a22;
  return out;
}
function scale(out, a, v) {
  var x = v[0], y = v[1];
  out[0] = x * a[0];
  out[1] = x * a[1];
  out[2] = x * a[2];
  out[3] = y * a[3];
  out[4] = y * a[4];
  out[5] = y * a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  return out;
}
function fromTranslation(out, v) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = v[0];
  out[7] = v[1];
  out[8] = 1;
  return out;
}
function fromRotation(out, rad) {
  var s = Math.sin(rad), c = Math.cos(rad);
  out[0] = c;
  out[1] = s;
  out[2] = 0;
  out[3] = -s;
  out[4] = c;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}
function fromScaling(out, v) {
  out[0] = v[0];
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = v[1];
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}
function fromMat2d(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = 0;
  out[3] = a[2];
  out[4] = a[3];
  out[5] = 0;
  out[6] = a[4];
  out[7] = a[5];
  out[8] = 1;
  return out;
}
function fromQuat(out, q) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z2 = z + z;
  var xx = x * x2;
  var yx = y * x2;
  var yy = y * y2;
  var zx = z * x2;
  var zy = z * y2;
  var zz = z * z2;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z2;
  out[0] = 1 - yy - zz;
  out[3] = yx - wz;
  out[6] = zx + wy;
  out[1] = yx + wz;
  out[4] = 1 - xx - zz;
  out[7] = zy - wx;
  out[2] = zx - wy;
  out[5] = zy + wx;
  out[8] = 1 - xx - yy;
  return out;
}
function normalFromMat4(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32;
  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  return out;
}
function projection(out, width, height) {
  out[0] = 2 / width;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = -2 / height;
  out[5] = 0;
  out[6] = -1;
  out[7] = 1;
  out[8] = 1;
  return out;
}
function str(a) {
  return "mat3(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ", " + a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " + a[8] + ")";
}
function frob(a) {
  return Math.hypot(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
}
function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  out[3] = a[3] + b[3];
  out[4] = a[4] + b[4];
  out[5] = a[5] + b[5];
  out[6] = a[6] + b[6];
  out[7] = a[7] + b[7];
  out[8] = a[8] + b[8];
  return out;
}
function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  out[3] = a[3] - b[3];
  out[4] = a[4] - b[4];
  out[5] = a[5] - b[5];
  out[6] = a[6] - b[6];
  out[7] = a[7] - b[7];
  out[8] = a[8] - b[8];
  return out;
}
function multiplyScalar(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  out[3] = a[3] * b;
  out[4] = a[4] * b;
  out[5] = a[5] * b;
  out[6] = a[6] * b;
  out[7] = a[7] * b;
  out[8] = a[8] * b;
  return out;
}
function multiplyScalarAndAdd(out, a, b, scale7) {
  out[0] = a[0] + b[0] * scale7;
  out[1] = a[1] + b[1] * scale7;
  out[2] = a[2] + b[2] * scale7;
  out[3] = a[3] + b[3] * scale7;
  out[4] = a[4] + b[4] * scale7;
  out[5] = a[5] + b[5] * scale7;
  out[6] = a[6] + b[6] * scale7;
  out[7] = a[7] + b[7] * scale7;
  out[8] = a[8] + b[8] * scale7;
  return out;
}
function exactEquals(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[8] === b[8];
}
function equals2(a, b) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8];
  var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8];
  return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON * Math.max(1, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON * Math.max(1, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON * Math.max(1, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON * Math.max(1, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON * Math.max(1, Math.abs(a8), Math.abs(b8));
}
var mul = multiply;
var sub = subtract;

// ../node_modules/gl-matrix/esm/mat4.js
var mat4_exports = {};
__export(mat4_exports, {
  add: () => add2,
  adjoint: () => adjoint2,
  clone: () => clone2,
  copy: () => copy2,
  create: () => create2,
  determinant: () => determinant2,
  equals: () => equals3,
  exactEquals: () => exactEquals2,
  frob: () => frob2,
  fromQuat: () => fromQuat3,
  fromQuat2: () => fromQuat2,
  fromRotation: () => fromRotation2,
  fromRotationTranslation: () => fromRotationTranslation,
  fromRotationTranslationScale: () => fromRotationTranslationScale,
  fromRotationTranslationScaleOrigin: () => fromRotationTranslationScaleOrigin,
  fromScaling: () => fromScaling2,
  fromTranslation: () => fromTranslation2,
  fromValues: () => fromValues2,
  fromXRotation: () => fromXRotation,
  fromYRotation: () => fromYRotation,
  fromZRotation: () => fromZRotation,
  frustum: () => frustum,
  getRotation: () => getRotation,
  getScaling: () => getScaling,
  getTranslation: () => getTranslation,
  identity: () => identity2,
  invert: () => invert2,
  lookAt: () => lookAt,
  mul: () => mul2,
  multiply: () => multiply2,
  multiplyScalar: () => multiplyScalar2,
  multiplyScalarAndAdd: () => multiplyScalarAndAdd2,
  ortho: () => ortho,
  orthoNO: () => orthoNO,
  orthoZO: () => orthoZO,
  perspective: () => perspective,
  perspectiveFromFieldOfView: () => perspectiveFromFieldOfView,
  perspectiveNO: () => perspectiveNO,
  perspectiveZO: () => perspectiveZO,
  rotate: () => rotate2,
  rotateX: () => rotateX,
  rotateY: () => rotateY,
  rotateZ: () => rotateZ,
  scale: () => scale2,
  set: () => set2,
  str: () => str2,
  sub: () => sub2,
  subtract: () => subtract2,
  targetTo: () => targetTo,
  translate: () => translate2,
  transpose: () => transpose2
});
function create2() {
  var out = new ARRAY_TYPE(16);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
function clone2(a) {
  var out = new ARRAY_TYPE(16);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
function copy2(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
function fromValues2(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
  var out = new ARRAY_TYPE(16);
  out[0] = m00;
  out[1] = m01;
  out[2] = m02;
  out[3] = m03;
  out[4] = m10;
  out[5] = m11;
  out[6] = m12;
  out[7] = m13;
  out[8] = m20;
  out[9] = m21;
  out[10] = m22;
  out[11] = m23;
  out[12] = m30;
  out[13] = m31;
  out[14] = m32;
  out[15] = m33;
  return out;
}
function set2(out, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
  out[0] = m00;
  out[1] = m01;
  out[2] = m02;
  out[3] = m03;
  out[4] = m10;
  out[5] = m11;
  out[6] = m12;
  out[7] = m13;
  out[8] = m20;
  out[9] = m21;
  out[10] = m22;
  out[11] = m23;
  out[12] = m30;
  out[13] = m31;
  out[14] = m32;
  out[15] = m33;
  return out;
}
function identity2(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function transpose2(out, a) {
  if (out === a) {
    var a01 = a[1], a02 = a[2], a03 = a[3];
    var a12 = a[6], a13 = a[7];
    var a23 = a[11];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a01;
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a02;
    out[9] = a12;
    out[11] = a[14];
    out[12] = a03;
    out[13] = a13;
    out[14] = a23;
  } else {
    out[0] = a[0];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a[1];
    out[5] = a[5];
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a[2];
    out[9] = a[6];
    out[10] = a[10];
    out[11] = a[14];
    out[12] = a[3];
    out[13] = a[7];
    out[14] = a[11];
    out[15] = a[15];
  }
  return out;
}
function invert2(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32;
  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
function adjoint2(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  out[0] = a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22);
  out[1] = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
  out[2] = a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12);
  out[3] = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
  out[4] = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
  out[5] = a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22);
  out[6] = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
  out[7] = a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12);
  out[8] = a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21);
  out[9] = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
  out[10] = a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11);
  out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
  out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
  out[13] = a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21);
  out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
  out[15] = a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11);
  return out;
}
function determinant2(a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32;
  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
}
function multiply2(out, a, b) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
function translate2(out, a, v) {
  var x = v[0], y = v[1], z = v[2];
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;
  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }
  return out;
}
function scale2(out, a, v) {
  var x = v[0], y = v[1], z = v[2];
  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;
  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;
  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
function rotate2(out, a, rad, axis) {
  var x = axis[0], y = axis[1], z = axis[2];
  var len5 = Math.hypot(x, y, z);
  var s, c, t;
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;
  var b00, b01, b02;
  var b10, b11, b12;
  var b20, b21, b22;
  if (len5 < EPSILON) {
    return null;
  }
  len5 = 1 / len5;
  x *= len5;
  y *= len5;
  z *= len5;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  a00 = a[0];
  a01 = a[1];
  a02 = a[2];
  a03 = a[3];
  a10 = a[4];
  a11 = a[5];
  a12 = a[6];
  a13 = a[7];
  a20 = a[8];
  a21 = a[9];
  a22 = a[10];
  a23 = a[11];
  b00 = x * x * t + c;
  b01 = y * x * t + z * s;
  b02 = z * x * t - y * s;
  b10 = x * y * t - z * s;
  b11 = y * y * t + c;
  b12 = z * y * t + x * s;
  b20 = x * z * t + y * s;
  b21 = y * z * t - x * s;
  b22 = z * z * t + c;
  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;
  if (a !== out) {
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }
  return out;
}
function rotateX(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];
  if (a !== out) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }
  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}
function rotateY(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];
  if (a !== out) {
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }
  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}
function rotateZ(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  if (a !== out) {
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }
  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}
function fromTranslation2(out, v) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}
function fromScaling2(out, v) {
  out[0] = v[0];
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = v[1];
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = v[2];
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromRotation2(out, rad, axis) {
  var x = axis[0], y = axis[1], z = axis[2];
  var len5 = Math.hypot(x, y, z);
  var s, c, t;
  if (len5 < EPSILON) {
    return null;
  }
  len5 = 1 / len5;
  x *= len5;
  y *= len5;
  z *= len5;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  out[0] = x * x * t + c;
  out[1] = y * x * t + z * s;
  out[2] = z * x * t - y * s;
  out[3] = 0;
  out[4] = x * y * t - z * s;
  out[5] = y * y * t + c;
  out[6] = z * y * t + x * s;
  out[7] = 0;
  out[8] = x * z * t + y * s;
  out[9] = y * z * t - x * s;
  out[10] = z * z * t + c;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromXRotation(out, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = c;
  out[6] = s;
  out[7] = 0;
  out[8] = 0;
  out[9] = -s;
  out[10] = c;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromYRotation(out, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  out[0] = c;
  out[1] = 0;
  out[2] = -s;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = s;
  out[9] = 0;
  out[10] = c;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromZRotation(out, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  out[0] = c;
  out[1] = s;
  out[2] = 0;
  out[3] = 0;
  out[4] = -s;
  out[5] = c;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromRotationTranslation(out, q, v) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z2 = z + z;
  var xx = x * x2;
  var xy = x * y2;
  var xz = x * z2;
  var yy = y * y2;
  var yz = y * z2;
  var zz = z * z2;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z2;
  out[0] = 1 - (yy + zz);
  out[1] = xy + wz;
  out[2] = xz - wy;
  out[3] = 0;
  out[4] = xy - wz;
  out[5] = 1 - (xx + zz);
  out[6] = yz + wx;
  out[7] = 0;
  out[8] = xz + wy;
  out[9] = yz - wx;
  out[10] = 1 - (xx + yy);
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}
function fromQuat2(out, a) {
  var translation = new ARRAY_TYPE(3);
  var bx = -a[0], by = -a[1], bz = -a[2], bw = a[3], ax = a[4], ay = a[5], az = a[6], aw = a[7];
  var magnitude = bx * bx + by * by + bz * bz + bw * bw;
  if (magnitude > 0) {
    translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2 / magnitude;
    translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2 / magnitude;
    translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2 / magnitude;
  } else {
    translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2;
    translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2;
    translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2;
  }
  fromRotationTranslation(out, a, translation);
  return out;
}
function getTranslation(out, mat) {
  out[0] = mat[12];
  out[1] = mat[13];
  out[2] = mat[14];
  return out;
}
function getScaling(out, mat) {
  var m11 = mat[0];
  var m12 = mat[1];
  var m13 = mat[2];
  var m21 = mat[4];
  var m22 = mat[5];
  var m23 = mat[6];
  var m31 = mat[8];
  var m32 = mat[9];
  var m33 = mat[10];
  out[0] = Math.hypot(m11, m12, m13);
  out[1] = Math.hypot(m21, m22, m23);
  out[2] = Math.hypot(m31, m32, m33);
  return out;
}
function getRotation(out, mat) {
  var scaling = new ARRAY_TYPE(3);
  getScaling(scaling, mat);
  var is1 = 1 / scaling[0];
  var is2 = 1 / scaling[1];
  var is3 = 1 / scaling[2];
  var sm11 = mat[0] * is1;
  var sm12 = mat[1] * is2;
  var sm13 = mat[2] * is3;
  var sm21 = mat[4] * is1;
  var sm22 = mat[5] * is2;
  var sm23 = mat[6] * is3;
  var sm31 = mat[8] * is1;
  var sm32 = mat[9] * is2;
  var sm33 = mat[10] * is3;
  var trace = sm11 + sm22 + sm33;
  var S = 0;
  if (trace > 0) {
    S = Math.sqrt(trace + 1) * 2;
    out[3] = 0.25 * S;
    out[0] = (sm23 - sm32) / S;
    out[1] = (sm31 - sm13) / S;
    out[2] = (sm12 - sm21) / S;
  } else if (sm11 > sm22 && sm11 > sm33) {
    S = Math.sqrt(1 + sm11 - sm22 - sm33) * 2;
    out[3] = (sm23 - sm32) / S;
    out[0] = 0.25 * S;
    out[1] = (sm12 + sm21) / S;
    out[2] = (sm31 + sm13) / S;
  } else if (sm22 > sm33) {
    S = Math.sqrt(1 + sm22 - sm11 - sm33) * 2;
    out[3] = (sm31 - sm13) / S;
    out[0] = (sm12 + sm21) / S;
    out[1] = 0.25 * S;
    out[2] = (sm23 + sm32) / S;
  } else {
    S = Math.sqrt(1 + sm33 - sm11 - sm22) * 2;
    out[3] = (sm12 - sm21) / S;
    out[0] = (sm31 + sm13) / S;
    out[1] = (sm23 + sm32) / S;
    out[2] = 0.25 * S;
  }
  return out;
}
function fromRotationTranslationScale(out, q, v, s) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z2 = z + z;
  var xx = x * x2;
  var xy = x * y2;
  var xz = x * z2;
  var yy = y * y2;
  var yz = y * z2;
  var zz = z * z2;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z2;
  var sx = s[0];
  var sy = s[1];
  var sz = s[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}
function fromRotationTranslationScaleOrigin(out, q, v, s, o) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z2 = z + z;
  var xx = x * x2;
  var xy = x * y2;
  var xz = x * z2;
  var yy = y * y2;
  var yz = y * z2;
  var zz = z * z2;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z2;
  var sx = s[0];
  var sy = s[1];
  var sz = s[2];
  var ox = o[0];
  var oy = o[1];
  var oz = o[2];
  var out0 = (1 - (yy + zz)) * sx;
  var out1 = (xy + wz) * sx;
  var out2 = (xz - wy) * sx;
  var out4 = (xy - wz) * sy;
  var out5 = (1 - (xx + zz)) * sy;
  var out6 = (yz + wx) * sy;
  var out8 = (xz + wy) * sz;
  var out9 = (yz - wx) * sz;
  var out10 = (1 - (xx + yy)) * sz;
  out[0] = out0;
  out[1] = out1;
  out[2] = out2;
  out[3] = 0;
  out[4] = out4;
  out[5] = out5;
  out[6] = out6;
  out[7] = 0;
  out[8] = out8;
  out[9] = out9;
  out[10] = out10;
  out[11] = 0;
  out[12] = v[0] + ox - (out0 * ox + out4 * oy + out8 * oz);
  out[13] = v[1] + oy - (out1 * ox + out5 * oy + out9 * oz);
  out[14] = v[2] + oz - (out2 * ox + out6 * oy + out10 * oz);
  out[15] = 1;
  return out;
}
function fromQuat3(out, q) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z2 = z + z;
  var xx = x * x2;
  var yx = y * x2;
  var yy = y * y2;
  var zx = z * x2;
  var zy = z * y2;
  var zz = z * z2;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z2;
  out[0] = 1 - yy - zz;
  out[1] = yx + wz;
  out[2] = zx - wy;
  out[3] = 0;
  out[4] = yx - wz;
  out[5] = 1 - xx - zz;
  out[6] = zy + wx;
  out[7] = 0;
  out[8] = zx + wy;
  out[9] = zy - wx;
  out[10] = 1 - xx - yy;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function frustum(out, left, right, bottom, top, near, far) {
  var rl = 1 / (right - left);
  var tb = 1 / (top - bottom);
  var nf = 1 / (near - far);
  out[0] = near * 2 * rl;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = near * 2 * tb;
  out[6] = 0;
  out[7] = 0;
  out[8] = (right + left) * rl;
  out[9] = (top + bottom) * tb;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = far * near * 2 * nf;
  out[15] = 0;
  return out;
}
function perspectiveNO(out, fovy, aspect, near, far) {
  var f = 1 / Math.tan(fovy / 2), nf;
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;
  if (far != null && far !== Infinity) {
    nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
  return out;
}
var perspective = perspectiveNO;
function perspectiveZO(out, fovy, aspect, near, far) {
  var f = 1 / Math.tan(fovy / 2), nf;
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;
  if (far != null && far !== Infinity) {
    nf = 1 / (near - far);
    out[10] = far * nf;
    out[14] = far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -near;
  }
  return out;
}
function perspectiveFromFieldOfView(out, fov, near, far) {
  var upTan = Math.tan(fov.upDegrees * Math.PI / 180);
  var downTan = Math.tan(fov.downDegrees * Math.PI / 180);
  var leftTan = Math.tan(fov.leftDegrees * Math.PI / 180);
  var rightTan = Math.tan(fov.rightDegrees * Math.PI / 180);
  var xScale = 2 / (leftTan + rightTan);
  var yScale = 2 / (upTan + downTan);
  out[0] = xScale;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = yScale;
  out[6] = 0;
  out[7] = 0;
  out[8] = -((leftTan - rightTan) * xScale * 0.5);
  out[9] = (upTan - downTan) * yScale * 0.5;
  out[10] = far / (near - far);
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = far * near / (near - far);
  out[15] = 0;
  return out;
}
function orthoNO(out, left, right, bottom, top, near, far) {
  var lr = 1 / (left - right);
  var bt = 1 / (bottom - top);
  var nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}
var ortho = orthoNO;
function orthoZO(out, left, right, bottom, top, near, far) {
  var lr = 1 / (left - right);
  var bt = 1 / (bottom - top);
  var nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = near * nf;
  out[15] = 1;
  return out;
}
function lookAt(out, eye, center, up) {
  var x0, x1, x2, y0, y1, y2, z0, z1, z2, len5;
  var eyex = eye[0];
  var eyey = eye[1];
  var eyez = eye[2];
  var upx = up[0];
  var upy = up[1];
  var upz = up[2];
  var centerx = center[0];
  var centery = center[1];
  var centerz = center[2];
  if (Math.abs(eyex - centerx) < EPSILON && Math.abs(eyey - centery) < EPSILON && Math.abs(eyez - centerz) < EPSILON) {
    return identity2(out);
  }
  z0 = eyex - centerx;
  z1 = eyey - centery;
  z2 = eyez - centerz;
  len5 = 1 / Math.hypot(z0, z1, z2);
  z0 *= len5;
  z1 *= len5;
  z2 *= len5;
  x0 = upy * z2 - upz * z1;
  x1 = upz * z0 - upx * z2;
  x2 = upx * z1 - upy * z0;
  len5 = Math.hypot(x0, x1, x2);
  if (!len5) {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  } else {
    len5 = 1 / len5;
    x0 *= len5;
    x1 *= len5;
    x2 *= len5;
  }
  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;
  len5 = Math.hypot(y0, y1, y2);
  if (!len5) {
    y0 = 0;
    y1 = 0;
    y2 = 0;
  } else {
    len5 = 1 / len5;
    y0 *= len5;
    y1 *= len5;
    y2 *= len5;
  }
  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
  out[15] = 1;
  return out;
}
function targetTo(out, eye, target, up) {
  var eyex = eye[0], eyey = eye[1], eyez = eye[2], upx = up[0], upy = up[1], upz = up[2];
  var z0 = eyex - target[0], z1 = eyey - target[1], z2 = eyez - target[2];
  var len5 = z0 * z0 + z1 * z1 + z2 * z2;
  if (len5 > 0) {
    len5 = 1 / Math.sqrt(len5);
    z0 *= len5;
    z1 *= len5;
    z2 *= len5;
  }
  var x0 = upy * z2 - upz * z1, x1 = upz * z0 - upx * z2, x2 = upx * z1 - upy * z0;
  len5 = x0 * x0 + x1 * x1 + x2 * x2;
  if (len5 > 0) {
    len5 = 1 / Math.sqrt(len5);
    x0 *= len5;
    x1 *= len5;
    x2 *= len5;
  }
  out[0] = x0;
  out[1] = x1;
  out[2] = x2;
  out[3] = 0;
  out[4] = z1 * x2 - z2 * x1;
  out[5] = z2 * x0 - z0 * x2;
  out[6] = z0 * x1 - z1 * x0;
  out[7] = 0;
  out[8] = z0;
  out[9] = z1;
  out[10] = z2;
  out[11] = 0;
  out[12] = eyex;
  out[13] = eyey;
  out[14] = eyez;
  out[15] = 1;
  return out;
}
function str2(a) {
  return "mat4(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ", " + a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " + a[8] + ", " + a[9] + ", " + a[10] + ", " + a[11] + ", " + a[12] + ", " + a[13] + ", " + a[14] + ", " + a[15] + ")";
}
function frob2(a) {
  return Math.hypot(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]);
}
function add2(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  out[3] = a[3] + b[3];
  out[4] = a[4] + b[4];
  out[5] = a[5] + b[5];
  out[6] = a[6] + b[6];
  out[7] = a[7] + b[7];
  out[8] = a[8] + b[8];
  out[9] = a[9] + b[9];
  out[10] = a[10] + b[10];
  out[11] = a[11] + b[11];
  out[12] = a[12] + b[12];
  out[13] = a[13] + b[13];
  out[14] = a[14] + b[14];
  out[15] = a[15] + b[15];
  return out;
}
function subtract2(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  out[3] = a[3] - b[3];
  out[4] = a[4] - b[4];
  out[5] = a[5] - b[5];
  out[6] = a[6] - b[6];
  out[7] = a[7] - b[7];
  out[8] = a[8] - b[8];
  out[9] = a[9] - b[9];
  out[10] = a[10] - b[10];
  out[11] = a[11] - b[11];
  out[12] = a[12] - b[12];
  out[13] = a[13] - b[13];
  out[14] = a[14] - b[14];
  out[15] = a[15] - b[15];
  return out;
}
function multiplyScalar2(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  out[3] = a[3] * b;
  out[4] = a[4] * b;
  out[5] = a[5] * b;
  out[6] = a[6] * b;
  out[7] = a[7] * b;
  out[8] = a[8] * b;
  out[9] = a[9] * b;
  out[10] = a[10] * b;
  out[11] = a[11] * b;
  out[12] = a[12] * b;
  out[13] = a[13] * b;
  out[14] = a[14] * b;
  out[15] = a[15] * b;
  return out;
}
function multiplyScalarAndAdd2(out, a, b, scale7) {
  out[0] = a[0] + b[0] * scale7;
  out[1] = a[1] + b[1] * scale7;
  out[2] = a[2] + b[2] * scale7;
  out[3] = a[3] + b[3] * scale7;
  out[4] = a[4] + b[4] * scale7;
  out[5] = a[5] + b[5] * scale7;
  out[6] = a[6] + b[6] * scale7;
  out[7] = a[7] + b[7] * scale7;
  out[8] = a[8] + b[8] * scale7;
  out[9] = a[9] + b[9] * scale7;
  out[10] = a[10] + b[10] * scale7;
  out[11] = a[11] + b[11] * scale7;
  out[12] = a[12] + b[12] * scale7;
  out[13] = a[13] + b[13] * scale7;
  out[14] = a[14] + b[14] * scale7;
  out[15] = a[15] + b[15] * scale7;
  return out;
}
function exactEquals2(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[8] === b[8] && a[9] === b[9] && a[10] === b[10] && a[11] === b[11] && a[12] === b[12] && a[13] === b[13] && a[14] === b[14] && a[15] === b[15];
}
function equals3(a, b) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
  var a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
  var a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11];
  var a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
  var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  var b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7];
  var b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11];
  var b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
  return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON * Math.max(1, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON * Math.max(1, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON * Math.max(1, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON * Math.max(1, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON * Math.max(1, Math.abs(a8), Math.abs(b8)) && Math.abs(a9 - b9) <= EPSILON * Math.max(1, Math.abs(a9), Math.abs(b9)) && Math.abs(a10 - b10) <= EPSILON * Math.max(1, Math.abs(a10), Math.abs(b10)) && Math.abs(a11 - b11) <= EPSILON * Math.max(1, Math.abs(a11), Math.abs(b11)) && Math.abs(a12 - b12) <= EPSILON * Math.max(1, Math.abs(a12), Math.abs(b12)) && Math.abs(a13 - b13) <= EPSILON * Math.max(1, Math.abs(a13), Math.abs(b13)) && Math.abs(a14 - b14) <= EPSILON * Math.max(1, Math.abs(a14), Math.abs(b14)) && Math.abs(a15 - b15) <= EPSILON * Math.max(1, Math.abs(a15), Math.abs(b15));
}
var mul2 = multiply2;
var sub2 = subtract2;

// ../node_modules/gl-matrix/esm/quat.js
var quat_exports = {};
__export(quat_exports, {
  add: () => add5,
  calculateW: () => calculateW,
  clone: () => clone5,
  conjugate: () => conjugate,
  copy: () => copy5,
  create: () => create5,
  dot: () => dot3,
  equals: () => equals6,
  exactEquals: () => exactEquals5,
  exp: () => exp,
  fromEuler: () => fromEuler,
  fromMat3: () => fromMat3,
  fromValues: () => fromValues5,
  getAngle: () => getAngle,
  getAxisAngle: () => getAxisAngle,
  identity: () => identity3,
  invert: () => invert3,
  len: () => len3,
  length: () => length3,
  lerp: () => lerp3,
  ln: () => ln,
  mul: () => mul5,
  multiply: () => multiply5,
  normalize: () => normalize3,
  pow: () => pow,
  random: () => random3,
  rotateX: () => rotateX3,
  rotateY: () => rotateY3,
  rotateZ: () => rotateZ3,
  rotationTo: () => rotationTo,
  scale: () => scale5,
  set: () => set5,
  setAxes: () => setAxes,
  setAxisAngle: () => setAxisAngle,
  slerp: () => slerp,
  sqlerp: () => sqlerp,
  sqrLen: () => sqrLen3,
  squaredLength: () => squaredLength3,
  str: () => str5
});

// ../node_modules/gl-matrix/esm/vec3.js
var vec3_exports = {};
__export(vec3_exports, {
  add: () => add3,
  angle: () => angle,
  bezier: () => bezier,
  ceil: () => ceil,
  clone: () => clone3,
  copy: () => copy3,
  create: () => create3,
  cross: () => cross,
  dist: () => dist,
  distance: () => distance,
  div: () => div,
  divide: () => divide,
  dot: () => dot,
  equals: () => equals4,
  exactEquals: () => exactEquals3,
  floor: () => floor,
  forEach: () => forEach,
  fromValues: () => fromValues3,
  hermite: () => hermite,
  inverse: () => inverse,
  len: () => len,
  length: () => length,
  lerp: () => lerp,
  max: () => max,
  min: () => min,
  mul: () => mul3,
  multiply: () => multiply3,
  negate: () => negate,
  normalize: () => normalize,
  random: () => random,
  rotateX: () => rotateX2,
  rotateY: () => rotateY2,
  rotateZ: () => rotateZ2,
  round: () => round,
  scale: () => scale3,
  scaleAndAdd: () => scaleAndAdd,
  set: () => set3,
  sqrDist: () => sqrDist,
  sqrLen: () => sqrLen,
  squaredDistance: () => squaredDistance,
  squaredLength: () => squaredLength,
  str: () => str3,
  sub: () => sub3,
  subtract: () => subtract3,
  transformMat3: () => transformMat3,
  transformMat4: () => transformMat4,
  transformQuat: () => transformQuat,
  zero: () => zero
});
function create3() {
  var out = new ARRAY_TYPE(3);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
}
function clone3(a) {
  var out = new ARRAY_TYPE(3);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
function length(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
function fromValues3(x, y, z) {
  var out = new ARRAY_TYPE(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
function copy3(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
function set3(out, x, y, z) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
function add3(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
function subtract3(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}
function multiply3(out, a, b) {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
}
function divide(out, a, b) {
  out[0] = a[0] / b[0];
  out[1] = a[1] / b[1];
  out[2] = a[2] / b[2];
  return out;
}
function ceil(out, a) {
  out[0] = Math.ceil(a[0]);
  out[1] = Math.ceil(a[1]);
  out[2] = Math.ceil(a[2]);
  return out;
}
function floor(out, a) {
  out[0] = Math.floor(a[0]);
  out[1] = Math.floor(a[1]);
  out[2] = Math.floor(a[2]);
  return out;
}
function min(out, a, b) {
  out[0] = Math.min(a[0], b[0]);
  out[1] = Math.min(a[1], b[1]);
  out[2] = Math.min(a[2], b[2]);
  return out;
}
function max(out, a, b) {
  out[0] = Math.max(a[0], b[0]);
  out[1] = Math.max(a[1], b[1]);
  out[2] = Math.max(a[2], b[2]);
  return out;
}
function round(out, a) {
  out[0] = Math.round(a[0]);
  out[1] = Math.round(a[1]);
  out[2] = Math.round(a[2]);
  return out;
}
function scale3(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}
function scaleAndAdd(out, a, b, scale7) {
  out[0] = a[0] + b[0] * scale7;
  out[1] = a[1] + b[1] * scale7;
  out[2] = a[2] + b[2] * scale7;
  return out;
}
function distance(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z = b[2] - a[2];
  return Math.hypot(x, y, z);
}
function squaredDistance(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z = b[2] - a[2];
  return x * x + y * y + z * z;
}
function squaredLength(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return x * x + y * y + z * z;
}
function negate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  return out;
}
function inverse(out, a) {
  out[0] = 1 / a[0];
  out[1] = 1 / a[1];
  out[2] = 1 / a[2];
  return out;
}
function normalize(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len5 = x * x + y * y + z * z;
  if (len5 > 0) {
    len5 = 1 / Math.sqrt(len5);
  }
  out[0] = a[0] * len5;
  out[1] = a[1] * len5;
  out[2] = a[2] * len5;
  return out;
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(out, a, b) {
  var ax = a[0], ay = a[1], az = a[2];
  var bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
function lerp(out, a, b, t) {
  var ax = a[0];
  var ay = a[1];
  var az = a[2];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  out[2] = az + t * (b[2] - az);
  return out;
}
function hermite(out, a, b, c, d, t) {
  var factorTimes2 = t * t;
  var factor1 = factorTimes2 * (2 * t - 3) + 1;
  var factor2 = factorTimes2 * (t - 2) + t;
  var factor3 = factorTimes2 * (t - 1);
  var factor4 = factorTimes2 * (3 - 2 * t);
  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
  return out;
}
function bezier(out, a, b, c, d, t) {
  var inverseFactor = 1 - t;
  var inverseFactorTimesTwo = inverseFactor * inverseFactor;
  var factorTimes2 = t * t;
  var factor1 = inverseFactorTimesTwo * inverseFactor;
  var factor2 = 3 * t * inverseFactorTimesTwo;
  var factor3 = 3 * factorTimes2 * inverseFactor;
  var factor4 = factorTimes2 * t;
  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
  return out;
}
function random(out, scale7) {
  scale7 = scale7 || 1;
  var r = RANDOM() * 2 * Math.PI;
  var z = RANDOM() * 2 - 1;
  var zScale = Math.sqrt(1 - z * z) * scale7;
  out[0] = Math.cos(r) * zScale;
  out[1] = Math.sin(r) * zScale;
  out[2] = z * scale7;
  return out;
}
function transformMat4(out, a, m) {
  var x = a[0], y = a[1], z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
function transformMat3(out, a, m) {
  var x = a[0], y = a[1], z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}
function transformQuat(out, a, q) {
  var qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  var x = a[0], y = a[1], z = a[2];
  var uvx = qy * z - qz * y, uvy = qz * x - qx * z, uvz = qx * y - qy * x;
  var uuvx = qy * uvz - qz * uvy, uuvy = qz * uvx - qx * uvz, uuvz = qx * uvy - qy * uvx;
  var w2 = qw * 2;
  uvx *= w2;
  uvy *= w2;
  uvz *= w2;
  uuvx *= 2;
  uuvy *= 2;
  uuvz *= 2;
  out[0] = x + uvx + uuvx;
  out[1] = y + uvy + uuvy;
  out[2] = z + uvz + uuvz;
  return out;
}
function rotateX2(out, a, b, rad) {
  var p = [], r = [];
  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2];
  r[0] = p[0];
  r[1] = p[1] * Math.cos(rad) - p[2] * Math.sin(rad);
  r[2] = p[1] * Math.sin(rad) + p[2] * Math.cos(rad);
  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
function rotateY2(out, a, b, rad) {
  var p = [], r = [];
  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2];
  r[0] = p[2] * Math.sin(rad) + p[0] * Math.cos(rad);
  r[1] = p[1];
  r[2] = p[2] * Math.cos(rad) - p[0] * Math.sin(rad);
  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
function rotateZ2(out, a, b, rad) {
  var p = [], r = [];
  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2];
  r[0] = p[0] * Math.cos(rad) - p[1] * Math.sin(rad);
  r[1] = p[0] * Math.sin(rad) + p[1] * Math.cos(rad);
  r[2] = p[2];
  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
function angle(a, b) {
  var ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2], mag1 = Math.sqrt(ax * ax + ay * ay + az * az), mag2 = Math.sqrt(bx * bx + by * by + bz * bz), mag = mag1 * mag2, cosine = mag && dot(a, b) / mag;
  return Math.acos(Math.min(Math.max(cosine, -1), 1));
}
function zero(out) {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  return out;
}
function str3(a) {
  return "vec3(" + a[0] + ", " + a[1] + ", " + a[2] + ")";
}
function exactEquals3(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function equals4(a, b) {
  var a0 = a[0], a1 = a[1], a2 = a[2];
  var b0 = b[0], b1 = b[1], b2 = b[2];
  return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2));
}
var sub3 = subtract3;
var mul3 = multiply3;
var div = divide;
var dist = distance;
var sqrDist = squaredDistance;
var len = length;
var sqrLen = squaredLength;
var forEach = function() {
  var vec = create3();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 3;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }
    return a;
  };
}();

// ../node_modules/gl-matrix/esm/vec4.js
var vec4_exports = {};
__export(vec4_exports, {
  add: () => add4,
  ceil: () => ceil2,
  clone: () => clone4,
  copy: () => copy4,
  create: () => create4,
  cross: () => cross2,
  dist: () => dist2,
  distance: () => distance2,
  div: () => div2,
  divide: () => divide2,
  dot: () => dot2,
  equals: () => equals5,
  exactEquals: () => exactEquals4,
  floor: () => floor2,
  forEach: () => forEach2,
  fromValues: () => fromValues4,
  inverse: () => inverse2,
  len: () => len2,
  length: () => length2,
  lerp: () => lerp2,
  max: () => max2,
  min: () => min2,
  mul: () => mul4,
  multiply: () => multiply4,
  negate: () => negate2,
  normalize: () => normalize2,
  random: () => random2,
  round: () => round2,
  scale: () => scale4,
  scaleAndAdd: () => scaleAndAdd2,
  set: () => set4,
  sqrDist: () => sqrDist2,
  sqrLen: () => sqrLen2,
  squaredDistance: () => squaredDistance2,
  squaredLength: () => squaredLength2,
  str: () => str4,
  sub: () => sub4,
  subtract: () => subtract4,
  transformMat4: () => transformMat42,
  transformQuat: () => transformQuat2,
  zero: () => zero2
});
function create4() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }
  return out;
}
function clone4(a) {
  var out = new ARRAY_TYPE(4);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}
function fromValues4(x, y, z, w) {
  var out = new ARRAY_TYPE(4);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}
function copy4(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}
function set4(out, x, y, z, w) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}
function add4(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  out[3] = a[3] + b[3];
  return out;
}
function subtract4(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  out[3] = a[3] - b[3];
  return out;
}
function multiply4(out, a, b) {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  out[3] = a[3] * b[3];
  return out;
}
function divide2(out, a, b) {
  out[0] = a[0] / b[0];
  out[1] = a[1] / b[1];
  out[2] = a[2] / b[2];
  out[3] = a[3] / b[3];
  return out;
}
function ceil2(out, a) {
  out[0] = Math.ceil(a[0]);
  out[1] = Math.ceil(a[1]);
  out[2] = Math.ceil(a[2]);
  out[3] = Math.ceil(a[3]);
  return out;
}
function floor2(out, a) {
  out[0] = Math.floor(a[0]);
  out[1] = Math.floor(a[1]);
  out[2] = Math.floor(a[2]);
  out[3] = Math.floor(a[3]);
  return out;
}
function min2(out, a, b) {
  out[0] = Math.min(a[0], b[0]);
  out[1] = Math.min(a[1], b[1]);
  out[2] = Math.min(a[2], b[2]);
  out[3] = Math.min(a[3], b[3]);
  return out;
}
function max2(out, a, b) {
  out[0] = Math.max(a[0], b[0]);
  out[1] = Math.max(a[1], b[1]);
  out[2] = Math.max(a[2], b[2]);
  out[3] = Math.max(a[3], b[3]);
  return out;
}
function round2(out, a) {
  out[0] = Math.round(a[0]);
  out[1] = Math.round(a[1]);
  out[2] = Math.round(a[2]);
  out[3] = Math.round(a[3]);
  return out;
}
function scale4(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  out[3] = a[3] * b;
  return out;
}
function scaleAndAdd2(out, a, b, scale7) {
  out[0] = a[0] + b[0] * scale7;
  out[1] = a[1] + b[1] * scale7;
  out[2] = a[2] + b[2] * scale7;
  out[3] = a[3] + b[3] * scale7;
  return out;
}
function distance2(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z = b[2] - a[2];
  var w = b[3] - a[3];
  return Math.hypot(x, y, z, w);
}
function squaredDistance2(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z = b[2] - a[2];
  var w = b[3] - a[3];
  return x * x + y * y + z * z + w * w;
}
function length2(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  return Math.hypot(x, y, z, w);
}
function squaredLength2(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  return x * x + y * y + z * z + w * w;
}
function negate2(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = -a[3];
  return out;
}
function inverse2(out, a) {
  out[0] = 1 / a[0];
  out[1] = 1 / a[1];
  out[2] = 1 / a[2];
  out[3] = 1 / a[3];
  return out;
}
function normalize2(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  var len5 = x * x + y * y + z * z + w * w;
  if (len5 > 0) {
    len5 = 1 / Math.sqrt(len5);
  }
  out[0] = x * len5;
  out[1] = y * len5;
  out[2] = z * len5;
  out[3] = w * len5;
  return out;
}
function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}
function cross2(out, u, v, w) {
  var A = v[0] * w[1] - v[1] * w[0], B = v[0] * w[2] - v[2] * w[0], C = v[0] * w[3] - v[3] * w[0], D = v[1] * w[2] - v[2] * w[1], E = v[1] * w[3] - v[3] * w[1], F = v[2] * w[3] - v[3] * w[2];
  var G = u[0];
  var H = u[1];
  var I = u[2];
  var J = u[3];
  out[0] = H * F - I * E + J * D;
  out[1] = -(G * F) + I * C - J * B;
  out[2] = G * E - H * C + J * A;
  out[3] = -(G * D) + H * B - I * A;
  return out;
}
function lerp2(out, a, b, t) {
  var ax = a[0];
  var ay = a[1];
  var az = a[2];
  var aw = a[3];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  out[2] = az + t * (b[2] - az);
  out[3] = aw + t * (b[3] - aw);
  return out;
}
function random2(out, scale7) {
  scale7 = scale7 || 1;
  var v1, v2, v3, v4;
  var s1, s2;
  do {
    v1 = RANDOM() * 2 - 1;
    v2 = RANDOM() * 2 - 1;
    s1 = v1 * v1 + v2 * v2;
  } while (s1 >= 1);
  do {
    v3 = RANDOM() * 2 - 1;
    v4 = RANDOM() * 2 - 1;
    s2 = v3 * v3 + v4 * v4;
  } while (s2 >= 1);
  var d = Math.sqrt((1 - s1) / s2);
  out[0] = scale7 * v1;
  out[1] = scale7 * v2;
  out[2] = scale7 * v3 * d;
  out[3] = scale7 * v4 * d;
  return out;
}
function transformMat42(out, a, m) {
  var x = a[0], y = a[1], z = a[2], w = a[3];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
  return out;
}
function transformQuat2(out, a, q) {
  var x = a[0], y = a[1], z = a[2];
  var qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  var ix = qw * x + qy * z - qz * y;
  var iy = qw * y + qz * x - qx * z;
  var iz = qw * z + qx * y - qy * x;
  var iw = -qx * x - qy * y - qz * z;
  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  out[3] = a[3];
  return out;
}
function zero2(out) {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  return out;
}
function str4(a) {
  return "vec4(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
}
function exactEquals4(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
function equals5(a, b) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
  var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1, Math.abs(a3), Math.abs(b3));
}
var sub4 = subtract4;
var mul4 = multiply4;
var div2 = divide2;
var dist2 = distance2;
var sqrDist2 = squaredDistance2;
var len2 = length2;
var sqrLen2 = squaredLength2;
var forEach2 = function() {
  var vec = create4();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 4;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }
    return a;
  };
}();

// ../node_modules/gl-matrix/esm/quat.js
function create5() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  out[3] = 1;
  return out;
}
function identity3(out) {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
}
function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
function getAxisAngle(out_axis, q) {
  var rad = Math.acos(q[3]) * 2;
  var s = Math.sin(rad / 2);
  if (s > EPSILON) {
    out_axis[0] = q[0] / s;
    out_axis[1] = q[1] / s;
    out_axis[2] = q[2] / s;
  } else {
    out_axis[0] = 1;
    out_axis[1] = 0;
    out_axis[2] = 0;
  }
  return rad;
}
function getAngle(a, b) {
  var dotproduct = dot3(a, b);
  return Math.acos(2 * dotproduct * dotproduct - 1);
}
function multiply5(out, a, b) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}
function rotateX3(out, a, rad) {
  rad *= 0.5;
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = Math.sin(rad), bw = Math.cos(rad);
  out[0] = ax * bw + aw * bx;
  out[1] = ay * bw + az * bx;
  out[2] = az * bw - ay * bx;
  out[3] = aw * bw - ax * bx;
  return out;
}
function rotateY3(out, a, rad) {
  rad *= 0.5;
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var by = Math.sin(rad), bw = Math.cos(rad);
  out[0] = ax * bw - az * by;
  out[1] = ay * bw + aw * by;
  out[2] = az * bw + ax * by;
  out[3] = aw * bw - ay * by;
  return out;
}
function rotateZ3(out, a, rad) {
  rad *= 0.5;
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bz = Math.sin(rad), bw = Math.cos(rad);
  out[0] = ax * bw + ay * bz;
  out[1] = ay * bw - ax * bz;
  out[2] = az * bw + aw * bz;
  out[3] = aw * bw - az * bz;
  return out;
}
function calculateW(out, a) {
  var x = a[0], y = a[1], z = a[2];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = Math.sqrt(Math.abs(1 - x * x - y * y - z * z));
  return out;
}
function exp(out, a) {
  var x = a[0], y = a[1], z = a[2], w = a[3];
  var r = Math.sqrt(x * x + y * y + z * z);
  var et = Math.exp(w);
  var s = r > 0 ? et * Math.sin(r) / r : 0;
  out[0] = x * s;
  out[1] = y * s;
  out[2] = z * s;
  out[3] = et * Math.cos(r);
  return out;
}
function ln(out, a) {
  var x = a[0], y = a[1], z = a[2], w = a[3];
  var r = Math.sqrt(x * x + y * y + z * z);
  var t = r > 0 ? Math.atan2(r, w) / r : 0;
  out[0] = x * t;
  out[1] = y * t;
  out[2] = z * t;
  out[3] = 0.5 * Math.log(x * x + y * y + z * z + w * w);
  return out;
}
function pow(out, a, b) {
  ln(out, a);
  scale5(out, out, b);
  exp(out, out);
  return out;
}
function slerp(out, a, b, t) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = b[0], by = b[1], bz = b[2], bw = b[3];
  var omega, cosom, sinom, scale0, scale1;
  cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (1 - cosom > EPSILON) {
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    scale0 = 1 - t;
    scale1 = t;
  }
  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
function random3(out) {
  var u1 = RANDOM();
  var u2 = RANDOM();
  var u3 = RANDOM();
  var sqrt1MinusU1 = Math.sqrt(1 - u1);
  var sqrtU1 = Math.sqrt(u1);
  out[0] = sqrt1MinusU1 * Math.sin(2 * Math.PI * u2);
  out[1] = sqrt1MinusU1 * Math.cos(2 * Math.PI * u2);
  out[2] = sqrtU1 * Math.sin(2 * Math.PI * u3);
  out[3] = sqrtU1 * Math.cos(2 * Math.PI * u3);
  return out;
}
function invert3(out, a) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
  var dot5 = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
  var invDot = dot5 ? 1 / dot5 : 0;
  out[0] = -a0 * invDot;
  out[1] = -a1 * invDot;
  out[2] = -a2 * invDot;
  out[3] = a3 * invDot;
  return out;
}
function conjugate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}
function fromMat3(out, m) {
  var fTrace = m[0] + m[4] + m[8];
  var fRoot;
  if (fTrace > 0) {
    fRoot = Math.sqrt(fTrace + 1);
    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    var i = 0;
    if (m[4] > m[0])
      i = 1;
    if (m[8] > m[i * 3 + i])
      i = 2;
    var j = (i + 1) % 3;
    var k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }
  return out;
}
function fromEuler(out, x, y, z) {
  var halfToRad = 0.5 * Math.PI / 180;
  x *= halfToRad;
  y *= halfToRad;
  z *= halfToRad;
  var sx = Math.sin(x);
  var cx = Math.cos(x);
  var sy = Math.sin(y);
  var cy = Math.cos(y);
  var sz = Math.sin(z);
  var cz = Math.cos(z);
  out[0] = sx * cy * cz - cx * sy * sz;
  out[1] = cx * sy * cz + sx * cy * sz;
  out[2] = cx * cy * sz - sx * sy * cz;
  out[3] = cx * cy * cz + sx * sy * sz;
  return out;
}
function str5(a) {
  return "quat(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
}
var clone5 = clone4;
var fromValues5 = fromValues4;
var copy5 = copy4;
var set5 = set4;
var add5 = add4;
var mul5 = multiply5;
var scale5 = scale4;
var dot3 = dot2;
var lerp3 = lerp2;
var length3 = length2;
var len3 = length3;
var squaredLength3 = squaredLength2;
var sqrLen3 = squaredLength3;
var normalize3 = normalize2;
var exactEquals5 = exactEquals4;
var equals6 = equals5;
var rotationTo = function() {
  var tmpvec3 = create3();
  var xUnitVec3 = fromValues3(1, 0, 0);
  var yUnitVec3 = fromValues3(0, 1, 0);
  return function(out, a, b) {
    var dot5 = dot(a, b);
    if (dot5 < -0.999999) {
      cross(tmpvec3, xUnitVec3, a);
      if (len(tmpvec3) < 1e-6)
        cross(tmpvec3, yUnitVec3, a);
      normalize(tmpvec3, tmpvec3);
      setAxisAngle(out, tmpvec3, Math.PI);
      return out;
    } else if (dot5 > 0.999999) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
      return out;
    } else {
      cross(tmpvec3, a, b);
      out[0] = tmpvec3[0];
      out[1] = tmpvec3[1];
      out[2] = tmpvec3[2];
      out[3] = 1 + dot5;
      return normalize3(out, out);
    }
  };
}();
var sqlerp = function() {
  var temp1 = create5();
  var temp2 = create5();
  return function(out, a, b, c, d, t) {
    slerp(temp1, a, d, t);
    slerp(temp2, b, c, t);
    slerp(out, temp1, temp2, 2 * t * (1 - t));
    return out;
  };
}();
var setAxes = function() {
  var matr = create();
  return function(out, view, right, up) {
    matr[0] = right[0];
    matr[3] = right[1];
    matr[6] = right[2];
    matr[1] = up[0];
    matr[4] = up[1];
    matr[7] = up[2];
    matr[2] = -view[0];
    matr[5] = -view[1];
    matr[8] = -view[2];
    return normalize3(out, fromMat3(out, matr));
  };
}();

// ../node_modules/gl-matrix/esm/vec2.js
var vec2_exports = {};
__export(vec2_exports, {
  add: () => add6,
  angle: () => angle2,
  ceil: () => ceil3,
  clone: () => clone6,
  copy: () => copy6,
  create: () => create6,
  cross: () => cross3,
  dist: () => dist3,
  distance: () => distance3,
  div: () => div3,
  divide: () => divide3,
  dot: () => dot4,
  equals: () => equals7,
  exactEquals: () => exactEquals6,
  floor: () => floor3,
  forEach: () => forEach3,
  fromValues: () => fromValues6,
  inverse: () => inverse3,
  len: () => len4,
  length: () => length4,
  lerp: () => lerp4,
  max: () => max3,
  min: () => min3,
  mul: () => mul6,
  multiply: () => multiply6,
  negate: () => negate3,
  normalize: () => normalize4,
  random: () => random4,
  rotate: () => rotate3,
  round: () => round3,
  scale: () => scale6,
  scaleAndAdd: () => scaleAndAdd3,
  set: () => set6,
  sqrDist: () => sqrDist3,
  sqrLen: () => sqrLen4,
  squaredDistance: () => squaredDistance3,
  squaredLength: () => squaredLength4,
  str: () => str6,
  sub: () => sub5,
  subtract: () => subtract5,
  transformMat2: () => transformMat2,
  transformMat2d: () => transformMat2d,
  transformMat3: () => transformMat32,
  transformMat4: () => transformMat43,
  zero: () => zero3
});
function create6() {
  var out = new ARRAY_TYPE(2);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
  }
  return out;
}
function clone6(a) {
  var out = new ARRAY_TYPE(2);
  out[0] = a[0];
  out[1] = a[1];
  return out;
}
function fromValues6(x, y) {
  var out = new ARRAY_TYPE(2);
  out[0] = x;
  out[1] = y;
  return out;
}
function copy6(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  return out;
}
function set6(out, x, y) {
  out[0] = x;
  out[1] = y;
  return out;
}
function add6(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
}
function subtract5(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  return out;
}
function multiply6(out, a, b) {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  return out;
}
function divide3(out, a, b) {
  out[0] = a[0] / b[0];
  out[1] = a[1] / b[1];
  return out;
}
function ceil3(out, a) {
  out[0] = Math.ceil(a[0]);
  out[1] = Math.ceil(a[1]);
  return out;
}
function floor3(out, a) {
  out[0] = Math.floor(a[0]);
  out[1] = Math.floor(a[1]);
  return out;
}
function min3(out, a, b) {
  out[0] = Math.min(a[0], b[0]);
  out[1] = Math.min(a[1], b[1]);
  return out;
}
function max3(out, a, b) {
  out[0] = Math.max(a[0], b[0]);
  out[1] = Math.max(a[1], b[1]);
  return out;
}
function round3(out, a) {
  out[0] = Math.round(a[0]);
  out[1] = Math.round(a[1]);
  return out;
}
function scale6(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  return out;
}
function scaleAndAdd3(out, a, b, scale7) {
  out[0] = a[0] + b[0] * scale7;
  out[1] = a[1] + b[1] * scale7;
  return out;
}
function distance3(a, b) {
  var x = b[0] - a[0], y = b[1] - a[1];
  return Math.hypot(x, y);
}
function squaredDistance3(a, b) {
  var x = b[0] - a[0], y = b[1] - a[1];
  return x * x + y * y;
}
function length4(a) {
  var x = a[0], y = a[1];
  return Math.hypot(x, y);
}
function squaredLength4(a) {
  var x = a[0], y = a[1];
  return x * x + y * y;
}
function negate3(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  return out;
}
function inverse3(out, a) {
  out[0] = 1 / a[0];
  out[1] = 1 / a[1];
  return out;
}
function normalize4(out, a) {
  var x = a[0], y = a[1];
  var len5 = x * x + y * y;
  if (len5 > 0) {
    len5 = 1 / Math.sqrt(len5);
  }
  out[0] = a[0] * len5;
  out[1] = a[1] * len5;
  return out;
}
function dot4(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
function cross3(out, a, b) {
  var z = a[0] * b[1] - a[1] * b[0];
  out[0] = out[1] = 0;
  out[2] = z;
  return out;
}
function lerp4(out, a, b, t) {
  var ax = a[0], ay = a[1];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  return out;
}
function random4(out, scale7) {
  scale7 = scale7 || 1;
  var r = RANDOM() * 2 * Math.PI;
  out[0] = Math.cos(r) * scale7;
  out[1] = Math.sin(r) * scale7;
  return out;
}
function transformMat2(out, a, m) {
  var x = a[0], y = a[1];
  out[0] = m[0] * x + m[2] * y;
  out[1] = m[1] * x + m[3] * y;
  return out;
}
function transformMat2d(out, a, m) {
  var x = a[0], y = a[1];
  out[0] = m[0] * x + m[2] * y + m[4];
  out[1] = m[1] * x + m[3] * y + m[5];
  return out;
}
function transformMat32(out, a, m) {
  var x = a[0], y = a[1];
  out[0] = m[0] * x + m[3] * y + m[6];
  out[1] = m[1] * x + m[4] * y + m[7];
  return out;
}
function transformMat43(out, a, m) {
  var x = a[0];
  var y = a[1];
  out[0] = m[0] * x + m[4] * y + m[12];
  out[1] = m[1] * x + m[5] * y + m[13];
  return out;
}
function rotate3(out, a, b, rad) {
  var p0 = a[0] - b[0], p1 = a[1] - b[1], sinC = Math.sin(rad), cosC = Math.cos(rad);
  out[0] = p0 * cosC - p1 * sinC + b[0];
  out[1] = p0 * sinC + p1 * cosC + b[1];
  return out;
}
function angle2(a, b) {
  var x1 = a[0], y1 = a[1], x2 = b[0], y2 = b[1], mag = Math.sqrt(x1 * x1 + y1 * y1) * Math.sqrt(x2 * x2 + y2 * y2), cosine = mag && (x1 * x2 + y1 * y2) / mag;
  return Math.acos(Math.min(Math.max(cosine, -1), 1));
}
function zero3(out) {
  out[0] = 0;
  out[1] = 0;
  return out;
}
function str6(a) {
  return "vec2(" + a[0] + ", " + a[1] + ")";
}
function exactEquals6(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
function equals7(a, b) {
  var a0 = a[0], a1 = a[1];
  var b0 = b[0], b1 = b[1];
  return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1));
}
var len4 = length4;
var sub5 = subtract5;
var mul6 = multiply6;
var div3 = divide3;
var dist3 = distance3;
var sqrDist3 = squaredDistance3;
var sqrLen4 = squaredLength4;
var forEach3 = function() {
  var vec = create6();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 2;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
    }
    return a;
  };
}();

// device.ts
function getDeviceProfile(tier, resolutionScaling) {
  const outline = tier > 2;
  const maxGPUBytes = [5e8, 75e7, 2e9, 5e9][tier];
  const maxPrimitives = [2e7, 2e7, 2e7, 5e7][tier];
  const maxSamples = [4, 4, 8, 16][tier];
  const detailBias = [0.25, 0.5, 0.75, 1][tier];
  let renderResolution = [0.5, 0.75, 1, 1][tier];
  if (resolutionScaling) {
    renderResolution *= resolutionScaling;
  }
  let adreno600 = false;
  let slowShaderRecompile = false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
  canvas.remove();
  if (gl) {
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl?.VERSION);
    if (RegExp("Adreno.+6[0-9][0-9]").test(renderer)) {
      adreno600 = true;
    } else if (RegExp("Apple M1").test(renderer) || RegExp("Iris").test(renderer)) {
      slowShaderRecompile = true;
    }
  }
  const coreProfile = {
    features: {
      outline
    },
    limits: {
      maxGPUBytes,
      maxPrimitives,
      maxSamples
    },
    quirks: {
      adreno600,
      slowShaderRecompile
    },
    detailBias
  };
  return {
    ...coreProfile,
    renderResolution,
    framerateTarget: 30
  };
}

// ../webgl2/blit.ts
function glBlit(gl, params) {
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  let mask = 0;
  if (params.color)
    mask |= gl.COLOR_BUFFER_BIT;
  if (params.depth)
    mask |= gl.DEPTH_BUFFER_BIT;
  if (params.stencil)
    mask |= gl.STENCIL_BUFFER_BIT;
  const filter = gl[params.filter ?? "NEAREST"];
  const srcX0 = params.srcX0 ?? 0;
  const srcY0 = params.srcY0 ?? 0;
  const srcX1 = params.srcX1 ?? w;
  const srcY1 = params.srcY1 ?? h;
  const dstX0 = params.dstX0 ?? 0;
  const dstY0 = params.dstY0 ?? 0;
  const dstX1 = params.dstX1 ?? w;
  const dstY1 = params.dstY1 ?? h;
  const src = params.source == null ? null : params.source;
  const dst = params.destination == null ? null : params.destination;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
  gl.blitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// ../webgl2/buffer.ts
function glCreateBuffer(gl, params) {
  const target = gl[params.kind];
  const usage = gl[params.usage ?? "STATIC_DRAW"];
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  if ("byteSize" in params) {
    gl.bufferData(target, params.byteSize, usage);
  } else {
    gl.bufferData(target, params.srcData, usage);
  }
  gl.bindBuffer(target, null);
  return buffer;
}
function glUpdateBuffer(gl, params) {
  const target = gl[params.kind];
  const srcOffset = params.srcElementOffset ?? 0;
  const targetOffset = params.dstByteOffset ?? 0;
  const src = params.srcData;
  const srcData = ArrayBuffer.isView(src) ? src : new Uint8Array(src);
  gl.bindBuffer(target, params.targetBuffer);
  gl.bufferSubData(target, targetOffset, srcData, srcOffset, params.byteSize);
  gl.bindBuffer(target, null);
}

// ../webgl2/clear.ts
function glClear(gl, params) {
  const { kind } = params;
  switch (kind) {
    case "back_buffer": {
      let bits = 0;
      if (params.color != void 0) {
        gl.clearColor(...params.color);
        bits |= gl.COLOR_BUFFER_BIT;
      }
      if (params.depth != void 0) {
        gl.clearDepth(params.depth);
        bits |= gl.DEPTH_BUFFER_BIT;
      }
      if (params.stencil != void 0) {
        gl.clearStencil(params.stencil);
        bits |= gl.STENCIL_BUFFER_BIT;
      }
      if (bits) {
        gl.clear(bits);
      }
      break;
    }
    case "DEPTH":
    case "STENCIL":
    case "DEPTH_STENCIL": {
      const { drawBuffer } = params;
      const depth = "depth" in params ? params.depth : 1;
      const stencil = "stencil" in params ? params.stencil : 0;
      gl.clearBufferfi(gl[kind], drawBuffer ?? 0, depth, stencil);
      break;
    }
    case "COLOR": {
      const { drawBuffer } = params;
      const type = params.type ?? "Float";
      const target = gl.COLOR;
      const color = params.color ?? [0, 0, 0, 0];
      switch (type) {
        case "Float":
          gl.clearBufferfv(target, drawBuffer ?? 0, color);
          break;
        case "Int":
          gl.clearBufferiv(target, drawBuffer ?? 0, color);
          break;
        case "Uint":
          gl.clearBufferuiv(target, drawBuffer ?? 0, color);
          break;
        default:
          exhaustiveColorCheck(type);
      }
      break;
    }
    default:
      exhaustiveBufferCheck(kind);
  }
}
function exhaustiveBufferCheck(value) {
  throw new Error(`Unknown buffer type: ${value}!`);
}
function exhaustiveColorCheck(value) {
  throw new Error(`Unknown clear color type: ${value}!`);
}

// ../webgl2/extensions.ts
function glExtensions(gl, refresh = false) {
  let ext = glExtensionsMap.get(gl);
  if (!ext || refresh) {
    ext = getWebGL2Extensions(gl);
    glExtensionsMap.set(gl, ext);
  }
  return ext;
}
function getWebGL2Extensions(gl) {
  return {
    colorBufferFloat: gl.getExtension("EXT_color_buffer_float"),
    // also includes half floats
    parallelShaderCompile: gl.getExtension("KHR_parallel_shader_compile"),
    loseContext: gl.getExtension("WEBGL_lose_context"),
    multiDraw: gl.getExtension("WEBGL_MULTI_DRAW"),
    drawBuffersIndexed: gl.getExtension("OES_draw_buffers_indexed"),
    disjointTimerQuery: gl.getExtension("EXT_disjoint_timer_query_webgl2"),
    provokingVertex: gl.getExtension("WEBGL_provoking_vertex")
  };
}
var glExtensionsMap = /* @__PURE__ */ new WeakMap();

// ../webgl2/draw.ts
function glDraw(gl, params) {
  let numPrimitives = 0;
  const mode = params.mode ?? "TRIANGLES";
  const primitiveType = gl[mode];
  if (isMultiDraw(params)) {
    const { multiDraw } = glExtensions(gl);
    if (multiDraw) {
      const { drawCount, counts, countsOffset } = params;
      switch (params.kind) {
        case "arrays_multidraw":
          const { firstsList, firstsOffset } = params;
          multiDraw.multiDrawArraysWEBGL(primitiveType, firstsList, firstsOffset ?? 0, counts, countsOffset ?? 0, drawCount);
          break;
        case "elements_multidraw":
          const { byteOffsets, byteOffsetsOffset, indexType } = params;
          multiDraw.multiDrawElementsWEBGL(primitiveType, counts, countsOffset ?? 0, gl[indexType], byteOffsets, byteOffsetsOffset ?? 0, drawCount);
          break;
      }
      const offs = countsOffset ?? 0;
      for (let i = 0; i < drawCount; i++) {
        numPrimitives += calcNumPrimitives(counts[i + offs], mode);
      }
    } else {
      console.warn("no multi_draw gl extension!");
    }
  } else {
    const { count } = params;
    if (isInstanced(params)) {
      const { instanceCount } = params;
      numPrimitives = calcNumPrimitives(count, mode) * instanceCount;
      if (isElements(params)) {
        gl.drawElementsInstanced(primitiveType, count, gl[params.indexType], params.byteOffset ?? 0, instanceCount);
      } else {
        gl.drawArraysInstanced(primitiveType, params.first ?? 0, count, instanceCount);
      }
    } else {
      numPrimitives = calcNumPrimitives(count, mode);
      if (isElements(params)) {
        if (isRange(params)) {
          gl.drawRangeElements(primitiveType, params.minIndex, params.maxIndex, count, gl[params.indexType], params.byteOffset ?? 0);
        } else {
          gl.drawElements(primitiveType, count, gl[params.indexType], params.byteOffset ?? 0);
        }
      } else {
        gl.drawArrays(primitiveType, params.first ?? 0, count);
      }
    }
  }
  if (primitiveType >= gl.TRIANGLES) {
    return { points: 0, lines: 0, triangles: numPrimitives };
  } else if (primitiveType >= gl.LINES) {
    return { points: 0, lines: numPrimitives, triangles: 0 };
  } else {
    return { points: numPrimitives, lines: 0, triangles: 0 };
  }
}
function calcNumPrimitives(vertexCount, primitiveType) {
  switch (primitiveType) {
    case "TRIANGLES":
      return vertexCount / 3;
    case "TRIANGLE_STRIP":
    case "TRIANGLE_FAN":
      return vertexCount - 2;
    case "LINES":
      return vertexCount / 2;
    case "LINE_STRIP":
      return vertexCount - 1;
    default:
      return vertexCount;
  }
}
function isInstanced(params) {
  return "instanceCount" in params && params.instanceCount != void 0;
}
function isElements(params) {
  return "indexType" in params && params.indexType != void 0;
}
function isRange(params) {
  return "start" in params && "end" in params && params.start != void 0;
}
function isMultiDraw(params) {
  return "drawCount" in params && params.drawCount != void 0;
}

// ../webgl2/limits.ts
function glLimits(gl) {
  let ext = glLimitsMap.get(gl);
  if (!ext) {
    ext = getWebGL2Limits(gl);
    glLimitsMap.set(gl, ext);
  }
  return ext;
}
var glLimitsMap = /* @__PURE__ */ new WeakMap();
function getWebGL2Limits(gl) {
  const names = [
    "MAX_TEXTURE_SIZE",
    "MAX_VIEWPORT_DIMS",
    "MAX_TEXTURE_IMAGE_UNITS",
    "MAX_VERTEX_UNIFORM_VECTORS",
    "MAX_VARYING_VECTORS",
    "MAX_VERTEX_ATTRIBS",
    "MAX_COMBINED_TEXTURE_IMAGE_UNITS",
    "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
    "MAX_TEXTURE_IMAGE_UNITS",
    "MAX_FRAGMENT_UNIFORM_VECTORS",
    "MAX_CUBE_MAP_TEXTURE_SIZE",
    "MAX_RENDERBUFFER_SIZE",
    "MAX_3D_TEXTURE_SIZE",
    "MAX_ELEMENTS_VERTICES",
    "MAX_ELEMENTS_INDICES",
    "MAX_TEXTURE_LOD_BIAS",
    "MAX_FRAGMENT_UNIFORM_COMPONENTS",
    "MAX_VERTEX_UNIFORM_COMPONENTS",
    "MAX_ARRAY_TEXTURE_LAYERS",
    "MIN_PROGRAM_TEXEL_OFFSET",
    "MAX_PROGRAM_TEXEL_OFFSET",
    "MAX_VARYING_COMPONENTS",
    "MAX_VERTEX_OUTPUT_COMPONENTS",
    "MAX_FRAGMENT_INPUT_COMPONENTS",
    "MAX_SERVER_WAIT_TIMEOUT",
    "MAX_ELEMENT_INDEX",
    "MAX_DRAW_BUFFERS",
    "MAX_COLOR_ATTACHMENTS",
    "MAX_SAMPLES",
    "MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS",
    "MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS",
    "MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS",
    "MAX_VERTEX_UNIFORM_BLOCKS",
    "MAX_FRAGMENT_UNIFORM_BLOCKS",
    "MAX_COMBINED_UNIFORM_BLOCKS",
    "MAX_UNIFORM_BUFFER_BINDINGS",
    "MAX_UNIFORM_BLOCK_SIZE",
    "MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS",
    "MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS"
  ];
  const limits = {};
  for (const name of names) {
    limits[name] = gl.getParameter(gl[name]);
  }
  return limits;
}

// ../webgl2/frameBuffer.ts
function glCreateFrameBuffer(gl, params) {
  const frameBuffer = gl.createFramebuffer();
  const limits = glLimits(gl);
  console.assert(params.color.length <= limits.MAX_COLOR_ATTACHMENTS);
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  function bind(binding, attachment) {
    const target = gl[binding.kind];
    if (isTextureAttachment(binding)) {
      const { texture } = binding;
      if (binding.layer === void 0) {
        const texTarget = gl[binding.texTarget ?? "TEXTURE_2D"];
        gl.framebufferTexture2D(target, attachment, texTarget, texture, binding.level ?? 0);
      } else {
        gl.framebufferTextureLayer(target, attachment, texture, binding.level ?? 0, binding.layer);
      }
    } else {
      const { renderBuffer } = binding;
      gl.framebufferRenderbuffer(target, attachment, gl.RENDERBUFFER, renderBuffer);
    }
  }
  if (params.depth)
    bind(params.depth, gl.DEPTH_ATTACHMENT);
  if (params.stencil)
    bind(params.stencil, gl.STENCIL_ATTACHMENT);
  let i = gl.COLOR_ATTACHMENT0;
  for (const color of params.color) {
    if (color) {
      bind(color, i);
    }
    i++;
  }
  const debug = false;
  if (debug) {
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    switch (status) {
      case gl.FRAMEBUFFER_COMPLETE:
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        throw new Error("Framebuffer incomplete attachment!");
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        throw new Error("Framebuffer missing attachment!");
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        throw new Error("Framebuffer incomplete dimensions!");
      case gl.FRAMEBUFFER_UNSUPPORTED:
        throw new Error("Framebuffer unsupported!");
      case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
        throw new Error("Framebuffer incomplete multisample!");
      default:
        throw new Error("Unknown framebuffer error!");
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return frameBuffer;
}
function glInvalidateFrameBuffer(gl, params) {
  if (!params.frameBuffer) {
    return;
  }
  const attachments = [];
  if (params.depth && params.stencil) {
    attachments.push(gl.DEPTH_STENCIL_ATTACHMENT);
  } else if (params.depth) {
    attachments.push(gl.DEPTH_ATTACHMENT);
  } else if (params.stencil) {
    attachments.push(gl.STENCIL_ATTACHMENT);
  }
  let i = 0;
  for (const invalidate of params.color) {
    if (invalidate) {
      attachments.push(gl.COLOR_ATTACHMENT0 + i);
    }
    i++;
  }
  const { frameBuffer, kind } = params;
  const target = gl[kind];
  gl.bindFramebuffer(target, frameBuffer);
  gl.invalidateFramebuffer(target, attachments);
  gl.bindFramebuffer(target, null);
}
function isTextureAttachment(attachment) {
  return typeof attachment == "object" && "texture" in attachment;
}

// ../webgl2/misc.ts
function getBufferViewType(type) {
  switch (type) {
    case "BYTE":
      return Int8Array;
    case "UNSIGNED_BYTE":
      return Uint8Array;
    case "SHORT":
      return Int16Array;
    case "UNSIGNED_SHORT_5_6_5":
    case "UNSIGNED_SHORT_4_4_4_4":
    case "UNSIGNED_SHORT_5_5_5_1":
    case "HALF_FLOAT":
    case "HALF_FLOAT_OES":
      return Uint16Array;
    case "UNSIGNED_INT":
    case "UNSIGNED_INT_24_8_WEBGL":
    case "UNSIGNED_INT_5_9_9_9_REV":
    case "UNSIGNED_INT_2_10_10_10_REV":
    case "UNSIGNED_INT_10F_11F_11F_REV":
      return Uint32Array;
    case "INT":
      return Int32Array;
    case "FLOAT":
      return Float32Array;
  }
  throw new Error(`Unknown buffer type: ${type}!`);
}

// ../webgl2/program.ts
function* glShaderExtensions(gl) {
  if (glExtensions(gl).multiDraw) {
    yield {
      name: "GL_ANGLE_multi_draw",
      behaviour: "require"
    };
  }
}
function glCompile(gl, params) {
  const source = params.shader;
  const shader = gl.createShader(gl[params.kind]);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}
function glCreateProgramAsync(gl, params) {
  const { header } = params;
  const headerCode = formatHeader(gl, header);
  const vertex = glCompile(gl, { kind: "VERTEX_SHADER", shader: headerCode + params.vertexShader });
  const fragment = glCompile(gl, { kind: "FRAGMENT_SHADER", shader: headerCode + (params.fragmentShader ?? "void main() {}") });
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  return { program, vertex, fragment };
}
function glCheckProgram(gl, params) {
  const { program, vertex, fragment } = params;
  if (gl.getProgramParameter(program, gl.LINK_STATUS) || gl.isContextLost()) {
    console.assert(gl.getProgramParameter(program, gl.ATTACHED_SHADERS) == 2);
    gl.detachShader(program, vertex);
    gl.detachShader(program, fragment);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  } else {
    const status = { link: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment) };
    return status;
  }
}
function glCreateProgram(gl, params) {
  const { flags, transformFeedback, uniformBufferBlocks, textureUniforms, headerChunk, commonChunk } = params;
  const extensions = [];
  if (glExtensions(gl).multiDraw) {
    extensions.push("#extension GL_ANGLE_multi_draw : require\n");
  }
  const defaultHeader = `#version 300 es
${extensions.join("")}precision highp float;
precision highp int;
precision highp usampler2D;
`;
  const header = headerChunk ?? defaultHeader;
  const defines = flags?.map((flag) => `#define ${flag}
`)?.join("") ?? "";
  const common = commonChunk ?? "";
  const vs = header + defines + common + params.vertexShader;
  const fs = header + defines + common + (params.fragmentShader ?? "void main() {}");
  const vertexShader = compileShader(gl, "VERTEX_SHADER", vs);
  const fragmentShader = compileShader(gl, "FRAGMENT_SHADER", fs);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  if (transformFeedback) {
    const { varyings, bufferMode } = transformFeedback;
    gl.transformFeedbackVaryings(program, varyings, gl[bufferMode]);
  }
  gl.linkProgram(program);
  gl.validateProgram(program);
  gl.detachShader(program, vertexShader);
  gl.detachShader(program, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error(`Failed to compile link shaders!\r
${gl.getProgramInfoLog(program)}`);
  gl.useProgram(program);
  if (uniformBufferBlocks) {
    let idx = 0;
    for (const name of uniformBufferBlocks) {
      if (name) {
        const blockIndex = gl.getUniformBlockIndex(program, name);
        if (blockIndex != gl.INVALID_INDEX) {
          gl.uniformBlockBinding(program, blockIndex, idx);
        } else {
          console.warn(`Shader has no uniform block named: ${name}!`);
        }
      }
      idx++;
    }
  }
  if (textureUniforms) {
    let i = 0;
    for (const name of textureUniforms) {
      const location = gl.getUniformLocation(program, name);
      gl.uniform1i(location, i++);
    }
  }
  gl.useProgram(null);
  return program;
}
function compileShader(gl, type, source) {
  const shader = gl.createShader(gl[type]);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const typeName = type.split("_")[0].toLocaleLowerCase();
    const errorMsg = gl.getShaderInfoLog(shader);
    throw new Error(`: Failed to compile glsl ${typeName} shader!\r
${errorMsg}`);
  }
  return shader;
}
function defaultHeaderParams(gl) {
  return {
    version: "300 es",
    extensions: [...glShaderExtensions(gl)],
    defaultPrecisions: {
      float: "high",
      int: "high",
      sampler2D: "high",
      samplerCube: "high",
      sampler3D: "high",
      samplerCubeShadow: "high",
      sampler2DShadow: "high",
      sampler2DArray: "high",
      sampler2DArrayShadow: "high",
      isampler2D: "high",
      isampler3D: "high",
      isamplerCube: "high",
      isampler2DArray: "high",
      usampler2D: "high",
      usampler3D: "high",
      usamplerCube: "high",
      usampler2DArray: "high"
    },
    flags: [],
    defines: [],
    commonChunk: ""
  };
}
function formatHeader(gl, params) {
  if (!params)
    return "";
  if (typeof params == "string")
    return params;
  const p = { ...defaultHeaderParams(gl), ...params };
  const version = `#version ${p.version}
`;
  const extensions = p.extensions.map((ext) => `#extension ${ext.name} : ${ext.behaviour}
`).join("");
  const precisions = Object.entries(p.defaultPrecisions).map(([type, precision]) => `precision ${precision}p ${type};
`).join("");
  const flags = p.flags.map((flag) => `#define ${flag}
`).join("");
  const defines = p.defines.map((def) => `#define ${def.name} ${def.value}
`).join("");
  const common = p.commonChunk;
  const header = version + extensions + precisions + flags + defines + common;
  return header;
}

// ../webgl2/read.ts
function glReadPixels(gl, params) {
  const x = params.x ?? 0;
  const y = params.y ?? 0;
  const width = params.width ?? gl.drawingBufferWidth;
  const height = params.height ?? gl.drawingBufferHeight;
  gl.bindFramebuffer(gl.FRAMEBUFFER, params.frameBuffer);
  for (const { buffer, attachment, format, type } of params.buffers) {
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.readBuffer(gl[attachment]);
    gl.readPixels(x, y, width, height, gl[format], gl[type], 0);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  gl.readBuffer(gl.BACK);
}

// ../webgl2/renderBuffer.ts
function glCreateRenderbuffer(gl, params) {
  const limits = glLimits(gl);
  const buffer = gl.createRenderbuffer();
  const { internalFormat, width, height } = params;
  const samples = params.samples == void 0 ? 1 : params.samples === "max" ? limits.MAX_SAMPLES : params.samples;
  console.assert(samples <= limits.MAX_SAMPLES);
  gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
  if (params.samples === void 0) {
    gl.renderbufferStorage(gl.RENDERBUFFER, gl[internalFormat], width, height);
  } else {
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl[internalFormat], width, height);
  }
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  return buffer;
}

// ../webgl2/sampler.ts
function glCreateSampler(gl, params) {
  const sampler = gl.createSampler();
  gl.bindSampler(0, sampler);
  const { minificationFilter, magnificationFilter, minLOD, maxLOD, wrap, compareFunction, compareMode } = params;
  if (minificationFilter)
    gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl[minificationFilter]);
  if (magnificationFilter)
    gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, gl[magnificationFilter]);
  if (wrap) {
    const [s, t, r] = wrap;
    gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl[s]);
    gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl[t]);
    if (r)
      gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_R, gl[r]);
  }
  if (minLOD)
    gl.samplerParameterf(sampler, gl.TEXTURE_MIN_LOD, minLOD);
  if (maxLOD)
    gl.samplerParameterf(sampler, gl.TEXTURE_MAX_LOD, maxLOD);
  if (compareFunction)
    gl.samplerParameteri(sampler, gl.TEXTURE_COMPARE_FUNC, gl[compareFunction]);
  if (compareMode)
    gl.samplerParameteri(sampler, gl.TEXTURE_COMPARE_MODE, gl[compareMode]);
  return sampler;
}

// ../webgl2/state.ts
function glState(gl, params) {
  if (!params) {
    const limits = glLimits(gl);
    params = glDefaultState(limits);
  }
  const { blend, cull, depth, polygon, sample, scissor, stencil, frameBuffer, vertexArrayObject, drawBuffers, attributeDefaults, textures, uniforms, uniformBuffers } = params;
  function setFlag(cap, value) {
    if (value !== void 0) {
      if (value) {
        gl.enable(gl[cap]);
      } else {
        gl.disable(gl[cap]);
      }
    }
  }
  function set7(setter, values, defaultValues, ...keys) {
    if (keys.some((key) => values[key] !== void 0)) {
      const args = keys.map((key) => {
        const v = values[key] ?? defaultValues[key];
        return typeof v == "string" ? gl[v] : v;
      });
      setter.apply(gl, args);
    }
  }
  setFlag("DITHER", params.ditherEnable);
  setFlag("RASTERIZER_DISCARD", params.rasterizerDiscard);
  set7((rgba) => {
    gl.colorMask(...rgba);
  }, params, "colorMask");
  set7((rect) => gl.viewport(rect.x ?? 0, rect.y ?? 0, rect.width, rect.height), params, defaultConstants, "viewport");
  if (blend) {
    const defaultValues = defaultConstants.blend;
    const { drawBuffersIndexed } = glExtensions(gl);
    if (drawBuffersIndexed) {
      if (blend.enable) {
        drawBuffersIndexed.enableiOES(gl.BLEND, 0);
      } else {
        drawBuffersIndexed.disableiOES(gl.BLEND, 0);
      }
      set7((modeRGB, modeAlpha) => drawBuffersIndexed.blendEquationSeparateiOES(0, modeRGB, modeAlpha), blend, defaultValues, "equationRGB", "equationAlpha");
      set7((srcRGB, dstRGB, srcAlpha, dstAlpha) => drawBuffersIndexed.blendFuncSeparateiOES(0, srcRGB, dstRGB, srcAlpha, dstAlpha), blend, defaultValues, "srcRGB", "dstRGB", "srcAlpha", "dstAlpha");
    } else {
      setFlag("BLEND", blend.enable);
      set7(gl.blendEquationSeparate, blend, defaultValues, "equationRGB", "equationAlpha");
      set7(gl.blendFuncSeparate, blend, defaultValues, "srcRGB", "dstRGB", "srcAlpha", "dstAlpha");
    }
    set7((rgba) => {
      gl.blendColor(...rgba);
    }, blend, defaultValues, "color");
  }
  if (cull) {
    const defaultValues = defaultConstants.cull;
    setFlag("CULL_FACE", cull.enable);
    set7(gl.cullFace, cull, defaultValues, "mode");
    set7(gl.frontFace, cull, defaultValues, "frontFace");
  }
  if (depth) {
    const defaultValues = defaultConstants.depth;
    setFlag("DEPTH_TEST", depth.test);
    set7(gl.depthFunc, depth, defaultValues, "func");
    set7(gl.depthMask, depth, defaultValues, "writeMask");
    set7((range) => gl.depthRange(...range), depth, defaultValues, "range");
  }
  if (polygon) {
    const defaultValues = defaultConstants.polygon;
    setFlag("POLYGON_OFFSET_FILL", polygon.offsetFill);
    set7(gl.polygonOffset, polygon, defaultValues, "offsetFactor", "offsetUnits");
  }
  if (sample) {
    const defaultValues = defaultConstants.sample;
    setFlag("SAMPLE_ALPHA_TO_COVERAGE", sample.alphaToCoverage);
    setFlag("SAMPLE_COVERAGE", sample.coverage);
    set7(gl.sampleCoverage, sample, defaultValues, "coverageValue", "coverageInvert");
  }
  if (scissor) {
    const defaultValues = defaultConstants.scissor;
    setFlag("SCISSOR_TEST", scissor.test);
    set7((rect) => gl.scissor(rect.x ?? 0, rect.y ?? 0, rect.width, rect.height), scissor, defaultValues, "box");
  }
  if (stencil) {
    const defaultValues = defaultConstants.stencil;
    setFlag("STENCIL_TEST", stencil.test);
    set7((func, ref, mask) => gl.stencilFuncSeparate(gl.FRONT, func, ref, mask), stencil, defaultValues, "func", "ref", "valueMask");
    set7((func, ref, mask) => gl.stencilFuncSeparate(gl.BACK, func, ref, mask), stencil, defaultValues, "backFunc", "backRef", "backValueMask");
  }
  if (vertexArrayObject !== void 0) {
    gl.bindVertexArray(vertexArrayObject);
  }
  if (frameBuffer !== void 0) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  }
  if (drawBuffers) {
    gl.drawBuffers(drawBuffers.map((b) => gl[b]));
  }
  const { program } = params;
  if (program !== void 0) {
    gl.useProgram(program);
  }
  if (attributeDefaults) {
    for (let i = 0; i < attributeDefaults.length; i++) {
      const defaults = attributeDefaults[i];
      if (defaults) {
        const { type, values } = defaults;
        gl[`vertexAttrib${type}v`](i, values);
      }
    }
  }
  if (textures) {
    const texture0 = gl.TEXTURE0;
    for (let i = 0; i < textures.length; i++) {
      const binding = textures[i];
      const texture = binding?.texture ?? null;
      gl.activeTexture(texture0 + i);
      gl.bindTexture(gl[binding?.kind ?? "TEXTURE_2D"], texture);
      const sampler = binding?.sampler ?? null;
      gl.bindSampler(i, sampler);
      gl.uniform1i(binding?.uniform ?? null, i);
    }
    gl.activeTexture(texture0);
  }
  if (uniforms) {
    let isMatrix3 = function(binding) {
      return binding.kind.startsWith("Matrix");
    }, isScalar2 = function(binding) {
      return binding.kind.startsWith("1");
    };
    var isMatrix2 = isMatrix3, isScalar = isScalar2;
    for (const binding of uniforms) {
      if (isMatrix3(binding)) {
        const methodName = `uniform${binding.kind}v`;
        gl[methodName](binding.location, binding.transpose ?? false, binding.value);
      } else if (isScalar2(binding)) {
        const methodName = `uniform${binding.kind}`;
        gl[methodName](binding.location, binding.value);
      } else {
        const methodName = `uniform${binding.kind}v`;
        gl[methodName](binding.location, binding.value);
      }
    }
  }
  if (uniformBuffers) {
    let idx = 0;
    for (const uniformBindingParams of uniformBuffers) {
      if (uniformBindingParams === void 0)
        continue;
      if (isUniformBufferBindingRange(uniformBindingParams)) {
        const { buffer, byteOffset, byteSize } = uniformBindingParams;
        gl.bindBufferRange(gl.UNIFORM_BUFFER, idx, buffer, byteOffset, byteSize);
      } else {
        gl.bindBufferBase(gl.UNIFORM_BUFFER, idx, uniformBindingParams);
      }
      idx++;
    }
  }
}
function glDefaultState(limits) {
  return {
    ...defaultConstants,
    drawBuffers: ["BACK"],
    attributeDefaults: Array(limits.MAX_VERTEX_ATTRIBS).fill({ type: "4f", values: [0, 0, 0, 1] }),
    textures: Array(limits.MAX_COMBINED_TEXTURE_IMAGE_UNITS).fill(null)
  };
}
function isUniformBufferBindingRange(params) {
  return params != null && "byteOffset" in params && "byteSize" in params;
}
var defaultConstants = {
  blend: {
    enable: false,
    // BLEND
    color: [0, 0, 0, 0],
    // BLEND_COLOR
    dstAlpha: "ZERO",
    // BLEND_DST_ALPHA
    dstRGB: "ZERO",
    // BLEND_DST_RGB
    equationAlpha: "FUNC_ADD",
    // BLEND_EQUATION_ALPHA
    equationRGB: "FUNC_ADD",
    // BLEND_EQUATION_RGB
    srcAlpha: "ONE",
    // BLEND_EQUATION_ALPHA
    srcRGB: "ONE"
    // BLEND_SRC_RGB
  },
  cull: {
    enable: false,
    // CULL_FACE
    mode: "BACK",
    // CULL_FACE_MODE
    frontFace: "CCW"
    // FRONT_FACE
  },
  depth: {
    test: false,
    // DEPTH_TEST
    func: "LESS",
    // DEPTH_FUNC
    writeMask: true,
    // DEPTH_WRITEMASK
    range: [0, 1]
    // DEPTH_RANGE
  },
  ditherEnable: true,
  // DITHER
  colorMask: [true, true, true, true],
  polygon: {
    offsetFill: false,
    // POLYGON_OFFSET_FILL
    offsetFactor: 0,
    // POLYGON_OFFSET_FACTOR
    offsetUnits: 0
    // POLYGON_OFFSET_UNITS
  },
  sample: {
    alphaToCoverage: false,
    // SAMPLE_ALPHA_TO_COVERAGE
    coverage: false,
    // SAMPLE_COVERAGE
    coverageValue: 1,
    // SAMPLE_COVERAGE_VALUE
    coverageInvert: false
    // SAMPLE_COVERAGE_INVERT
  },
  stencil: {
    test: false,
    // STENCIL_TEST
    func: "ALWAYS",
    // STENCIL_FUNC
    valueMask: 2147483647,
    // STENCIL_VALUE_MASK
    ref: 0,
    // STENCIL_REF
    backFunc: "ALWAYS",
    // STENCIL_BACK_FUNC
    backValueMask: 2147483647,
    // STENCIL_BACK_VALUE_MASK
    backRef: 0
    // STENCIL_BACK_REF
  },
  viewport: {
    // VIEWPORT
    x: 0,
    y: 0,
    width: 0,
    height: 0
  },
  scissor: {
    test: false,
    // SCISSOR_TEST
    box: {
      // SCISSOR_BOX
      x: 0,
      y: 0,
      width: 0,
      height: 0
    }
  },
  rasterizerDiscard: false,
  // RASTERIZER_DISCARD
  frameBuffer: null,
  vertexArrayObject: null,
  program: null,
  uniforms: [],
  uniformBuffers: []
  // max length: MAX_UNIFORM_BUFFER_BINDINGS
};

// ../webgl2/texture.ts
function glCreateTexture(gl, params) {
  const texture = gl.createTexture();
  const width = params.width ?? params.image.width;
  const height = params.height ?? params.image.height;
  const target = gl[params.kind];
  const depth = "depth" in params ? params.depth : void 0;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, texture);
  const { internalFormat, format, type, arrayType } = getFormatInfo(gl, params.internalFormat, "type" in params ? params.type : void 0);
  function textureImage(imgTarget, data, level, sizeX, sizeY, sizeZ = 0) {
    if (!data)
      return;
    const source = data;
    const view = ArrayBuffer.isView(source) ? source : void 0;
    const buffer = ArrayBuffer.isView(view) ? view.buffer : source;
    const byteOffset = view?.byteOffset ?? 0;
    const byteLength = view?.byteLength ?? buffer?.byteLength;
    const pixels = buffer === null ? null : new arrayType(buffer, byteOffset, byteLength / arrayType.BYTES_PER_ELEMENT);
    const offsetX = 0;
    const offsetY = 0;
    const offsetZ = 0;
    if (type) {
      if (sizeZ) {
        gl.texSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, format, type, pixels);
      } else {
        gl.texSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, format, type, pixels);
      }
    } else {
      if (sizeZ) {
        gl.compressedTexSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, internalFormat, pixels);
      } else {
        gl.compressedTexSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, internalFormat, pixels);
      }
    }
  }
  function textureMipLevel(level, image) {
    function isArray(img) {
      return Array.isArray(img);
    }
    const n = 1 << level;
    if (isArray(image)) {
      console.assert(target == gl.TEXTURE_CUBE_MAP);
      const cubeImages = image[level];
      if (cubeImages) {
        let side = gl.TEXTURE_CUBE_MAP_POSITIVE_X;
        for (let img of image) {
          textureImage(side++, img, level, width / n, height / n);
        }
      }
    } else {
      if (depth) {
        if (target == gl.TEXTURE_3D) {
          textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth / n);
        } else {
          console.assert(target == gl.TEXTURE_2D_ARRAY);
          textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth);
        }
      } else {
        console.assert(target == gl.TEXTURE_2D);
        textureImage(gl.TEXTURE_2D, image, level, width, height);
      }
    }
  }
  function textureStorage(levels = 1) {
    if (depth) {
      gl.texStorage3D(target, levels, internalFormat, width, height, depth);
    } else {
      gl.texStorage2D(target, levels, internalFormat, width, height);
    }
  }
  if ("mipMaps" in params) {
    const { mipMaps } = params;
    const isNumber = typeof mipMaps == "number";
    const levels = isNumber ? mipMaps : mipMaps.length;
    textureStorage(levels);
    if (!isNumber) {
      for (let level = 0; level < levels; level++) {
        const mipMap = mipMaps[level];
        if (mipMap) {
          textureMipLevel(level, mipMap);
        }
      }
    }
  } else if (isBufferSource(params.image)) {
    const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
    if (generateMipMaps && !(isPowerOf2(width) && isPowerOf2(height) && type)) {
      throw new Error(`Cannot generate mip maps on a texture of non-power of two sizes (${width}, ${height})!`);
    }
    const levels = generateMipMaps ? Math.log2(Math.min(width, height)) : 1;
    textureStorage(levels);
    textureMipLevel(0, params.image);
    if (generateMipMaps && params.image) {
      gl.generateMipmap(target);
    }
  } else {
    const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, params.image);
    if (generateMipMaps && isPowerOf2(width) && isPowerOf2(height)) {
      gl.generateMipmap(target);
    }
  }
  gl.bindTexture(target, null);
  return texture;
}
function glUpdateTexture(gl, targetTexture, params) {
  const width = params.width ?? params.image.width;
  const height = params.height ?? params.image.height;
  const target = gl[params.kind];
  const depth = "depth" in params ? params.depth : void 0;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, targetTexture);
  const { internalFormat, format, type, arrayType } = getFormatInfo(gl, params.internalFormat, "type" in params ? params.type : void 0);
  function textureImage(imgTarget, data, level, sizeX, sizeY, sizeZ = 0) {
    if (!data)
      return;
    const source = data;
    const view = ArrayBuffer.isView(source) ? source : void 0;
    const buffer = ArrayBuffer.isView(view) ? view.buffer : source;
    const byteOffset = view?.byteOffset ?? 0;
    const byteLength = view?.byteLength ?? buffer?.byteLength;
    const pixels = buffer === null ? null : new arrayType(buffer, byteOffset, byteLength / arrayType.BYTES_PER_ELEMENT);
    const offsetX = 0;
    const offsetY = 0;
    const offsetZ = 0;
    if (type) {
      if (sizeZ) {
        gl.texSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, format, type, pixels);
      } else {
        gl.texSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, format, type, pixels);
      }
    } else {
      if (sizeZ) {
        gl.compressedTexSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, internalFormat, pixels);
      } else {
        gl.compressedTexSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, internalFormat, pixels);
      }
    }
  }
  function textureMipLevel(level, image) {
    function isArray(img) {
      return Array.isArray(img);
    }
    const n = 1 << level;
    if (isArray(image)) {
      console.assert(target == gl.TEXTURE_CUBE_MAP);
      const cubeImages = image[level];
      if (cubeImages) {
        let side = gl.TEXTURE_CUBE_MAP_POSITIVE_X;
        for (let img of image) {
          textureImage(side++, img, level, width / n, height / n);
        }
      }
    } else {
      if (depth) {
        if (target == gl.TEXTURE_3D) {
          textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth / n);
        } else {
          console.assert(target == gl.TEXTURE_2D_ARRAY);
          textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth);
        }
      } else {
        console.assert(target == gl.TEXTURE_2D);
        textureImage(gl.TEXTURE_2D, image, level, width, height);
      }
    }
  }
  if ("mipMaps" in params) {
    const { mipMaps } = params;
    const isNumber = typeof mipMaps == "number";
    const levels = isNumber ? mipMaps : mipMaps.length;
    if (!isNumber) {
      for (let level = 0; level < levels; level++) {
        const mipMap = mipMaps[level];
        if (mipMap) {
          textureMipLevel(level, mipMap);
        }
      }
    }
  } else if (isBufferSource(params.image)) {
    const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
    if (generateMipMaps && !(isPowerOf2(width) && isPowerOf2(height) && type)) {
      throw new Error(`Cannot generate mip maps on a texture of non-power of two sizes (${width}, ${height})!`);
    }
    const levels = generateMipMaps ? Math.log2(Math.min(width, height)) : 1;
    textureMipLevel(0, params.image);
    if (generateMipMaps && params.image) {
      gl.generateMipmap(target);
    }
  } else {
    const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, params.image);
    if (generateMipMaps && isPowerOf2(width) && isPowerOf2(height)) {
      gl.generateMipmap(target);
    }
  }
  gl.bindTexture(target, null);
}
function isPowerOf2(value) {
  return (value & value - 1) == 0;
}
function isFormatCompressed(format) {
  return format.startsWith("COMPRESSED");
}
function isBufferSource(image) {
  return image == void 0 || Array.isArray(image) || image instanceof ArrayBuffer || ArrayBuffer.isView(image);
}
function getFormatInfo(gl, internalFormatString, typeString) {
  if (isFormatCompressed(internalFormatString)) {
    const internalFormat = compressedFormats[internalFormatString];
    const format = void 0;
    const type = void 0;
    const arrayType = Uint8Array;
    return { internalFormat, format, type, arrayType };
  } else {
    const internalFormat = gl[internalFormatString];
    const format = internalFormat2FormatLookup[internalFormat];
    const type = gl[typeString];
    const arrayType = getBufferViewType(typeString);
    return { internalFormat, format, type, arrayType };
  }
}
var internalFormat2FormatLookup = {
  [6407 /* RGB */]: 6407 /* RGB */,
  [6408 /* RGBA */]: 6408 /* RGBA */,
  [6410 /* LUMINANCE_ALPHA */]: 6410 /* LUMINANCE_ALPHA */,
  [6409 /* LUMINANCE */]: 6409 /* LUMINANCE */,
  [6406 /* ALPHA */]: 6406 /* ALPHA */,
  [33321 /* R8 */]: 6403 /* RED */,
  [36756 /* R8_SNORM */]: 6403 /* RED */,
  [33323 /* RG8 */]: 33319 /* RG */,
  [36757 /* RG8_SNORM */]: 33319 /* RG */,
  [32849 /* RGB8 */]: 6407 /* RGB */,
  [36758 /* RGB8_SNORM */]: 6407 /* RGB */,
  [36194 /* RGB565 */]: 6407 /* RGB */,
  [32854 /* RGBA4 */]: 6408 /* RGBA */,
  [32855 /* RGB5_A1 */]: 6408 /* RGBA */,
  [32856 /* RGBA8 */]: 6408 /* RGBA */,
  [36759 /* RGBA8_SNORM */]: 6408 /* RGBA */,
  [32857 /* RGB10_A2 */]: 6408 /* RGBA */,
  [36975 /* RGB10_A2UI */]: 36249 /* RGBA_INTEGER */,
  [35905 /* SRGB8 */]: 6407 /* RGB */,
  [35907 /* SRGB8_ALPHA8 */]: 6408 /* RGBA */,
  [33325 /* R16F */]: 6403 /* RED */,
  [33327 /* RG16F */]: 33319 /* RG */,
  [34843 /* RGB16F */]: 6407 /* RGB */,
  [34842 /* RGBA16F */]: 6408 /* RGBA */,
  [33326 /* R32F */]: 6403 /* RED */,
  [33328 /* RG32F */]: 33319 /* RG */,
  [34837 /* RGB32F */]: 6407 /* RGB */,
  [34836 /* RGBA32F */]: 6408 /* RGBA */,
  [35898 /* R11F_G11F_B10F */]: 6407 /* RGB */,
  [35901 /* RGB9_E5 */]: 6407 /* RGB */,
  [33329 /* R8I */]: 36244 /* RED_INTEGER */,
  [33330 /* R8UI */]: 36244 /* RED_INTEGER */,
  [33331 /* R16I */]: 36244 /* RED_INTEGER */,
  [33332 /* R16UI */]: 36244 /* RED_INTEGER */,
  [33333 /* R32I */]: 36244 /* RED_INTEGER */,
  [33334 /* R32UI */]: 36244 /* RED_INTEGER */,
  [33335 /* RG8I */]: 33320 /* RG_INTEGER */,
  [33336 /* RG8UI */]: 33320 /* RG_INTEGER */,
  [33337 /* RG16I */]: 33320 /* RG_INTEGER */,
  [33338 /* RG16UI */]: 33320 /* RG_INTEGER */,
  [33339 /* RG32I */]: 33320 /* RG_INTEGER */,
  [33340 /* RG32UI */]: 33320 /* RG_INTEGER */,
  [36239 /* RGB8I */]: 36248 /* RGB_INTEGER */,
  [36221 /* RGB8UI */]: 36248 /* RGB_INTEGER */,
  [36233 /* RGB16I */]: 36248 /* RGB_INTEGER */,
  [36215 /* RGB16UI */]: 36248 /* RGB_INTEGER */,
  [36227 /* RGB32I */]: 36248 /* RGB_INTEGER */,
  [36209 /* RGB32UI */]: 36248 /* RGB_INTEGER */,
  [36238 /* RGBA8I */]: 36249 /* RGBA_INTEGER */,
  [36220 /* RGBA8UI */]: 36249 /* RGBA_INTEGER */,
  [36232 /* RGBA16I */]: 36249 /* RGBA_INTEGER */,
  [36214 /* RGBA16UI */]: 36249 /* RGBA_INTEGER */,
  [36226 /* RGBA32I */]: 36249 /* RGBA_INTEGER */,
  [36208 /* RGBA32UI */]: 36249 /* RGBA_INTEGER */,
  [33189 /* DEPTH_COMPONENT16 */]: 6402 /* DEPTH_COMPONENT */,
  [33190 /* DEPTH_COMPONENT24 */]: 6402 /* DEPTH_COMPONENT */,
  [36012 /* DEPTH_COMPONENT32F */]: 6402 /* DEPTH_COMPONENT */,
  [35056 /* DEPTH24_STENCIL8 */]: 34041 /* DEPTH_STENCIL */,
  [36013 /* DEPTH32F_STENCIL8 */]: 34041 /* DEPTH_STENCIL */
};
var compressedFormats = {
  // WEBGL_compressed_texture_s3tc
  COMPRESSED_RGB_S3TC_DXT1_EXT: 33776 /* COMPRESSED_RGB_S3TC_DXT1_EXT */,
  COMPRESSED_RGBA_S3TC_DXT1_EXT: 33777 /* COMPRESSED_RGBA_S3TC_DXT1_EXT */,
  COMPRESSED_RGBA_S3TC_DXT3_EXT: 33778 /* COMPRESSED_RGBA_S3TC_DXT3_EXT */,
  COMPRESSED_RGBA_S3TC_DXT5_EXT: 33779 /* COMPRESSED_RGBA_S3TC_DXT5_EXT */,
  // WEBGL_compressed_texture_s3tc_srgb
  COMPRESSED_SRGB_S3TC_DXT1_EXT: 35916 /* COMPRESSED_SRGB_S3TC_DXT1_EXT */,
  COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT: 35917 /* COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT */,
  COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT: 35918 /* COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT */,
  COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT: 35919 /* COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT */,
  // WEBGL_compressed_texture_etc
  COMPRESSED_R11_EAC: 37488 /* COMPRESSED_R11_EAC */,
  COMPRESSED_SIGNED_R11_EAC: 37489 /* COMPRESSED_SIGNED_R11_EAC */,
  COMPRESSED_RG11_EAC: 37490 /* COMPRESSED_RG11_EAC */,
  COMPRESSED_SIGNED_RG11_EAC: 37491 /* COMPRESSED_SIGNED_RG11_EAC */,
  COMPRESSED_RGB8_ETC2: 37492 /* COMPRESSED_RGB8_ETC2 */,
  COMPRESSED_RGBA8_ETC2_EAC: 37493 /* COMPRESSED_RGBA8_ETC2_EAC */,
  COMPRESSED_SRGB8_ETC2: 37494 /* COMPRESSED_SRGB8_ETC2 */,
  COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: 37495 /* COMPRESSED_SRGB8_ALPHA8_ETC2_EAC */,
  COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: 37496 /* COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 */,
  COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: 37497 /* COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 */,
  // WEBGL_compressed_texture_pvrtc
  COMPRESSED_RGB_PVRTC_4BPPV1_IMG: 35840 /* COMPRESSED_RGB_PVRTC_4BPPV1_IMG */,
  COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: 35842 /* COMPRESSED_RGBA_PVRTC_4BPPV1_IMG */,
  COMPRESSED_RGB_PVRTC_2BPPV1_IMG: 35841 /* COMPRESSED_RGB_PVRTC_2BPPV1_IMG */,
  COMPRESSED_RGBA_PVRTC_2BPPV1_IMG: 35843 /* COMPRESSED_RGBA_PVRTC_2BPPV1_IMG */,
  // WEBGL_compressed_texture_etc1    
  COMPRESSED_RGB_ETC1_WEBGL: 36196 /* COMPRESSED_RGB_ETC1_WEBGL */,
  // WEBGL_compressed_texture_astc    
  COMPRESSED_RGBA_ASTC_4x4_KHR: 37808 /* COMPRESSED_RGBA_ASTC_4x4_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR: 37840 /* COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR */,
  COMPRESSED_RGBA_ASTC_5x4_KHR: 37809 /* COMPRESSED_RGBA_ASTC_5x4_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR: 37841 /* COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR */,
  COMPRESSED_RGBA_ASTC_5x5_KHR: 37810 /* COMPRESSED_RGBA_ASTC_5x5_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR: 37842 /* COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR */,
  COMPRESSED_RGBA_ASTC_6x5_KHR: 37811 /* COMPRESSED_RGBA_ASTC_6x5_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR: 37843 /* COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR */,
  COMPRESSED_RGBA_ASTC_6x6_KHR: 37812 /* COMPRESSED_RGBA_ASTC_6x6_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR: 37844 /* COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR */,
  COMPRESSED_RGBA_ASTC_8x5_KHR: 37813 /* COMPRESSED_RGBA_ASTC_8x5_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR: 37845 /* COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR */,
  COMPRESSED_RGBA_ASTC_8x6_KHR: 37814 /* COMPRESSED_RGBA_ASTC_8x6_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR: 37846 /* COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR */,
  COMPRESSED_RGBA_ASTC_8x8_KHR: 37815 /* COMPRESSED_RGBA_ASTC_8x8_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR: 37847 /* COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR */,
  COMPRESSED_RGBA_ASTC_10x5_KHR: 37816 /* COMPRESSED_RGBA_ASTC_10x5_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR: 37848 /* COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR */,
  COMPRESSED_RGBA_ASTC_10x6_KHR: 37817 /* COMPRESSED_RGBA_ASTC_10x6_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR: 37849 /* COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR */,
  COMPRESSED_RGBA_ASTC_10x10_KHR: 37819 /* COMPRESSED_RGBA_ASTC_10x10_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR: 37851 /* COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR */,
  COMPRESSED_RGBA_ASTC_12x10_KHR: 37820 /* COMPRESSED_RGBA_ASTC_12x10_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR: 37852 /* COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR */,
  COMPRESSED_RGBA_ASTC_12x12_KHR: 37821 /* COMPRESSED_RGBA_ASTC_12x12_KHR */,
  COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR: 37853 /* COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR */,
  // EXT_texture_compression_bptc    
  COMPRESSED_RGBA_BPTC_UNORM_EXT: 36492 /* COMPRESSED_RGBA_BPTC_UNORM_EXT */,
  COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT: 36493 /* COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT */,
  COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT: 36494 /* COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT */,
  COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT: 36495 /* COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT */,
  // EXT_texture_compression_rgtc    
  COMPRESSED_RED_RGTC1_EXT: 36283 /* COMPRESSED_RED_RGTC1_EXT */,
  COMPRESSED_SIGNED_RED_RGTC1_EXT: 36284 /* COMPRESSED_SIGNED_RED_RGTC1_EXT */,
  COMPRESSED_RED_GREEN_RGTC2_EXT: 36285 /* COMPRESSED_RED_GREEN_RGTC2_EXT */,
  COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT: 36286 /* COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT */
};

// ../webgl2/timer.ts
function glCreateTimer(gl, cpuFallback = false) {
  const { disjointTimerQuery } = glExtensions(gl);
  if (disjointTimerQuery) {
    gl.getParameter(disjointTimerQuery.GPU_DISJOINT_EXT);
    const useTimestamps = gl.getQuery(disjointTimerQuery.TIMESTAMP_EXT, disjointTimerQuery.QUERY_COUNTER_BITS_EXT) ?? 0 > 0;
    if (useTimestamps)
      return new GPUTimerTS(gl, disjointTimerQuery);
    else
      return new GPUTimer(gl, disjointTimerQuery);
  } else {
    if (cpuFallback) {
      return new CPUTimer(gl);
    } else {
      return new NullTimer(gl);
    }
  }
}
var NullTimer = class {
  constructor(gl) {
    this.gl = gl;
    this.creationTime = performance.now();
    this.promise = Promise.resolve(void 0);
  }
  kind = "null";
  promise;
  creationTime;
  dispose() {
  }
  begin() {
  }
  end() {
  }
  poll() {
    return true;
  }
};
var CPUTimer = class {
  constructor(gl) {
    this.gl = gl;
    this.creationTime = performance.now();
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
  kind = "cpu";
  promise;
  creationTime;
  beginTime = 0;
  endTime = 0;
  resolve;
  dispose() {
    this.resolve?.(void 0);
    this.resolve = void 0;
  }
  begin() {
    this.gl.getError();
    this.beginTime = performance.now();
  }
  end() {
    this.gl.getError();
    this.endTime = performance.now();
  }
  poll() {
    this.resolve?.(this.endTime - this.beginTime);
    this.resolve = void 0;
    return true;
  }
};
var GPUTimer = class {
  constructor(gl, ext) {
    this.gl = gl;
    this.ext = ext;
    this.creationTime = performance.now();
    this.query = gl.createQuery();
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
  kind = "gpu_time_elapsed";
  promise;
  creationTime;
  query;
  resolve;
  dispose() {
    const { gl, query, resolve } = this;
    gl.deleteQuery(query);
    resolve?.(void 0);
    this.resolve = void 0;
  }
  begin() {
    const { gl, ext, query } = this;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
  }
  end() {
    const { gl, ext } = this;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
  }
  poll() {
    const { gl, ext, query, resolve } = this;
    let disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    if (!disjoint) {
      const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      if (available) {
        const timeElapsed = gl.getQueryParameter(query, gl.QUERY_RESULT);
        resolve?.(timeElapsed / 1e6);
        this.resolve = void 0;
        return true;
      }
    }
    if (performance.now() > this.creationTime + 1e3) {
      resolve?.(void 0);
      this.resolve = void 0;
      return true;
    }
    return false;
  }
};
var GPUTimerTS = class {
  constructor(gl, ext) {
    this.gl = gl;
    this.ext = ext;
    this.creationTime = performance.now();
    this.startQuery = gl.createQuery();
    this.endQuery = gl.createQuery();
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
    });
  }
  kind = "gpu_timestamp";
  promise;
  creationTime;
  startQuery;
  endQuery;
  resolve;
  dispose() {
    const { gl, startQuery, endQuery, resolve } = this;
    gl.deleteQuery(startQuery);
    gl.deleteQuery(endQuery);
    resolve?.(void 0);
    this.resolve = void 0;
  }
  begin() {
    const { ext, startQuery } = this;
    ext.queryCounterEXT(startQuery, ext.TIMESTAMP_EXT);
  }
  end() {
    const { ext, endQuery } = this;
    ext.queryCounterEXT(endQuery, ext.TIMESTAMP_EXT);
  }
  poll() {
    const { gl, ext, startQuery, endQuery, resolve } = this;
    let disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    if (!disjoint) {
      const available = gl.getQueryParameter(endQuery, gl.QUERY_RESULT_AVAILABLE);
      if (available) {
        const timeStart = gl.getQueryParameter(startQuery, gl.QUERY_RESULT);
        const timeEnd = gl.getQueryParameter(endQuery, gl.QUERY_RESULT);
        const timeElapsed = timeEnd - timeStart;
        resolve?.(timeElapsed / 1e6);
        this.resolve = void 0;
        return true;
      }
    }
    if (performance.now() > this.creationTime + 1e3) {
      resolve?.(void 0);
      this.resolve = void 0;
      return true;
    }
    return false;
  }
};

// ../webgl2/transformFeedback.ts
function glTransformFeedback(gl, params) {
  const { kind, transformFeedback, outputBuffers, count, first } = params;
  const mode = gl[kind];
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
  for (let i = 0; i < outputBuffers.length; i++) {
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, outputBuffers[i]);
  }
  gl.beginTransformFeedback(mode);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.drawArrays(mode, first ?? 0, count);
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.endTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  for (let i = 0; i < outputBuffers.length; i++) {
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, null);
  }
}

// ../webgl2/uniforms.ts
function glUniformLocations(gl, program, names, prefix) {
  const locations = {};
  for (const name of names) {
    locations[name] = gl.getUniformLocation(program, `${prefix ?? ""}${name}`);
  }
  return locations;
}
function glUBOProxy(values) {
  const offsetsMap = {};
  let offset = 0;
  for (const [key, value] of Object.entries(values)) {
    const { alignment, components, rows } = uniformTypes[value];
    const padding = alignment - 1 - (offset + alignment - 1) % alignment;
    offset += padding;
    const offsets = [];
    for (let row = 0; row < rows; row++) {
      for (let component = 0; component < components; component++) {
        offsets.push(offset++);
      }
      if (rows > 1) {
        offset = offset + 3 & ~3;
      }
    }
    offsetsMap[key] = offsets;
  }
  const byteSize = (offset + 3 & ~3) * 4;
  const buffer = new ArrayBuffer(byteSize);
  const views = {
    i32: new Int32Array(buffer),
    u32: new Uint32Array(buffer),
    f32: new Float32Array(buffer)
  };
  const validators = {
    i32: (value) => {
      if (!Number.isInteger(value)) {
        throw new Error("Uniform value not an integer!");
      }
    },
    u32: (value) => {
      if (value < 0 || !Number.isInteger(value)) {
        throw new Error("Uniform value not an unsigned integer!");
      }
    },
    f32: (value) => {
    }
  };
  const dirtyRange = new DirtyRange(byteSize);
  const proxy = {
    buffer,
    dirtyRange,
    values: {}
  };
  for (const [key, value] of Object.entries(values)) {
    const componentType = uniformTypes[value].type;
    const view = views[componentType];
    const validate = validators[componentType];
    const offsets = offsetsMap[key];
    const begin = offsets[0] * 4;
    const end = offsets[offsets.length - 1] * 4 + 4;
    const type = values[key];
    const get = type == "bool" ? () => {
      return view[offsets[0]] != 0;
    } : type == "int" || type == "uint" || type == "float" ? () => {
      return view[offsets[0]];
    } : () => {
      return offsets.map((o) => view[o]);
    };
    const set7 = type == "bool" ? (value2) => {
      view[offsets[0]] = value2 ? 0 : -1;
      dirtyRange.expand(begin, end);
    } : type == "int" || type == "uint" || type == "float" ? (value2) => {
      validate(value2);
      view[offsets[0]] = value2;
      dirtyRange.expand(begin, end);
    } : (values2) => {
      console.assert(values2.length == offsets.length);
      for (let i = 0; i < values2.length; i++) {
        validate(values2[i]);
        view[offsets[i]] = values2[i];
      }
      dirtyRange.expand(begin, end);
    };
    Reflect.defineProperty(proxy.values, key, {
      configurable: false,
      enumerable: true,
      get,
      set: set7
    });
  }
  return proxy;
}
var DirtyRange = class {
  constructor(size) {
    this.size = size;
    this.begin = 0;
    this.end = size;
  }
  begin;
  end;
  get isEmpty() {
    return this.begin >= this.end;
  }
  clear() {
    this.begin = this.size;
    this.end = 0;
  }
  reset() {
    this.begin = 0;
    this.end = this.size;
  }
  expand(begin, end) {
    if (this.begin > begin) {
      this.begin = begin;
    }
    if (this.end < end) {
      this.end = end;
    }
  }
};
var uniformTypes = {
  bool: { type: "i32", alignment: 1, components: 1, rows: 1 },
  int: { type: "i32", alignment: 1, components: 1, rows: 1 },
  uint: { type: "u32", alignment: 1, components: 1, rows: 1 },
  float: { type: "f32", alignment: 1, components: 1, rows: 1 },
  ivec2: { type: "i32", alignment: 2, components: 2, rows: 1 },
  uvec2: { type: "u32", alignment: 2, components: 2, rows: 1 },
  vec2: { type: "f32", alignment: 2, components: 2, rows: 1 },
  ivec3: { type: "i32", alignment: 4, components: 3, rows: 1 },
  uvec3: { type: "u32", alignment: 4, components: 3, rows: 1 },
  vec3: { type: "f32", alignment: 4, components: 3, rows: 1 },
  ivec4: { type: "i32", alignment: 4, components: 3, rows: 1 },
  uvec4: { type: "u32", alignment: 4, components: 3, rows: 1 },
  vec4: { type: "f32", alignment: 4, components: 4, rows: 1 },
  mat3: { type: "f32", alignment: 4, components: 3, rows: 3 },
  mat4: { type: "f32", alignment: 4, components: 4, rows: 4 }
};

// ../webgl2/vao.ts
function glCreateVertexArray(gl, params) {
  const vao = gl.createVertexArray();
  const { MAX_VERTEX_ATTRIBS } = glLimits(gl);
  gl.bindVertexArray(vao);
  const { attributes } = params;
  for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
    const attribParams = attributes[i];
    if (attribParams) {
      const { size, isInteger, defaultComponentType } = shaderTypeInfo[attribParams.kind];
      const componentType = attribParams.componentType ?? defaultComponentType;
      const divisor = attribParams.divisor ?? 0;
      const byteStride = attribParams.byteStride ?? 0;
      const byteOffset = attribParams.byteOffset ?? 0;
      const componentCount = attribParams.componentCount ?? (isMatrix(size) ? size[0] : size);
      const normalized = attribParams.normalized ?? false;
      gl.bindBuffer(gl.ARRAY_BUFFER, attribParams.buffer);
      gl.enableVertexAttribArray(i);
      if (isInteger) {
        gl.vertexAttribIPointer(i, componentCount, gl[componentType], byteStride, byteOffset);
      } else {
        gl.vertexAttribPointer(i, componentCount, gl[componentType], normalized, byteStride, byteOffset);
      }
      gl.vertexAttribDivisor(i, divisor);
    } else {
      gl.disableVertexAttribArray(i);
    }
  }
  ;
  if (params.indices) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indices);
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  return vao;
}
function isMatrix(size) {
  return Array.isArray(size);
}
var shaderTypeInfo = {
  "INT": { size: 1, isInteger: true, defaultComponentType: "INT" },
  "INT_VEC2": { size: 2, isInteger: true, defaultComponentType: "INT" },
  "INT_VEC3": { size: 3, isInteger: true, defaultComponentType: "INT" },
  "INT_VEC4": { size: 4, isInteger: true, defaultComponentType: "INT" },
  "UNSIGNED_INT": { size: 1, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
  "UNSIGNED_INT_VEC2": { size: 2, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
  "UNSIGNED_INT_VEC3": { size: 3, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
  "UNSIGNED_INT_VEC4": { size: 4, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
  "FLOAT": { size: 1, isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_VEC2": { size: 2, isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_VEC3": { size: 3, isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_VEC4": { size: 4, isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT2": { size: [2, 2], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT3": { size: [3, 3], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT4": { size: [4, 4], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT2x3": { size: [2, 3], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT2x4": { size: [2, 4], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT3x2": { size: [3, 2], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT3x4": { size: [3, 4], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT4x2": { size: [4, 2], isInteger: false, defaultComponentType: "FLOAT" },
  "FLOAT_MAT4x3": { size: [4, 3], isInteger: false, defaultComponentType: "FLOAT" }
};

// ../core3d/state/default.ts
function defaultRenderState() {
  const state = {
    output: {
      width: 512,
      height: 256,
      samplesMSAA: 1
    },
    background: {},
    camera: {
      kind: "pinhole",
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      pivot: void 0,
      fov: 45,
      near: 0.1,
      far: 1e4
    },
    quality: {
      detail: 1
    },
    debug: {
      showNodeBounds: false
    },
    grid: {
      enabled: false,
      color1: [2, 2, 2],
      color2: [0, 0, 0],
      origin: [0, 0, 0],
      axisX: [1, 0, 0],
      axisY: [0, 0, 1],
      size1: 1,
      size2: 10,
      distance: 500
    },
    cube: {
      enabled: false,
      position: [0, 0, 0],
      scale: 1
    },
    scene: void 0,
    terrain: {
      elevationGradient: {
        knots: [
          { position: -10, color: [0, 0, 0.5] },
          { position: 0, color: [0.5, 0.5, 1] },
          { position: 0, color: [0, 0.5, 0] },
          { position: 10, color: [0.5, 1, 0.5] }
        ]
      },
      asBackground: false
    },
    dynamic: {
      objects: []
    },
    clipping: {
      enabled: false,
      draw: false,
      mode: 0,
      planes: []
    },
    highlights: {
      defaultAction: void 0,
      groups: []
    },
    outlines: {
      enabled: false,
      color: [10, 10, 10],
      // bright white (overexposed)
      plane: [0, 0, 1, 0]
    },
    tonemapping: {
      exposure: 0,
      mode: 0 /* color */
    },
    points: {
      size: {
        pixel: 1,
        maxPixel: void 0,
        metric: 0,
        toleranceFactor: 0
      },
      deviation: {
        index: 0,
        mixFactor: 0,
        colorGradient: {
          knots: [
            { position: -1, color: [1, 0, 0, 1] },
            { position: -0.5, color: [1, 1, 0, 1] },
            { position: -0.25, color: [0, 1, 0, 1] },
            { position: 0.25, color: [0, 1, 0, 1] },
            { position: 0.5, color: [1, 1, 0, 1] },
            { position: 1, color: [0, 1, 0, 1] }
          ]
        }
      },
      useProjectedPosition: false
    },
    toonOutline: {
      enabled: false,
      color: [0, 0, 0],
      onlyOnIdleFrame: true
    },
    pick: {
      opacityThreshold: 1
    }
  };
  return state;
}

// ../core3d/state/modify.ts
function modifyRenderState(state, changes) {
  const newState = mergeRecursive(state, changes);
  if (changes.output) {
    verifyOutputState(newState.output);
  }
  if (changes.clipping) {
    verifyClippingState(newState.clipping);
  }
  return newState;
}
function mergeRecursive(original, changes) {
  const clone7 = { ...original };
  for (const key in changes) {
    const originalValue = original ? original[key] : void 0;
    const changedValue = changes[key];
    if (changedValue != void 0 && typeof changedValue == "object" && !Array.isArray(changedValue) && !ArrayBuffer.isView(changedValue) && !(changedValue instanceof Set)) {
      clone7[key] = mergeRecursive(originalValue, changedValue);
    } else {
      clone7[key] = changedValue;
    }
  }
  return clone7;
}
function verifyOutputState(state) {
  const { width, height } = state;
  if (!Number.isInteger(width) || !Number.isInteger(height))
    throw new Error(`Output size dimentions (width:${width}, height:${height}) must be integers!`);
}
function verifyClippingState(state) {
  const { planes } = state;
  if (planes.length > 6)
    throw new Error(`A maximum of six clippings planes are allowed!`);
}

// ../core3d/state/index.ts
var CoordSpace = /* @__PURE__ */ ((CoordSpace2) => {
  CoordSpace2[CoordSpace2["World"] = 0] = "World";
  CoordSpace2[CoordSpace2["View"] = 1] = "View";
  CoordSpace2[CoordSpace2["Clip"] = 2] = "Clip";
  return CoordSpace2;
})(CoordSpace || {});
var CubeId = 4294967288;
var ClippingMode = /* @__PURE__ */ ((ClippingMode2) => {
  ClippingMode2[ClippingMode2["intersection"] = 0] = "intersection";
  ClippingMode2[ClippingMode2["union"] = 1] = "union";
  return ClippingMode2;
})(ClippingMode || {});
var ClippingId = /* @__PURE__ */ ((ClippingId2) => {
  ClippingId2[ClippingId2["plane0"] = 4294967280] = "plane0";
  ClippingId2[ClippingId2["plane1"] = 4294967281] = "plane1";
  ClippingId2[ClippingId2["plane2"] = 4294967282] = "plane2";
  ClippingId2[ClippingId2["plane3"] = 4294967283] = "plane3";
  ClippingId2[ClippingId2["plane4"] = 4294967284] = "plane4";
  ClippingId2[ClippingId2["plane5"] = 4294967285] = "plane5";
  ClippingId2[ClippingId2["plane6"] = 4294967286] = "plane6";
  return ClippingId2;
})(ClippingId || {});
var TonemappingMode = /* @__PURE__ */ ((TonemappingMode2) => {
  TonemappingMode2[TonemappingMode2["color"] = 0] = "color";
  TonemappingMode2[TonemappingMode2["normal"] = 1] = "normal";
  TonemappingMode2[TonemappingMode2["depth"] = 2] = "depth";
  TonemappingMode2[TonemappingMode2["objectId"] = 3] = "objectId";
  TonemappingMode2[TonemappingMode2["deviation"] = 4] = "deviation";
  TonemappingMode2[TonemappingMode2["zbuffer"] = 5] = "zbuffer";
  return TonemappingMode2;
})(TonemappingMode || {});

// ../core3d/matrices.ts
function index(from, to) {
  return from * 3 + to;
}
function matricesFromRenderState(state) {
  const { camera, output } = state;
  const { width, height } = output;
  const aspectRatio = width / height;
  const fovY = camera.fov * Math.PI / 180;
  const viewWorld = mat4_exports.fromRotationTranslation(mat4_exports.create(), camera.rotation, camera.position);
  const viewClip = mat4_exports.create();
  if (camera.kind == "orthographic") {
    const aspect = output.width / output.height;
    const halfHeight = camera.fov / 2;
    const halfWidth = halfHeight * aspect;
    mat4_exports.ortho(viewClip, -halfWidth, halfWidth, -halfHeight, halfHeight, camera.near, camera.far);
  } else {
    mat4_exports.perspective(viewClip, fovY, aspectRatio, camera.near, camera.far);
  }
  return new MatricesImpl(viewWorld, viewClip);
}
var MatricesImpl = class {
  _mtx4 = new Array(4 * 4);
  _mtx3 = new Array(4 * 4);
  constructor(viewWorld, viewClip) {
    this._mtx4[index(1 /* View */, 0 /* World */)] = viewWorld;
    this._mtx4[index(1 /* View */, 2 /* Clip */)] = viewClip;
    const worldView = this._mtx4[index(0 /* World */, 1 /* View */)] = mat4_exports.create();
    const clipView = this._mtx4[index(2 /* Clip */, 1 /* View */)] = mat4_exports.create();
    mat4_exports.invert(worldView, viewWorld);
    mat4_exports.invert(clipView, viewClip);
  }
  getMatrix(from, to) {
    console.assert(from != to);
    const idx = index(from, to);
    let m = this._mtx4[idx];
    if (!m) {
      this._mtx4[idx] = m = mat4_exports.create();
      if (to > from) {
        mat4_exports.multiply(m, this.getMatrix(to - 1, to), this.getMatrix(from, to - 1));
      } else {
        mat4_exports.multiply(m, this.getMatrix(from - 1, to), this.getMatrix(from, from - 1));
      }
    }
    return m;
  }
  getMatrixNormal(from, to) {
    console.assert(from != to);
    const idx = index(from, to);
    let m = this._mtx3[idx];
    if (!m) {
      this._mtx3[idx] = m = mat3_exports.create();
      mat3_exports.normalFromMat4(m, this.getMatrix(from, to));
    }
    return m;
  }
};

// ../core3d/viewFrustum.ts
function createViewFrustum(state, matrices) {
  const { camera, output } = state;
  const { width, height } = output;
  const aspect = width / height;
  const halfHeight = camera.fov / 2;
  const halfWidth = halfHeight * aspect;
  const left = vec4_exports.create();
  const right = vec4_exports.create();
  const top = vec4_exports.create();
  const bottom = vec4_exports.create();
  const near = vec4_exports.create();
  const far = vec4_exports.create();
  const image = vec4_exports.create();
  vec4_exports.set(near, 0, 0, 1, -camera.near);
  vec4_exports.set(far, 0, 0, -1, camera.far);
  vec4_exports.set(image, 0, 0, -1, 0);
  if (camera.kind == "orthographic") {
    vec4_exports.set(left, -1, 0, 0, halfWidth);
    vec4_exports.set(right, 1, 0, 0, halfWidth);
    vec4_exports.set(top, 0, 1, 0, halfHeight);
    vec4_exports.set(bottom, 0, -1, 0, halfHeight);
  } else {
    const halfAngleY = common_exports.toRadian(camera.fov / 2);
    const halfAngleX = Math.atan(Math.tan(halfAngleY) * aspect);
    vec4_exports.set(left, -Math.cos(halfAngleX), 0, Math.sin(halfAngleX), 0);
    vec4_exports.set(right, Math.cos(halfAngleX), 0, Math.sin(halfAngleX), 0);
    vec4_exports.set(top, 0, Math.cos(halfAngleY), Math.sin(halfAngleY), 0);
    vec4_exports.set(bottom, 0, -Math.cos(halfAngleY), Math.sin(halfAngleY), 0);
  }
  const normal = vec3_exports.create();
  const position = vec3_exports.create();
  const matrix = matrices.getMatrix(1 /* View */, 0 /* World */);
  const matrixNormal = matrices.getMatrixNormal(1 /* View */, 0 /* World */);
  mat4_exports.getTranslation(position, matrix);
  const planes = [left, right, top, bottom, near, far, image];
  for (const plane of planes) {
    const [x, y, z, offset] = plane;
    vec3_exports.set(normal, x, y, z);
    vec3_exports.transformMat3(normal, normal, matrixNormal);
    const distance4 = offset + vec3_exports.dot(position, normal);
    vec4_exports.set(plane, normal[0], normal[1], normal[2], -distance4);
  }
  return { left, right, top, bottom, near, far, image, planes: [left, right, top, bottom, near, far] };
}

// ../core3d/buffers.ts
var RenderBuffers = class {
  constructor(gl, width, height, samples, resourceBin) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.samples = samples;
    this.resourceBin = resourceBin;
    const textures = this.textures = {
      // color: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RGBA16F", type: "HALF_FLOAT", image: null }),
      color: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "R11F_G11F_B10F", type: "HALF_FLOAT", image: null }),
      pick: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RGBA32UI", type: "UNSIGNED_INT", image: null }),
      // TODO: Pack linearDepth into this buffer instead.
      depth: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "DEPTH_COMPONENT32F", type: "FLOAT", image: null })
    };
    const renderBuffers = this.renderBuffers = {
      colorMSAA: samples > 1 ? resourceBin.createRenderBuffer({ internalFormat: "R11F_G11F_B10F", width, height, samples }) : null,
      depthMSAA: samples > 1 ? resourceBin.createRenderBuffer({ internalFormat: "DEPTH_COMPONENT32F", width, height, samples }) : null
    };
    this.frameBuffers = {
      color: resourceBin.createFrameBuffer({
        color: [
          { kind: "FRAMEBUFFER", texture: textures.color }
        ],
        depth: { kind: "DRAW_FRAMEBUFFER", texture: textures.depth }
      }),
      colorMSAA: samples > 1 ? resourceBin.createFrameBuffer({
        color: [
          { kind: "DRAW_FRAMEBUFFER", renderBuffer: renderBuffers.colorMSAA }
        ],
        depth: { kind: "DRAW_FRAMEBUFFER", renderBuffer: renderBuffers.depthMSAA }
      }) : null,
      pick: resourceBin.createFrameBuffer({
        color: [
          null,
          { kind: "DRAW_FRAMEBUFFER", texture: textures.pick }
        ],
        depth: { kind: "DRAW_FRAMEBUFFER", texture: textures.depth }
      })
    };
    this.readBuffers = {
      pick: resourceBin.createBuffer({ kind: "PIXEL_PACK_BUFFER", byteSize: width * height * 16, usage: "STREAM_READ" })
    };
    this.typedArrays = {
      pick: new Uint32Array(width * height * 4)
    };
  }
  readBuffersNeedUpdate = true;
  textures;
  renderBuffers;
  frameBuffers;
  readBuffers;
  typedArrays;
  pickFence;
  resolveMSAA() {
    const { gl, frameBuffers, width, height } = this;
    const { colorMSAA, color } = frameBuffers;
    if (colorMSAA) {
      glBlit(gl, { source: colorMSAA, destination: color, color: true, srcX1: width, srcY1: height, dstX1: width, dstY1: height });
      glInvalidateFrameBuffer(gl, { kind: "FRAMEBUFFER", frameBuffer: colorMSAA, color: [true], depth: true });
    }
  }
  invalidate(frameBuffer, buffers) {
    const { gl, frameBuffers } = this;
    var color = (buffers & 1 /* color */) != 0;
    var pick = (buffers & 2 /* pick */) != 0;
    var depth = (buffers & 4 /* depth */) != 0;
    glInvalidateFrameBuffer(gl, { kind: "DRAW_FRAMEBUFFER", frameBuffer: frameBuffers[frameBuffer], color: [color, pick], depth });
  }
  // copy framebuffer into read buffers
  read() {
    const { gl, width, height, frameBuffers, readBuffers } = this;
    glReadPixels(gl, {
      width,
      height,
      frameBuffer: frameBuffers.pick,
      buffers: [
        { attachment: "COLOR_ATTACHMENT1", buffer: readBuffers.pick, format: "RGBA_INTEGER", type: "UNSIGNED_INT" }
      ]
    });
  }
  async pickBuffers() {
    if (this.readBuffersNeedUpdate && !this.pickFence) {
      const { gl } = this;
      this.read();
      this.readBuffersNeedUpdate = false;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      this.pickFence = { sync, promises: [] };
    }
    if (this.pickFence) {
      const { promises } = this.pickFence;
      const promise = new Promise((resolve, reject) => {
        promises.push({ resolve, reject });
      });
      await promise;
      return this.typedArrays;
    } else {
      return Promise.resolve(this.typedArrays);
    }
  }
  dispose() {
    this.deletePickFence();
    this.resourceBin.dispose();
  }
  pollPickFence() {
    const { gl, pickFence, readBuffers, typedArrays } = this;
    if (pickFence) {
      const { sync, promises } = pickFence;
      const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
      if (status == gl.WAIT_FAILED) {
        for (const promise of promises) {
          promise.reject("Pick failed!");
        }
        this.deletePickFence();
      } else if (status != gl.TIMEOUT_EXPIRED) {
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readBuffers.pick);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, typedArrays.pick);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        for (const promise of promises) {
          promise.resolve();
        }
        this.deletePickFence();
      }
    }
  }
  deletePickFence() {
    this.gl.deleteSync(this.pickFence?.sync ?? null);
    this.pickFence = void 0;
  }
};

// ../core3d/common.glsl
var common_default = "// shared/global stuff\n#define PASS_COLOR 0\n#define PASS_PICK 1\n#define PASS_PRE 2\n\n#ifndef PASS\n#define PASS PASS_COLOR // avoid red squigglies in editor\n#endif\n\nstruct CameraUniforms {\n    mat4 clipViewMatrix;\n    mat4 viewClipMatrix;\n    mat4 localViewMatrix;\n    mat4 viewLocalMatrix;\n    mat3 localViewMatrixNormal;\n    mat3 viewLocalMatrixNormal;\n    vec2 viewSize;\n    float near; // near clipping plane distance\n};\nstruct IBLTextures {\n    samplerCube specular;\n    samplerCube diffuse;\n};\n\n// background\nstruct BackgroundVaryings {\n    vec3 dir;\n};\nstruct BackgroundUniforms {\n    float envBlurNormalized;\n    int mipCount;\n};\nstruct BackgroundTextures {\n    samplerCube skybox;\n    IBLTextures ibl;\n};\n\n// clipping\nconst uint undefinedIndex = 7U;\nconst uint clippingId = 0xfffffff0U;\nconst uint clippingModeIntersection = 0U;\nconst uint clippingModeUnion = 1U;\nstruct ClippingVaryings {\n    vec3 dirVS;\n};\nstruct ClippingUniforms {\n    vec4 planes[6];\n    uint numPlanes;\n    uint mode; // 0 = intersection, 1 = union\n};\nstruct ClippingColors {\n    vec4 colors[6];\n};\nbool clip(vec3 point, ClippingUniforms clipping) {\n    float s = clipping.mode == clippingModeIntersection ? -1. : 1.;\n    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;\n    for(uint i = 0U; i < clipping.numPlanes; i++) {\n        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.;\n    }\n    return clipping.mode == clippingModeIntersection ? inside : !inside;\n}\n\n// outlines\nstruct OutlineUniforms {\n    mat4 localPlaneMatrix;\n    mat4 planeLocalMatrix;\n    vec3 color;\n};\n\nbool clipOutlines(vec3 point, ClippingUniforms clipping) {\n    float s = clipping.mode == clippingModeIntersection ? -1. : 1.;\n    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;\n    for(uint i = 0U; i < clipping.numPlanes; i++) {\n        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.;\n    }\n    return !inside;\n}\n\n// cube\nconst uint cubeId = 0xfffffff8U;\nstruct CubeVaryings {\n    vec3 posVS;\n    vec3 normal;\n    vec3 color;\n};\nstruct CubeUniforms {\n    mat4 modelLocalMatrix;\n};\n\n// grid\nstruct GridVaryings {\n    vec2 posOS;\n    vec3 posLS;\n};\nstruct GridUniforms {\n    // below coords are in local space\n    vec3 origin;\n    vec3 axisX;\n    vec3 axisY;\n    float size1;\n    float size2;\n    vec3 color1;\n    vec3 color2;\n    float distance;\n};\n\nstruct ToonOutlineUniforms {\n    vec3 color;\n};\n\n// dynamic geometry\nconst vec3 ambientLight = vec3(0);\nstruct DynamicVaryings {\n    vec4 color0;\n    vec2 texCoord0;\n    vec2 texCoord1;\n    vec3 positionVS;\n    float linearDepth;\n    mat3 tbn; // in world space\n    vec3 toCamera; // in world space (camera - position)\n};\nstruct DynamicVaryingsFlat {\n    uint objectId;\n};\nstruct MaterialUniforms {\n    vec4 baseColorFactor;\n    vec3 emissiveFactor;\n    float roughnessFactor;\n    float metallicFactor;\n    float normalScale;\n    float occlusionStrength;\n    float alphaCutoff;\n    int baseColorUVSet;\n    int metallicRoughnessUVSet;\n    int normalUVSet;\n    int occlusionUVSet;\n    int emissiveUVSet;\n    uint radianceMipCount;\n};\nstruct ObjectUniforms {\n    mat4 worldLocalMatrix;\n    uint baseObjectId;\n};\nstruct DynamicTextures {\n    sampler2D lut_ggx;\n    IBLTextures ibl;\n    sampler2D base_color;\n    sampler2D metallic_roughness;\n    sampler2D normal;\n    sampler2D emissive;\n    sampler2D occlusion;\n};\n\n// octree\n#define MODE_TRIANGLES 0\n#define MODE_POINTS 1\n#define MODE_TERRAIN 2\n\n#ifndef MODE\n#define MODE MODE_TRIANGLES // avoid red squigglies in editor\n#endif\n\nconst uint maxHighlights = 256U;\nstruct OctreeVaryings {\n    vec3 positionVS; // view space\n    vec3 normalVS; // view space\n    vec2 texCoord0;\n    vec2 screenPos;\n    float radius;\n    float deviation;\n    float elevation;\n};\nstruct OctreeVaryingsFlat {\n    vec4 color;\n    uint objectId;\n    uint highlight;\n};\nstruct SceneUniforms {\n    bool applyDefaultHighlight;\n    float iblMipCount;\n    // point cloud\n    float pixelSize;\n    float maxPixelSize;\n    float metricSize;\n    float toleranceFactor;\n    int deviationIndex;\n    float deviationFactor;\n    vec2 deviationRange;\n    bool useProjectedPosition;\n    // terrain elevation\n    vec2 elevationRange;\n    float pickOpacityThreshold;\n};\nstruct NodeUniforms {\n    mat4 modelLocalMatrix;\n    float tolerance;\n    vec4 debugColor;\n    // min,max are in local space\n    vec3 min;\n    vec3 max;\n};\nconst struct OctreeTextures {\n    sampler2D base_color;\n    IBLTextures ibl;\n    sampler2D materials;\n    sampler2D highlights;\n    sampler2D gradients;\n};\n\n// watermark\nstruct WatermarkVaryings {\n    float elevation;\n};\nstruct WatermarkUniforms {\n    mat4 modelClipMatrix;\n    vec4 color;\n};\n\n// tonemapping\nconst float tonemapMaxDeviation = 1.;\nconst uint tonemapModeColor = 0U;\nconst uint tonemapModeNormal = 1U;\nconst uint tonemapModeDepth = 2U;\nconst uint tonemapModeObjectId = 3U;\nconst uint tonemapModeDeviation = 4U;\nconst uint tonemapModeZbuffer = 5U;\nstruct TonemappingVaryings {\n    vec2 uv;\n};\nstruct TonemappingUniforms {\n    float exposure;\n    uint mode;\n    float maxLinearDepth;\n};\nstruct TonemappingTextures {\n    sampler2D color;\n    usampler2D pick;\n    sampler2D zbuffer;\n};\n\n// dither transparency\nconst mat4 ditherThresholds = mat4(0.0 / 16.0, 8.0 / 16.0, 2.0 / 16.0, 10.0 / 16.0, 12.0 / 16.0, 4.0 / 16.0, 14.0 / 16.0, 6.0 / 16.0, 3.0 / 16.0, 11.0 / 16.0, 1.0 / 16.0, 9.0 / 16.0, 15.0 / 16.0, 7.0 / 16.0, 13.0 / 16.0, 5.0 / 16.0);\nfloat dither(vec2 xy) {\n    int x = int(xy.x) & 3;\n    int y = int(xy.y) & 3;\n    return ditherThresholds[y][x];\n}\n\n// sRGB\nconst float GAMMA = 2.2;\nconst float INV_GAMMA = 1.0 / GAMMA;\n// linear to sRGB approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)\nvec3 linearTosRGB(vec3 color) {\n    return pow(color, vec3(INV_GAMMA));\n}\n// sRGB to linear approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)\nvec3 sRGBToLinear(vec3 srgbIn) {\n    return vec3(pow(srgbIn.xyz, vec3(GAMMA)));\n}\n\n// gradients\nconst float numGradients = 2.;\nconst float deviationV = 0. / numGradients + .5 / numGradients;\nconst float elevationV = 1. / numGradients + .5 / numGradients;\n\nvec4 getGradientColor(sampler2D gradientTexture, float position, float v, vec2 range) {\n    float u = (range[0] >= range[1]) ? 0. : (position - range[0]) / (range[1] - range[0]);\n    return texture(gradientTexture, vec2(u, v));\n}\n\n// packing\n\n// we use octrahedral packing of normals to map 3 components down to 2: https://jcgt.org/published/0003/02/01/\nvec2 signNotZero(vec2 v) { // returns \xB11\n    return vec2((v.x >= 0.) ? +1. : -1., (v.y >= 0.) ? +1. : -1.);\n}\n\nvec2 float32x3_to_oct(vec3 v) { // assume normalized input. Output is on [-1, 1] for each component.\n    // project the sphere onto the octahedron, and then onto the xy plane\n    vec2 p = v.xy * (1. / (abs(v.x) + abs(v.y) + abs(v.z)));\n    // reflect the folds of the lower hemisphere over the diagonals\n    return (v.z <= 0.) ? ((1. - abs(p.yx)) * signNotZero(p)) : p;\n}\n\nvec3 oct_to_float32x3(vec2 e) {\n    vec3 v = vec3(e.xy, 1. - abs(e.x) - abs(e.y));\n    if(v.z < 0.)\n        v.xy = (1. - abs(v.yx)) * signNotZero(v.xy);\n    return normalize(v);\n}\n\nuvec2 packNormalAndDeviation(vec3 normal, float deviation) {\n    return uvec2(packHalf2x16(normal.xy), packHalf2x16(vec2(normal.z, deviation)));\n}\n\nuvec2 packNormal(vec3 normal) {\n    return packNormalAndDeviation(normal, 0.);\n}\n\nvec4 unpackNormalAndDeviation(uvec2 normalAndDeviation) {\n    return vec4(unpackHalf2x16(normalAndDeviation[0]), unpackHalf2x16(normalAndDeviation[1]));\n}\n";

// ../core3d/resource.ts
var ResourceBin = class {
  constructor(gl, name, collection) {
    this.gl = gl;
    this.name = name;
    this.collection = collection;
    this.collection.add(this);
  }
  resourceMap = /* @__PURE__ */ new Map();
  static create(gl, name, collection) {
    return new ResourceBin(gl, name, collection);
  }
  get resourceInfo() {
    const { resourceMap } = this;
    function* iterate() {
      for (const infos of resourceMap.values()) {
        for (const info of infos) {
          yield { ...info };
        }
      }
    }
    return iterate();
  }
  get size() {
    return this.resourceMap.size;
  }
  createBuffer(params) {
    return this.add(glCreateBuffer(this.gl, params), { kind: "Buffer", target: params.kind, byteSize: bufferBytes(params) });
  }
  createFrameBuffer(params) {
    return this.add(glCreateFrameBuffer(this.gl, params), { kind: "Framebuffer" });
  }
  createProgram(params) {
    return this.add(glCreateProgram(this.gl, params), { kind: "Program" });
  }
  createProgramAsync(params) {
    const ret = glCreateProgramAsync(this.gl, params);
    this.add(ret.program, { kind: "Program" });
    return ret;
  }
  createRenderBuffer(params) {
    return this.add(glCreateRenderbuffer(this.gl, params), { kind: "Renderbuffer", byteSize: renderBufferBytes(this.gl, params) });
  }
  createSampler(params) {
    return this.add(glCreateSampler(this.gl, params), { kind: "Sampler" });
  }
  createTexture(params) {
    return this.add(glCreateTexture(this.gl, params), { kind: "Texture", target: params.kind, byteSize: textureBytes(params) });
  }
  createTransformFeedback() {
    return this.add(this.gl.createTransformFeedback(), { kind: "TransformFeedback" });
  }
  createVertexArray(params) {
    return this.add(glCreateVertexArray(this.gl, params), { kind: "VertexArray" });
  }
  add(resource, info) {
    console.assert(resource.constructor.name.startsWith("WebGL"));
    if (!this.resourceMap.has(resource)) {
      this.resourceMap.set(resource, [info]);
    } else {
      throw new Error("Resource added more than once!");
    }
    return resource;
  }
  // delete resources that are already kept alive/referenced by other resources,
  // e.g. a buffer referenced by a vertex array object or a texture referenced by a framebuffer.
  // this will remove them from the list of attached resources but retain info for resource tracking purposes
  subordinate(owner, ...resources) {
    const deletedInfos = [];
    console.assert(resources.length > 0);
    this.del(resources, deletedInfos);
    const ownerInfos = this.resourceMap.get(owner);
    if (ownerInfos) {
      ownerInfos.push(...deletedInfos);
    }
  }
  delete(...resources) {
    this.del(resources);
  }
  del(resources, deleteInfos) {
    const { gl, resourceMap } = this;
    for (const resource of resources) {
      if (!resource)
        continue;
      const infos = this.resourceMap.get(resource);
      if (infos && infos.length > 0) {
        for (const info of infos) {
          deleteInfos?.push(info);
        }
        const [primary] = infos;
        gl[`delete${primary.kind}`](resource);
        resourceMap.delete(resource);
      } else {
        throw new Error("Resource could not be found!");
      }
    }
  }
  deleteAll() {
    this.delete(...this.resourceMap.keys());
    this.resourceMap.clear();
  }
  dispose() {
    if (this.gl) {
      this.deleteAll();
      this.collection.delete(this);
    }
  }
};
function bufferBytes(params) {
  return "byteSize" in params ? params.byteSize : params.srcData.byteLength;
}
function renderBufferBytes(gl, params) {
  const { width, height, internalFormat } = params;
  const samples = params.samples == "max" ? glLimits(gl).MAX_SAMPLES : params.samples ?? 1;
  const bytesPerPixel = Math.ceil(internalFormatTexelBytes[internalFormat]);
  return width * height * bytesPerPixel * samples;
}
function textureBytes(params) {
  const width = params.width ?? params.image.width;
  const height = params.height ?? params.image.height;
  const depth = "depth" in params ? params.depth : 1;
  const faces = params.kind == "TEXTURE_CUBE_MAP" ? 6 : 1;
  const topLeveltexels = width * height * depth * faces;
  let totalTexels = 0;
  let levels = 1;
  if ("mipMaps" in params) {
    const { mipMaps } = params;
    const isNumber = typeof mipMaps == "number";
    levels = isNumber ? mipMaps : mipMaps.length;
  }
  if ("generateMipMaps" in params && params.generateMipMaps && isPowerOf22(width) && isPowerOf22(height)) {
    levels = Math.min(Math.log2(width), Math.log2(height));
  }
  for (let level = 0; level < levels; level++) {
    totalTexels += topLeveltexels >> level;
  }
  const bytesPerTexel = Math.ceil(internalFormatTexelBytes[params.internalFormat]);
  return Math.ceil(totalTexels * bytesPerTexel);
}
function isPowerOf22(value) {
  return (value & value - 1) == 0;
}
var internalFormatTexelBytes = {
  "RGB": 3,
  "RGBA": 4,
  "LUMINANCE_ALPHA": 2,
  "LUMINANCE": 1,
  "ALPHA": 1,
  "STENCIL_INDEX8": 1,
  "R8": 1,
  "R8_SNORM": 1,
  "RG8": 2,
  "RG8_SNORM": 2,
  "RGB8": 3,
  "RGB8_SNORM": 3,
  "RGB565": 2,
  "RGBA4": 2,
  "RGB5_A1": 2,
  "RGBA8": 4,
  "RGBA8_SNORM": 4,
  "RGB10_A2": 4,
  "RGB10_A2UI": 4,
  "SRGB8": 3,
  "SRGB8_ALPHA8": 4,
  "R16F": 2,
  "RG16F": 4,
  "RGB16F": 6,
  "RGBA16F": 8,
  "R32F": 4,
  "RG32F": 8,
  "RGB32F": 16,
  "RGBA32F": 32,
  "R11F_G11F_B10F": 4,
  "RGB9_E5": 4,
  "R8I": 1,
  "R8UI": 1,
  "R16I": 2,
  "R16UI": 2,
  "R32I": 4,
  "R32UI": 4,
  "RG8I": 2,
  "RG8UI": 2,
  "RG16I": 4,
  "RG16UI": 4,
  "RG32I": 8,
  "RG32UI": 8,
  "RGB8I": 3,
  "RGB8UI": 4,
  "RGB16I": 6,
  "RGB16UI": 6,
  "RGB32I": 12,
  "RGB32UI": 12,
  "RGBA8I": 4,
  "RGBA8UI": 4,
  "RGBA16I": 8,
  "RGBA16UI": 8,
  "RGBA32I": 16,
  "RGBA32UI": 16,
  "DEPTH_COMPONENT16": 2,
  "DEPTH_COMPONENT24": 3,
  "DEPTH_COMPONENT32F": 4,
  "DEPTH24_STENCIL8": 4,
  "DEPTH32F_STENCIL8": 5,
  // WEBGL_compressed_texture_s3tc
  "COMPRESSED_RGB_S3TC_DXT1_EXT": 0.5,
  "COMPRESSED_RGBA_S3TC_DXT1_EXT": 0.5,
  "COMPRESSED_RGBA_S3TC_DXT3_EXT": 1,
  "COMPRESSED_RGBA_S3TC_DXT5_EXT": 1,
  // WEBGL_compressed_texture_s3tc_srgb
  "COMPRESSED_SRGB_S3TC_DXT1_EXT": 0.5,
  "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT": 0.5,
  "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT": 1,
  "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT": 1,
  // WEBGL_compressed_texture_etc
  "COMPRESSED_R11_EAC": 0.5,
  "COMPRESSED_SIGNED_R11_EAC": 0.5,
  "COMPRESSED_RG11_EAC": 1,
  "COMPRESSED_SIGNED_RG11_EAC": 1,
  "COMPRESSED_RGB8_ETC2": 0.5,
  "COMPRESSED_RGBA8_ETC2_EAC": 1,
  "COMPRESSED_SRGB8_ETC2": 0.5,
  "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC": 1,
  "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2": 0.5,
  "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2": 0.5,
  // WEBGL_compressed_texture_pvrtc
  "COMPRESSED_RGB_PVRTC_4BPPV1_IMG": 0.5,
  "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG": 0.5,
  "COMPRESSED_RGB_PVRTC_2BPPV1_IMG": 0.25,
  "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG": 0.25,
  // WEBGL_compressed_texture_etc1    
  "COMPRESSED_RGB_ETC1_WEBGL": 0.5,
  // WEBGL_compressed_texture_astc    
  "COMPRESSED_RGBA_ASTC_4x4_KHR": 16 / (4 * 4),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR": 16 / (4 * 4),
  "COMPRESSED_RGBA_ASTC_5x4_KHR": 16 / (5 * 4),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR": 16 / (5 * 4),
  "COMPRESSED_RGBA_ASTC_5x5_KHR": 16 / (5 * 5),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR": 16 / (5 * 5),
  "COMPRESSED_RGBA_ASTC_6x5_KHR": 16 / (6 * 5),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR": 16 / (6 * 5),
  "COMPRESSED_RGBA_ASTC_6x6_KHR": 16 / (6 * 6),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR": 16 / (6 * 6),
  "COMPRESSED_RGBA_ASTC_8x5_KHR": 16 / (8 * 5),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR": 16 / (8 * 5),
  "COMPRESSED_RGBA_ASTC_8x6_KHR": 16 / (8 * 6),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR": 16 / (8 * 6),
  "COMPRESSED_RGBA_ASTC_8x8_KHR": 16 / (8 * 8),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR": 16 / (8 * 8),
  "COMPRESSED_RGBA_ASTC_10x5_KHR": 16 / (10 * 5),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR": 16 / (10 * 5),
  "COMPRESSED_RGBA_ASTC_10x6_KHR": 16 / (10 * 6),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR": 16 / (10 * 6),
  "COMPRESSED_RGBA_ASTC_10x10_KHR": 16 / (10 * 10),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR": 16 / (10 * 10),
  "COMPRESSED_RGBA_ASTC_12x10_KHR": 16 / (12 * 10),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR": 16 / (12 * 10),
  "COMPRESSED_RGBA_ASTC_12x12_KHR": 16 / (12 * 12),
  "COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR": 16 / (12 * 12),
  // EXT_texture_compression_bptc    
  "COMPRESSED_RGBA_BPTC_UNORM_EXT": 1,
  "COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT": 1,
  "COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT": 1,
  "COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT": 1,
  // EXT_texture_compression_rgtc    
  "COMPRESSED_RED_RGTC1_EXT": 0.5,
  "COMPRESSED_SIGNED_RED_RGTC1_EXT": 0.5,
  "COMPRESSED_RED_GREEN_RGTC2_EXT": 1,
  "COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT": 1
};

// ../core3d/util.ts
function decodeBase64(base64, type = Uint8Array) {
  if (base64) {
    var binaryString = atob(base64);
    var len5 = binaryString.length;
    const bytes = new type(len5);
    for (let i = 0; i < len5; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
function othoNormalBasisMatrixFromPlane(plane) {
  const [nx, ny, nz, offs] = plane;
  const axisZ = vec3_exports.fromValues(nx, ny, nz);
  const minI = nx < ny && nx < nz ? 0 : ny < nz ? 1 : 2;
  const axisY = vec3_exports.fromValues(0, 0, 0);
  axisY[minI] = 1;
  const axisX = vec3_exports.cross(vec3_exports.create(), axisY, axisZ);
  vec3_exports.cross(axisX, axisY, axisZ);
  vec3_exports.normalize(axisX, axisX);
  vec3_exports.cross(axisY, axisZ, axisX);
  vec3_exports.normalize(axisY, axisY);
  const [bx, by, bz] = axisX;
  const [tx, ty, tz] = axisY;
  return mat4_exports.fromValues(
    bx,
    by,
    bz,
    0,
    tx,
    ty,
    tz,
    0,
    nx,
    ny,
    nz,
    0,
    nx * -offs,
    ny * -offs,
    nz * -offs,
    1
  );
}

// ../core3d/context.ts
var _RenderContext = class {
  constructor(deviceProfile, canvas, wasm, lut_ggx, options) {
    this.deviceProfile = deviceProfile;
    this.canvas = canvas;
    this.wasm = wasm;
    const gl = canvas.getContext("webgl2", options);
    if (!gl)
      throw new Error("Unable to create WebGL 2 context!");
    this.gl = gl;
    const extensions = glExtensions(gl, true);
    const defaultBin = this.defaultResourceBin = this.resourceBin("context");
    const iblBin = this.iblResourceBin = this.resourceBin("ibl");
    console.assert(extensions.loseContext != null, extensions.multiDraw != null, extensions.colorBufferFloat != null);
    const { provokingVertex } = extensions;
    if (provokingVertex) {
      provokingVertex.provokingVertexWEBGL(provokingVertex.FIRST_VERTEX_CONVENTION_WEBGL);
    }
    this.commonChunk = common_default;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    const lutParams = { kind: "TEXTURE_2D", internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: lut_ggx };
    this.lut_ggx = defaultBin.createTexture(lutParams);
    this.samplerSingle = defaultBin.createSampler({ minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    this.samplerMip = defaultBin.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    const top = new Uint8Array([192, 192, 192, 255]);
    const side = new Uint8Array([128, 128, 128, 255]);
    const bottom = new Uint8Array([64, 64, 64, 255]);
    const image = [side, side, top, bottom, side, side];
    const textureParams = this.defaultIBLTextureParams = { kind: "TEXTURE_CUBE_MAP", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image };
    this.iblTextures = {
      diffuse: iblBin.createTexture(textureParams),
      specular: iblBin.createTexture(textureParams),
      numMipMaps: 1,
      default: true
    };
    this.cameraUniformsData = glUBOProxy({
      clipViewMatrix: "mat4",
      viewClipMatrix: "mat4",
      localViewMatrix: "mat4",
      viewLocalMatrix: "mat4",
      localViewMatrixNormal: "mat3",
      viewLocalMatrixNormal: "mat3",
      windowSize: "vec2",
      near: "float"
    });
    this.cameraUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.cameraUniformsData.buffer.byteLength });
    this.clippingUniformsData = glUBOProxy({
      "planes.0": "vec4",
      "planes.1": "vec4",
      "planes.2": "vec4",
      "planes.3": "vec4",
      "planes.4": "vec4",
      "planes.5": "vec4",
      numPlanes: "uint",
      mode: "uint"
    });
    this.clippingUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.clippingUniformsData.buffer.byteLength });
    this.outlinesUniformsData = glUBOProxy({
      localPlaneMatrix: "mat4",
      planeLocalMatrix: "mat4",
      color: "vec3"
    });
    this.outlineUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.outlinesUniformsData.buffer.byteLength });
  }
  modules;
  cameraUniformsData;
  clippingUniformsData;
  outlinesUniformsData;
  localSpaceTranslation = vec3_exports.create();
  asyncPrograms = [];
  gl;
  commonChunk;
  defaultIBLTextureParams;
  resourceBins = /* @__PURE__ */ new Set();
  defaultResourceBin;
  iblResourceBin;
  pickBuffersValid = false;
  currentPick;
  activeTimers = /* @__PURE__ */ new Set();
  currentFrameTime = 0;
  statistics = {
    points: 0,
    lines: 0,
    triangles: 0,
    drawCalls: 0
  };
  prevFrame;
  // use a pre-pass to fill in z-buffer for improved fill rate at the expense of triangle rate (useful when doing heavy shading, but unclear how efficient this is on tiled GPUs.)
  //* @internal */
  usePrepass = false;
  // copy from last rendered state
  isOrtho = false;
  viewClipMatrix = mat4_exports.create();
  viewWorldMatrix = mat4_exports.create();
  viewWorldMatrixNormal = mat3_exports.create();
  // constant gl resources
  cameraUniforms;
  clippingUniforms;
  outlineUniforms;
  lut_ggx;
  samplerMip;
  // use to read diffuse texture
  samplerSingle;
  // use to read the other textures
  // shared mutable state
  prevState;
  changed = true;
  // flag to force a re-render when internal render module state has changed, e.g. on download complete.
  pause = false;
  // true to freeze all module updates, e.g. downloading of new geometry etc.
  buffers = void 0;
  // output render buffers. will be set on first render as part of resize.
  iblTextures;
  isIdleFrame = false;
  async init(modules) {
    if (!modules) {
      _RenderContext.defaultModules ??= createDefaultModules();
      modules = _RenderContext.defaultModules;
    }
    const modulePromises = modules.map((m, i) => {
      const ret = m.withContext(this);
      return isPromise(ret) ? ret : Promise.resolve(ret);
    });
    this.linkAsyncPrograms();
    this.modules = await Promise.all(modulePromises);
  }
  linkAsyncPrograms() {
    const { gl, asyncPrograms } = this;
    for (const { program } of this.asyncPrograms) {
      gl.linkProgram(program);
    }
    gl.useProgram(null);
    const ext = glExtensions(gl).parallelShaderCompile;
    function pollAsyncPrograms() {
      for (let i = 0; i < asyncPrograms.length; i++) {
        const { program, resolve, reject } = asyncPrograms[i];
        if (ext) {
          if (!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR))
            continue;
        }
        const [info] = asyncPrograms.splice(i--, 1);
        const error = glCheckProgram(gl, info);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
      if (asyncPrograms.length > 0) {
        setTimeout(pollAsyncPrograms);
      }
    }
    pollAsyncPrograms();
  }
  dispose() {
    const { buffers, modules, activeTimers, defaultResourceBin, iblResourceBin } = this;
    this.poll();
    for (const timer of activeTimers) {
      timer.dispose();
    }
    activeTimers.clear();
    if (modules) {
      for (const module of modules) {
        module?.dispose();
      }
      this.modules = void 0;
    }
    buffers?.dispose();
    iblResourceBin.dispose();
    defaultResourceBin.dispose();
    console.assert(this.resourceBins.size == 0);
  }
  get width() {
    return this.gl.drawingBufferWidth;
  }
  get height() {
    return this.gl.drawingBufferHeight;
  }
  isPickBuffersValid() {
    return this.pickBuffersValid;
  }
  isRendering() {
    return this.prevState != void 0;
  }
  isContextLost() {
    return this.gl.isContextLost();
  }
  getViewMatrices() {
    return { viewClipMatrix: this.viewClipMatrix, viewWorldMatrix: this.viewWorldMatrix, viewWorldMatrixNormal: this.viewWorldMatrixNormal };
  }
  //* @internal */
  drawBuffers(buffers = 7 /* all */) {
    const activeBuffers = buffers;
    return [
      activeBuffers & 1 /* color */ ? "COLOR_ATTACHMENT0" : "NONE",
      activeBuffers & 2 /* pick */ ? "COLOR_ATTACHMENT1" : "NONE"
    ];
  }
  //* @internal */
  updateUniformBuffer(uniformBuffer, proxy) {
    if (!proxy.dirtyRange.isEmpty) {
      const { begin, end } = proxy.dirtyRange;
      glUpdateBuffer(this.gl, { kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: uniformBuffer, srcElementOffset: begin, dstByteOffset: begin, byteSize: end - begin });
      proxy.dirtyRange.clear();
    }
  }
  //* @internal */
  updateIBLTextures(params) {
    const { iblResourceBin } = this;
    iblResourceBin.deleteAll();
    if (params) {
      const { diffuse, specular } = params;
      this.iblTextures = {
        diffuse: iblResourceBin.createTexture(diffuse),
        specular: iblResourceBin.createTexture(specular),
        numMipMaps: typeof specular.mipMaps == "number" ? specular.mipMaps : specular.mipMaps.length,
        default: false
      };
    } else {
      this.iblTextures = {
        diffuse: iblResourceBin.createTexture(this.defaultIBLTextureParams),
        specular: iblResourceBin.createTexture(this.defaultIBLTextureParams),
        numMipMaps: 1,
        default: true
      };
    }
  }
  //* @internal */
  hasStateChanged(state) {
    const { prevState } = this;
    let changed = false;
    for (const prop in state) {
      const p = prop;
      if (!prevState || prevState[p] !== state[p]) {
        changed = true;
        break;
      }
    }
    return changed;
  }
  //* @internal */
  resourceBin(name) {
    return ResourceBin["create"](this.gl, name, this.resourceBins);
  }
  //* @internal */
  makeProgramAsync(resourceBin, params) {
    const { gl, commonChunk } = this;
    const { vertexShader, fragmentShader } = params;
    const header = { commonChunk, ...params.header };
    const programAsync = resourceBin.createProgramAsync({ header, vertexShader, fragmentShader });
    const { program } = programAsync;
    const { attributes, transformFeedback, uniformBufferBlocks, textureUniforms } = params;
    if (attributes) {
      let i = 0;
      for (const name of attributes) {
        gl.bindAttribLocation(program, i++, name);
      }
    }
    if (transformFeedback) {
      const { varyings, bufferMode } = transformFeedback;
      gl.transformFeedbackVaryings(program, varyings, gl[bufferMode]);
    }
    return new Promise((resolve, reject) => {
      function postLink() {
        gl.useProgram(program);
        if (uniformBufferBlocks) {
          let idx = 0;
          for (const name of uniformBufferBlocks) {
            if (name) {
              const blockIndex = gl.getUniformBlockIndex(program, name);
              if (blockIndex != gl.INVALID_INDEX) {
                gl.uniformBlockBinding(program, blockIndex, idx);
              } else {
                console.warn(`Shader has no uniform block named: ${name}!`);
              }
            }
            idx++;
          }
        }
        if (textureUniforms) {
          let i = 0;
          for (const name of textureUniforms) {
            const location = gl.getUniformLocation(program, name);
            gl.uniform1i(location, i++);
          }
        }
        gl.useProgram(null);
        resolve(program);
      }
      this.asyncPrograms.push({ ...programAsync, resolve: postLink, reject });
    });
  }
  resetRenderStatistics() {
    const { statistics } = this;
    statistics.points = 0;
    statistics.lines = 0;
    statistics.triangles = 0;
    statistics.drawCalls = 0;
  }
  //* @internal */
  addRenderStatistics(stats, drawCalls = 1) {
    const { statistics } = this;
    statistics.points += stats.points;
    statistics.lines += stats.lines;
    statistics.triangles += stats.triangles;
    statistics.drawCalls += drawCalls;
  }
  //* @internal */
  contextLost() {
    const { modules } = this;
    if (modules) {
      for (const module of modules) {
        module?.contextLost();
      }
    }
  }
  //* @internal */
  emulateLostContext(value) {
    const ext = glExtensions(this.gl).loseContext;
    if (ext) {
      if (value == "lose") {
        ext.loseContext();
      } else {
        ext.restoreContext();
      }
    }
  }
  poll() {
    this.buffers?.pollPickFence();
    this.pollTimers();
  }
  beginTimer() {
    const timer = glCreateTimer(this.gl, false);
    this.activeTimers.add(timer);
    timer.begin();
    return timer;
  }
  pollTimers() {
    const { activeTimers } = this;
    for (const timer of [...activeTimers]) {
      if (timer.poll()) {
        activeTimers.delete(timer);
        timer.dispose();
      }
    }
  }
  static nextFrame(context) {
    return new Promise((resolve) => {
      requestAnimationFrame((time) => {
        if (context) {
          const { prevFrame } = context;
          if (prevFrame) {
            prevFrame.resolve(time - prevFrame.time);
            context.prevFrame = void 0;
          }
          context.currentFrameTime = time;
        }
        resolve(time);
      });
    });
  }
  async render(state) {
    if (!this.modules) {
      throw new Error("Context has not been initialized!");
    }
    console.log("RENDER");
    const beginTime = performance.now();
    const { gl, canvas, prevState } = this;
    this.changed = false;
    this.pickBuffersValid = false;
    this.resetRenderStatistics();
    const drawTimer = this.beginTimer();
    const { MAX_SAMPLES } = glLimits(gl);
    const effectiveSamplesMSAA = Math.max(1, Math.min(MAX_SAMPLES, Math.min(this.deviceProfile.limits.maxSamples, state.output.samplesMSAA)));
    let resized = false;
    const { output } = state;
    if (this.hasStateChanged({ output })) {
      const { width: width2, height: height2 } = output;
      console.assert(Number.isInteger(width2) && Number.isInteger(height2));
      canvas.width = width2;
      canvas.height = height2;
      resized = true;
      this.changed = true;
      this.buffers?.dispose();
      this.buffers = new RenderBuffers(gl, width2, height2, effectiveSamplesMSAA, this.resourceBin("FrameBuffers"));
    }
    const derivedState = state;
    derivedState.effectiveSamplesMSAA = effectiveSamplesMSAA;
    if (resized || state.camera !== prevState?.camera) {
      const snapDist = 1024;
      const dist4 = Math.max(...vec3_exports.sub(vec3_exports.create(), state.camera.position, this.localSpaceTranslation).map((c) => Math.abs(c)));
      if (dist4 >= snapDist) {
        let snap2 = function(v) {
          return Math.round(v / snapDist) * snapDist;
        };
        var snap = snap2;
        this.localSpaceTranslation = vec3_exports.fromValues(...state.camera.position.map((v) => snap2(v)));
      }
      derivedState.localSpaceTranslation = this.localSpaceTranslation;
      derivedState.matrices = matricesFromRenderState(state);
      derivedState.viewFrustum = createViewFrustum(state, derivedState.matrices);
    }
    this.updateCameraUniforms(derivedState);
    this.updateClippingUniforms(derivedState);
    this.updateOutlinesUniforms(derivedState);
    this.isOrtho = derivedState.camera.kind == "orthographic";
    mat4_exports.copy(this.viewClipMatrix, derivedState.matrices.getMatrix(1 /* View */, 2 /* Clip */));
    mat4_exports.copy(this.viewWorldMatrix, derivedState.matrices.getMatrix(1 /* View */, 0 /* World */));
    mat3_exports.copy(this.viewWorldMatrixNormal, derivedState.matrices.getMatrixNormal(1 /* View */, 0 /* World */));
    if (!this.pause) {
      for (const module of this.modules) {
        module?.update(derivedState);
      }
    }
    this.linkAsyncPrograms();
    const { width, height } = canvas;
    const { buffers } = this;
    buffers.readBuffersNeedUpdate = true;
    const frameBufferName = effectiveSamplesMSAA > 1 ? "colorMSAA" : "color";
    const frameBuffer = buffers.frameBuffers[frameBufferName];
    buffers.invalidate(frameBufferName, 7 /* all */);
    glState(gl, { viewport: { width, height }, frameBuffer });
    glClear(gl, { kind: "DEPTH_STENCIL", depth: 1, stencil: 0 });
    if (this.usePrepass) {
      for (const module of this.modules) {
        if (module && module.prepass) {
          glState(gl, {
            viewport: { width, height },
            frameBuffer,
            drawBuffers: []
            // colorMask: [false, false, false, false],
          });
          module.prepass(derivedState);
          glState(gl, null);
        }
      }
    }
    for (const module of this.modules) {
      if (module) {
        glState(gl, {
          viewport: { width, height },
          frameBuffer,
          drawBuffers: this.drawBuffers(1 /* color */),
          sample: { alphaToCoverage: effectiveSamplesMSAA > 1 }
        });
        module.render(derivedState);
        glState(gl, null);
      }
    }
    drawTimer.end();
    this.buffers.invalidate("colorMSAA", 1 /* color */ | 4 /* depth */);
    this.buffers.invalidate("color", 1 /* color */ | 4 /* depth */);
    this.prevState = derivedState;
    const endTime = performance.now();
    const intervalPromise = new Promise((resolve) => {
      this.prevFrame = { time: this.currentFrameTime, resolve };
    });
    const stats = { ...this.statistics, bufferBytes: 0, textureBytes: 0 };
    for (const bin of this.resourceBins) {
      for (const { kind, byteSize } of bin.resourceInfo) {
        if (kind == "Buffer" || kind == "Renderbuffer") {
          stats.bufferBytes += byteSize;
        }
        if (kind == "Texture") {
          stats.textureBytes += byteSize;
        }
      }
    }
    const [gpuDrawTime, frameInterval] = await Promise.all([drawTimer.promise, intervalPromise]);
    return {
      cpuTime: {
        draw: endTime - beginTime
      },
      gpuTime: {
        draw: gpuDrawTime
      },
      frameInterval,
      ...stats
    };
  }
  //* @internal */
  renderPickBuffers() {
    if (!this.pickBuffersValid) {
      if (!this.modules) {
        throw new Error("Context has not been initialized!");
      }
      const { gl, width, height, buffers, prevState } = this;
      if (!prevState) {
        throw new Error("render() was not called!");
      }
      const stateParams = {
        viewport: { width, height },
        frameBuffer: buffers.frameBuffers.pick,
        drawBuffers: this.drawBuffers(2 /* pick */),
        depth: { test: true, writeMask: true }
      };
      glState(gl, stateParams);
      glClear(gl, { kind: "DEPTH_STENCIL", depth: 1, stencil: 0 });
      glClear(gl, { kind: "COLOR", drawBuffer: 1, type: "Uint", color: [4294967295, 0, 0, 2139095040] });
      for (const module of this.modules) {
        if (module) {
          glState(gl, stateParams);
          module.pick?.(prevState);
          glState(gl, null);
        }
      }
      if (prevState.tonemapping.mode != 0 /* color */) {
        const tonemapModule = this.modules?.find((m) => m.module.kind == "tonemap");
        glState(gl, { viewport: { width, height } });
        tonemapModule?.render(prevState);
        glState(gl, null);
      }
      this.pickBuffersValid = true;
    }
  }
  //* @internal */
  *getLinearDepths(pick) {
    const floats = new Float32Array(pick.buffer);
    for (let i = 3; i < pick.length; i += 4) {
      yield floats[i];
    }
  }
  updateCameraUniforms(state) {
    const { cameraUniformsData, localSpaceTranslation } = this;
    const { output, camera, matrices } = state;
    const { values } = cameraUniformsData;
    const worldViewMatrix = matrices.getMatrix(0 /* World */, 1 /* View */);
    const viewWorldMatrix = matrices.getMatrix(1 /* View */, 0 /* World */);
    const worldLocalMatrix = mat4_exports.fromTranslation(mat4_exports.create(), vec3_exports.negate(vec3_exports.create(), localSpaceTranslation));
    const localWorldMatrix = mat4_exports.fromTranslation(mat4_exports.create(), localSpaceTranslation);
    values.clipViewMatrix = matrices.getMatrix(2 /* Clip */, 1 /* View */);
    values.viewClipMatrix = matrices.getMatrix(1 /* View */, 2 /* Clip */);
    values.viewClipMatrix = matrices.getMatrix(1 /* View */, 2 /* Clip */);
    values.localViewMatrix = mat4_exports.multiply(mat4_exports.create(), worldViewMatrix, localWorldMatrix);
    values.viewLocalMatrix = mat4_exports.multiply(mat4_exports.create(), worldLocalMatrix, viewWorldMatrix);
    values.localViewMatrixNormal = matrices.getMatrixNormal(0 /* World */, 1 /* View */);
    values.viewLocalMatrixNormal = matrices.getMatrixNormal(1 /* View */, 0 /* World */);
    values.windowSize = [output.width, output.height];
    values.near = camera.near;
    this.updateUniformBuffer(this.cameraUniforms, this.cameraUniformsData);
  }
  updateClippingUniforms(state) {
    const { clipping, matrices } = state;
    if (this.hasStateChanged({ clipping, matrices })) {
      const { clippingUniforms, clippingUniformsData } = this;
      const { values } = clippingUniformsData;
      const { enabled, mode, planes } = clipping;
      const normal = vec3_exports.create();
      const position = vec3_exports.create();
      const matrix = matrices.getMatrix(0 /* World */, 1 /* View */);
      const matrixNormal = matrices.getMatrixNormal(0 /* World */, 1 /* View */);
      mat4_exports.getTranslation(position, matrix);
      for (let i = 0; i < planes.length; i++) {
        const { normalOffset } = planes[i];
        const [x, y, z, offset] = normalOffset;
        vec3_exports.set(normal, x, y, z);
        vec3_exports.transformMat3(normal, normal, matrixNormal);
        const distance4 = offset + vec3_exports.dot(position, normal);
        const plane = vec4_exports.fromValues(normal[0], normal[1], normal[2], -distance4);
        const idx = i;
        values[`planes.${idx}`] = plane;
      }
      values["numPlanes"] = enabled ? planes.length : 0;
      values["mode"] = mode;
      this.updateUniformBuffer(clippingUniforms, clippingUniformsData);
    }
  }
  updateOutlinesUniforms(state) {
    const { outlines, matrices } = state;
    if (this.hasStateChanged({ outlines, matrices })) {
      const { outlineUniforms, outlinesUniformsData } = this;
      const { color, plane } = outlines;
      const [x, y, z, offset] = plane;
      const normal = vec3_exports.fromValues(x, y, z);
      const distance4 = offset - vec3_exports.dot(this.localSpaceTranslation, normal);
      const planeLS = vec4_exports.fromValues(normal[0], normal[1], normal[2], -distance4);
      const planeLocalMatrix = othoNormalBasisMatrixFromPlane(planeLS);
      const localPlaneMatrix = mat4_exports.invert(mat4_exports.create(), planeLocalMatrix);
      const { values } = outlinesUniformsData;
      values.planeLocalMatrix = planeLocalMatrix;
      values.localPlaneMatrix = localPlaneMatrix;
      values.color = color;
      this.updateUniformBuffer(outlineUniforms, outlinesUniformsData);
    }
  }
  extractPick(pickBuffer, x, y, sampleDiscRadius, pickCameraPlane) {
    const { canvas, wasm, width, height } = this;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    const px = Math.min(Math.max(0, Math.round(x / cssWidth * width)), width);
    const py = Math.min(Math.max(0, Math.round((1 - (y + 0.5) / cssHeight) * height)), height);
    const floats = new Float32Array(pickBuffer.buffer);
    const r = Math.ceil(sampleDiscRadius);
    const r2 = sampleDiscRadius * sampleDiscRadius;
    let x0 = px - r;
    let x1 = px + r + 1;
    let y0 = py - r;
    let y1 = py + r + 1;
    if (x0 < 0)
      x0 = 0;
    if (x1 > width)
      x1 = width;
    if (y0 < 0)
      y0 = 0;
    if (y1 > height)
      y1 = height;
    const samples = [];
    const { isOrtho, viewClipMatrix, viewWorldMatrix, viewWorldMatrixNormal } = this;
    const f16Max = 65504;
    for (let iy = y0; iy < y1; iy++) {
      const dy = iy - py;
      for (let ix = x0; ix < x1; ix++) {
        const dx = ix - px;
        if (dx * dx + dy * dy > r2)
          continue;
        const buffOffs = ix + iy * width;
        const objectId = pickBuffer[buffOffs * 4];
        if (objectId != 4294967295) {
          const depth = pickCameraPlane ? 0 : floats[buffOffs * 4 + 3];
          const [nx16, ny16, nz16, deviation16] = new Uint16Array(pickBuffer.buffer, buffOffs * 16 + 4, 4);
          const nx = wasm.float32(nx16);
          const ny = wasm.float32(ny16);
          const nz = wasm.float32(nz16);
          const dev32 = wasm.float32(deviation16);
          const deviation = Math.abs(dev32) < f16Max ? dev32 : void 0;
          const xCS = (ix + 0.5) / width * 2 - 1;
          const yCS = (iy + 0.5) / height * 2 - 1;
          const scale7 = isOrtho ? 1 : depth;
          const posVS = vec3_exports.fromValues(xCS / viewClipMatrix[0] * scale7, yCS / viewClipMatrix[5] * scale7, -depth);
          const position = vec3_exports.transformMat4(vec3_exports.create(), posVS, viewWorldMatrix);
          const normal = vec3_exports.fromValues(nx, ny, nz);
          vec3_exports.normalize(normal, normal);
          const sample = { x: ix - px, y: iy - py, position, normal, objectId, deviation, depth };
          samples.push(sample);
        }
      }
    }
    return samples;
  }
  async pick(x, y, options) {
    const sampleDiscRadius = options?.sampleDiscRadius ?? 0;
    const callAsync = options?.async ?? true;
    const pickCameraPlane = options?.pickCameraPlane ?? false;
    if (sampleDiscRadius < 0)
      return [];
    this.renderPickBuffers();
    const pickBufferPromise = this.buffers.pickBuffers();
    if (callAsync) {
      this.currentPick = (await pickBufferPromise).pick;
    } else {
      pickBufferPromise.then(({ pick }) => {
        this.currentPick = pick;
      });
    }
    const { currentPick, width, height } = this;
    if (currentPick === void 0 || width * height * 4 != currentPick.length) {
      return [];
    }
    return this.extractPick(currentPick, x, y, sampleDiscRadius, pickCameraPlane);
  }
};
var RenderContext = _RenderContext;
__publicField(RenderContext, "defaultModules");
function isPromise(promise) {
  return !!promise && typeof Reflect.get(promise, "then") === "function";
}

// ../core3d/wasm/float16.wasm
var float16_exports = {};
__export(float16_exports, {
  default: () => float16_default
});
var float16_default = __toBinary("AGFzbQEAAAABi4CAgAACYAF/AX1gAX0BfwODgICAAAIAAQSEgICAAAFwAAAFg4CAgAABAAEGgYCAgAAAB56AgIAAAwZtZW1vcnkCAAdmbG9hdDMyAAAHZmxvYXQxNgABCuyAgIAAAq2AgIAAACAAQQ10QYDA//8AcUGAgIDAA2pBACAAQYD4AXEbIABBEHRBgICAgHhxcr4LtICAgAABAX9BACAAvCIBQQ12QYCAAWogAUGAgID8B3FBgICAxANJGyABQRB2QYCAAnFyQf//A3EL");

// ../core3d/wasm/float16.ts
async function float16Instance() {
  const { instance } = await WebAssembly.instantiate(float16_default);
  return instance.exports;
}

// ../core3d/wasm/index.ts
async function wasmInstance() {
  const float16 = await float16Instance();
  const instance = { ...float16 };
  return instance;
}

// ../core3d/lut_ggx.png
var lut_ggx_exports = {};
__export(lut_ggx_exports, {
  default: () => lut_ggx_default
});
var lut_ggx_default = __toBinary("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");

// ../core3d/ktx.ts
var identifier = new Uint8Array([171, 75, 84, 88, 32, 49, 49, 187, 13, 10, 26, 10]);
var HEADER_LEN = 12 + 13 * 4;
var textureDataType = {
  [5121 /* UNSIGNED_BYTE */]: "UNSIGNED_BYTE",
  [33635 /* UNSIGNED_SHORT_5_6_5 */]: "UNSIGNED_SHORT_5_6_5",
  [32819 /* UNSIGNED_SHORT_4_4_4_4 */]: "UNSIGNED_SHORT_4_4_4_4",
  [32820 /* UNSIGNED_SHORT_5_5_5_1 */]: "UNSIGNED_SHORT_5_5_5_1",
  [5131 /* HALF_FLOAT */]: "HALF_FLOAT",
  // [GL.HALF_FLOAT_OES]: "HALF_FLOAT_OES",
  [5126 /* FLOAT */]: "FLOAT",
  [5123 /* UNSIGNED_SHORT */]: "UNSIGNED_SHORT",
  [5125 /* UNSIGNED_INT */]: "UNSIGNED_INT",
  [34042 /* UNSIGNED_INT_24_8 */]: "UNSIGNED_INT_24_8",
  [5120 /* BYTE */]: "BYTE",
  [5122 /* SHORT */]: "SHORT",
  [5124 /* INT */]: "INT",
  // [GL.FLOAT_32_UNSIGNED_INT_24_8_REV]: "FLOAT_32_UNSIGNED_INT_24_8_REV",
  [35902 /* UNSIGNED_INT_5_9_9_9_REV */]: "UNSIGNED_INT_5_9_9_9_REV",
  [33640 /* UNSIGNED_INT_2_10_10_10_REV */]: "UNSIGNED_INT_2_10_10_10_REV",
  [35899 /* UNSIGNED_INT_10F_11F_11F_REV */]: "UNSIGNED_INT_10F_11F_11F_REV"
};
var textureFormatBase = {
  [6407 /* RGB */]: "RGB",
  [6408 /* RGBA */]: "RGBA",
  [6406 /* ALPHA */]: "ALPHA",
  [6409 /* LUMINANCE */]: "LUMINANCE",
  [6410 /* LUMINANCE_ALPHA */]: "LUMINANCE_ALPHA",
  [6402 /* DEPTH_COMPONENT */]: "DEPTH_COMPONENT",
  [34041 /* DEPTH_STENCIL */]: "DEPTH_STENCIL",
  [35904 /* SRGB_EXT */]: "SRGB_EXT",
  [35906 /* SRGB_ALPHA_EXT */]: "SRGB_ALPHA_EXT",
  [6403 /* RED */]: "RED",
  [33319 /* RG */]: "RG",
  [36244 /* RED_INTEGER */]: "RED_INTEGER",
  [33320 /* RG_INTEGER */]: "RG_INTEGER",
  [36248 /* RGB_INTEGER */]: "RGB_INTEGER",
  [36249 /* RGBA_INTEGER */]: "RGBA_INTEGER"
};
var textureFormatUncompressed = {
  [33321 /* R8 */]: "R8",
  [36756 /* R8_SNORM */]: "R8_SNORM",
  [33323 /* RG8 */]: "RG8",
  [36757 /* RG8_SNORM */]: "RG8_SNORM",
  [32849 /* RGB8 */]: "RGB8",
  [36758 /* RGB8_SNORM */]: "RGB8_SNORM",
  [36194 /* RGB565 */]: "RGB565",
  [32854 /* RGBA4 */]: "RGBA4",
  [32855 /* RGB5_A1 */]: "RGB5_A1",
  [32856 /* RGBA8 */]: "RGBA8",
  [36759 /* RGBA8_SNORM */]: "RGBA8_SNORM",
  [32857 /* RGB10_A2 */]: "RGB10_A2",
  [36975 /* RGB10_A2UI */]: "RGB10_A2UI",
  [35905 /* SRGB8 */]: "SRGB8",
  [35907 /* SRGB8_ALPHA8 */]: "SRGB8_ALPHA8",
  [33325 /* R16F */]: "R16F",
  [33327 /* RG16F */]: "RG16F",
  [34843 /* RGB16F */]: "RGB16F",
  [34842 /* RGBA16F */]: "RGBA16F",
  [33326 /* R32F */]: "R32F",
  [33328 /* RG32F */]: "RG32F",
  [34837 /* RGB32F */]: "RGB32F",
  [34836 /* RGBA32F */]: "RGBA32F",
  [35898 /* R11F_G11F_B10F */]: "R11F_G11F_B10F",
  [35901 /* RGB9_E5 */]: "RGB9_E5",
  [33329 /* R8I */]: "R8I",
  [33330 /* R8UI */]: "R8UI",
  [33331 /* R16I */]: "R16I",
  [33332 /* R16UI */]: "R16UI",
  [33333 /* R32I */]: "R32I",
  [33334 /* R32UI */]: "R32UI",
  [33335 /* RG8I */]: "RG8I",
  [33336 /* RG8UI */]: "RG8UI",
  [33337 /* RG16I */]: "RG16I",
  [33338 /* RG16UI */]: "RG16UI",
  [33339 /* RG32I */]: "RG32I",
  [33340 /* RG32UI */]: "RG32UI",
  [36239 /* RGB8I */]: "RGB8I",
  [36221 /* RGB8UI */]: "RGB8UI",
  [36233 /* RGB16I */]: "RGB16I",
  [36215 /* RGB16UI */]: "RGB16UI",
  [36227 /* RGB32I */]: "RGB32I",
  [36209 /* RGB32UI */]: "RGB32UI",
  [36238 /* RGBA8I */]: "RGBA8I",
  [36220 /* RGBA8UI */]: "RGBA8UI",
  [36232 /* RGBA16I */]: "RGBA16I",
  [36214 /* RGBA16UI */]: "RGBA16UI",
  [36226 /* RGBA32I */]: "RGBA32I",
  [36208 /* RGBA32UI */]: "RGBA32UI"
  // [GL.SRGB8_ALPHA8_EXT]: "SRGB8_ALPHA8_EXT",
};
var textureFormatCompressed = {
  [33776 /* COMPRESSED_RGB_S3TC_DXT1_EXT */]: "COMPRESSED_RGB_S3TC_DXT1_EXT",
  [33777 /* COMPRESSED_RGBA_S3TC_DXT1_EXT */]: "COMPRESSED_RGBA_S3TC_DXT1_EXT",
  [33778 /* COMPRESSED_RGBA_S3TC_DXT3_EXT */]: "COMPRESSED_RGBA_S3TC_DXT3_EXT",
  [33779 /* COMPRESSED_RGBA_S3TC_DXT5_EXT */]: "COMPRESSED_RGBA_S3TC_DXT5_EXT",
  [37488 /* COMPRESSED_R11_EAC */]: "COMPRESSED_R11_EAC",
  [37489 /* COMPRESSED_SIGNED_R11_EAC */]: "COMPRESSED_SIGNED_R11_EAC",
  [37490 /* COMPRESSED_RG11_EAC */]: "COMPRESSED_RG11_EAC",
  [37491 /* COMPRESSED_SIGNED_RG11_EAC */]: "COMPRESSED_SIGNED_RG11_EAC",
  [37492 /* COMPRESSED_RGB8_ETC2 */]: "COMPRESSED_RGB8_ETC2",
  [37493 /* COMPRESSED_RGBA8_ETC2_EAC */]: "COMPRESSED_RGBA8_ETC2_EAC",
  [37494 /* COMPRESSED_SRGB8_ETC2 */]: "COMPRESSED_SRGB8_ETC2",
  [37495 /* COMPRESSED_SRGB8_ALPHA8_ETC2_EAC */]: "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC",
  [37496 /* COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 */]: "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2",
  [37497 /* COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 */]: "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2",
  [35840 /* COMPRESSED_RGB_PVRTC_4BPPV1_IMG */]: "COMPRESSED_RGB_PVRTC_4BPPV1_IMG",
  [35842 /* COMPRESSED_RGBA_PVRTC_4BPPV1_IMG */]: "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG",
  [35841 /* COMPRESSED_RGB_PVRTC_2BPPV1_IMG */]: "COMPRESSED_RGB_PVRTC_2BPPV1_IMG",
  [35843 /* COMPRESSED_RGBA_PVRTC_2BPPV1_IMG */]: "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG",
  [36196 /* COMPRESSED_RGB_ETC1_WEBGL */]: "COMPRESSED_RGB_ETC1_WEBGL"
  // [GL.COMPRESSED_RGB_ATC_WEBGL]: "COMPRESSED_RGB_ATC_WEBGL",
  // [GL.COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL]: "COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL",
  // [GL.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL]: "COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL",
};
var textureFormatInternal = {
  ...textureFormatUncompressed,
  ...textureFormatCompressed
  // [GL.DEPTH_COMPONENT16]: "DEPTH_COMPONENT16",
  // [GL.DEPTH_COMPONENT24]: "DEPTH_COMPONENT24",
  // [GL.DEPTH_COMPONENT32F]: "DEPTH_COMPONENT32F",
  // [GL.DEPTH32F_STENCIL8]: "DEPTH32F_STENCIL8",
};
function parseHeader(ktx) {
  const idDataView = new DataView(ktx.buffer, ktx.byteOffset, 12);
  for (let i = 0; i < identifier.length; i++) {
    if (idDataView.getUint8(i) != identifier[i]) {
      throw new Error("texture missing KTX identifier");
    }
  }
  const dataSize = Uint32Array.BYTES_PER_ELEMENT;
  const headerDataView = new DataView(ktx.buffer, 12 + ktx.byteOffset, 13 * dataSize);
  const endianness = headerDataView.getUint32(0, true);
  const littleEndian = endianness === 67305985;
  return {
    glType: headerDataView.getUint32(1 * dataSize, littleEndian),
    // must be 0 for compressed textures
    glTypeSize: headerDataView.getUint32(2 * dataSize, littleEndian),
    // must be 1 for compressed textures
    glFormat: headerDataView.getUint32(3 * dataSize, littleEndian),
    // must be 0 for compressed textures
    glInternalFormat: headerDataView.getUint32(4 * dataSize, littleEndian),
    // the value of arg passed to gl.texImage2D() or gl.compressedTexImage2D(,,x,,,,)
    glBaseInternalFormat: headerDataView.getUint32(5 * dataSize, littleEndian),
    // specify GL_RGB, GL_RGBA, GL_ALPHA, etc (un-compressed only)
    pixelWidth: headerDataView.getUint32(6 * dataSize, littleEndian),
    // level 0 value of arg passed to gl.compressedTexImage2D(,,,x,,,)
    pixelHeight: headerDataView.getUint32(7 * dataSize, littleEndian),
    // level 0 value of arg passed to gl.compressedTexImage2D(,,,,x,,)
    pixelDepth: headerDataView.getUint32(8 * dataSize, littleEndian),
    // level 0 value of arg passed to gl.compressedTexImage3D(,,,,,x,,)
    numberOfArrayElements: headerDataView.getUint32(9 * dataSize, littleEndian),
    // used for texture arrays
    numberOfFaces: headerDataView.getUint32(10 * dataSize, littleEndian),
    // used for cubemap textures, should either be 1 or 6
    numberOfMipmapLevels: headerDataView.getUint32(11 * dataSize, littleEndian),
    // number of levels; disregard possibility of 0 for compressed textures
    bytesOfKeyValueData: headerDataView.getUint32(12 * dataSize, littleEndian),
    // the amount of space after the header for meta-data
    littleEndian
  };
}
function* getImages(header, ktx, littleEndian) {
  const mips = Math.max(1, header.numberOfMipmapLevels);
  const elements = Math.max(1, header.numberOfArrayElements);
  const faces = header.numberOfFaces;
  const depth = Math.max(1, header.pixelDepth);
  let dataOffset = HEADER_LEN + header.bytesOfKeyValueData;
  const imageSizeDenom = faces == 6 && header.numberOfArrayElements == 0 ? 1 : elements * faces * depth;
  const dataView = new DataView(ktx.buffer, ktx.byteOffset);
  for (let mip = 0; mip < mips; mip++) {
    const width = header.pixelWidth >> mip;
    const height = header.pixelHeight >> mip;
    const imageSize = dataView.getInt32(dataOffset, littleEndian);
    dataOffset += 4;
    const imageStride = imageSize / imageSizeDenom;
    console.assert(imageStride % 4 == 0);
    for (let element = 0; element < elements; element++) {
      for (let face = 0; face < faces; face++) {
        for (let z_slice = 0; z_slice < depth; z_slice++) {
          const begin = dataOffset;
          dataOffset += imageStride;
          const end = dataOffset;
          const image = { mip, element, face, width, height, blobRange: [begin, end], buffer: ktx.subarray(begin, end) };
          yield image;
        }
      }
    }
  }
  console.assert(dataOffset == ktx.byteLength);
}
function parseKTX(ktx) {
  const header = parseHeader(ktx);
  const { littleEndian } = header;
  const baseFormat = textureFormatBase[header.glBaseInternalFormat];
  const isArray = header.numberOfArrayElements > 0;
  const isCube = header.numberOfFaces == 6;
  const is3D = header.pixelDepth > 0;
  const hasMips = header.numberOfMipmapLevels > 1;
  const numMips = Math.max(1, header.numberOfMipmapLevels);
  const internalFormat = textureFormatInternal[header.glInternalFormat];
  const kind = isArray ? "TEXTURE_ARRAY" : isCube ? "TEXTURE_CUBE_MAP" : is3D ? "TEXTURE_3D" : "TEXTURE_2D";
  const type = header.glType ? textureDataType[header.glType] : void 0;
  const dim = { width: header.pixelWidth, height: header.pixelHeight, ...is3D ? { depth: header.pixelDepth } : void 0 };
  let mips = void 0;
  if (isCube) {
    const images = new Array(numMips).fill(null).map((_) => []);
    for (const image of getImages(header, ktx, littleEndian)) {
      images[image.mip][image.face] = image.buffer;
    }
    mips = images;
  } else {
    mips = new Array(numMips);
    for (const image of getImages(header, ktx, littleEndian)) {
      mips[image.mip] = image.buffer;
    }
  }
  const imageData = hasMips ? { mipMaps: mips } : { image: mips[0] };
  return {
    kind,
    internalFormat,
    type,
    ...dim,
    ...imageData
  };
}

// ../core3d/modules/background/shader.vert
var shader_default = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Background {\n    BackgroundUniforms background;\n};\n\nuniform BackgroundTextures textures;\n\nout BackgroundVaryings varyings;\n\nvoid main() {\n    // output degenerate triangle if ortho camera to use clear color instead\n    bool isPerspective = camera.viewClipMatrix[3][3] == 0.0;\n    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;\n    gl_Position = isPerspective ? vec4(pos, 1, 1) : vec4(0);\n    vec3 dirVS = vec3(pos.x / camera.viewClipMatrix[0][0], pos.y / camera.viewClipMatrix[1][1], -1);\n    varyings.dir = camera.viewLocalMatrixNormal * dirVS;\n}\n";

// ../core3d/modules/background/shader.frag
var shader_default2 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Background {\n    BackgroundUniforms background;\n};\n\nuniform BackgroundTextures textures;\n\nin BackgroundVaryings varyings;\n\nlayout(location = 0) out vec4 fragColor;\n\nvoid main() {\n    vec3 rgb;\n    if(background.envBlurNormalized == 0.) {\n        rgb = texture(textures.skybox, normalize(varyings.dir)).rgb;\n    } else {\n        float lod = background.envBlurNormalized * float(background.mipCount - 1);\n        lod = min(lod, float(background.mipCount - 4)); // the last 3 mips are black for some reason (because of RGBA16F format?), so we clamp to avoid this.\n        rgb = textureLod(textures.ibl.specular, normalize(varyings.dir), lod).rgb;\n    }\n    fragColor = vec4(rgb, 1);\n}";

// ../core3d/modules/background/index.ts
var BackgroundModule = class {
  kind = "background";
  abortController;
  url;
  textureParams;
  // undefined means no change in textures
  uniforms = {
    envBlurNormalized: "float",
    mipCount: "int"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new BackgroundModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return glUBOProxy(this.uniforms);
  }
  async createResources(context, uniformsProxy) {
    const bin = context.resourceBin("Background");
    const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
    const uniformBufferBlocks = ["Camera", "Background"];
    const textureUniforms = ["textures.skybox", "textures.ibl.specular"];
    const program = await context.makeProgramAsync(bin, { vertexShader: shader_default, fragmentShader: shader_default2, uniformBufferBlocks, textureUniforms });
    return { bin, uniforms, program };
  }
  async downloadTextures(urlDir) {
    if (this.abortController) {
      this.abortController.abort();
    }
    const abortController = this.abortController = new AbortController();
    const { signal } = abortController;
    try {
      const scriptUrl = document.currentScript?.src ?? import.meta.url;
      const baseUrl = new URL(urlDir, scriptUrl);
      const promises = [
        download2(new URL("radiance.ktx", baseUrl)),
        download2(new URL("irradiance.ktx", baseUrl)),
        download2(new URL("background.ktx", baseUrl))
      ];
      const [specular, diffuse, skybox] = await Promise.all(promises);
      this.textureParams = { diffuse, specular, skybox };
    } finally {
      this.abortController = void 0;
    }
    async function download2(url) {
      const response = await fetch(url, { mode: "cors", signal });
      if (response.ok) {
        var ktxData = await response.arrayBuffer();
        var params = parseKTX(new Uint8Array(ktxData));
        return params;
      } else {
        throw new Error(`HTTP Error:${response.status} ${response.status}`);
      }
    }
  }
};
var BackgroundModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
    this.skybox = resources.bin.createTexture(context.defaultIBLTextureParams);
  }
  skybox;
  update(state) {
    const { context, resources, module, uniforms, skybox } = this;
    const { bin } = resources;
    const { background } = state;
    if (context.hasStateChanged({ background })) {
      uniforms.values.envBlurNormalized = background.blur ?? 0;
      context.updateUniformBuffer(resources.uniforms, this.uniforms);
      const { url } = state.background;
      if (url) {
        if (url != module.url) {
          module.downloadTextures(url).then(() => {
            context.changed = true;
          });
        }
      } else {
        context.updateIBLTextures(null);
        bin.delete(skybox);
        this.skybox = bin.createTexture(context.defaultIBLTextureParams);
      }
      module.url = url;
    }
    if (module.textureParams) {
      context.updateIBLTextures(module.textureParams);
      bin.delete(skybox);
      this.skybox = bin.createTexture(module.textureParams.skybox);
      uniforms.values.mipCount = context.iblTextures.numMipMaps;
      context.updateUniformBuffer(resources.uniforms, this.uniforms);
      module.textureParams = void 0;
    }
  }
  render(state) {
    const { context, resources, skybox } = this;
    const { program, uniforms } = resources;
    const { gl, cameraUniforms, samplerSingle, samplerMip } = context;
    const clearColor = state.background.color ?? [0.33, 0.33, 0.33, 1];
    if ((!state.background.color || state.background.url) && state.camera.kind != "orthographic") {
      const { specular } = context.iblTextures;
      glState(gl, {
        program,
        uniformBuffers: [cameraUniforms, uniforms],
        textures: [
          { kind: "TEXTURE_CUBE_MAP", texture: skybox, sampler: samplerSingle },
          { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip }
        ],
        depth: {
          test: false,
          writeMask: false
        }
      });
      const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
      context["addRenderStatistics"](stats);
    } else {
      glClear(gl, { kind: "COLOR", drawBuffer: 0, color: clearColor });
    }
  }
  contextLost() {
    const { module } = this;
    module.url = void 0;
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};

// ../core3d/modules/grid/shader.vert
var shader_default3 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Grid {\n    GridUniforms grid;\n};\n\nout GridVaryings varyings;\n\nvoid main() {\n    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;\n    vec2 posOS = (vec2(gl_VertexID % 2, gl_VertexID / 2) * 2. - 1.) * grid.distance;\n    posOS += vec2(dot(cameraPosLS - grid.origin, grid.axisX), dot(cameraPosLS - grid.origin, grid.axisY));\n    vec3 posLS = grid.origin + grid.axisX * posOS.x + grid.axisY * posOS.y;\n    varyings.posOS = posOS;\n    varyings.posLS = posLS;\n    gl_Position = camera.viewClipMatrix * camera.localViewMatrix * vec4(posLS, 1);\n}\n";

// ../core3d/modules/grid/shader.frag
var shader_default4 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Grid {\n    GridUniforms grid;\n};\n\nin GridVaryings varyings;\n\nlayout(location = 0) out vec4 fragColor;\n\nfloat getGrid(vec2 r) {\n    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);\n    float line = min(grid.x, grid.y);\n    return 1.0 - min(line, 1.0);\n}\n\nvoid main() {\n    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;\n    float d = 1.0 - min(distance(cameraPosLS, varyings.posLS) / grid.distance, 1.0);\n    float g1 = getGrid(varyings.posOS / grid.size1);\n    float g2 = getGrid(varyings.posOS / grid.size2);\n    fragColor = vec4(g2 > 0.001 ? grid.color2 : grid.color1, max(g2, g1) * pow(d, 3.0));\n    fragColor.a = mix(0.5 * fragColor.a, fragColor.a, g2) * 1.5;\n    if(fragColor.a <= 0.0)\n        discard;\n}\n";

// ../core3d/modules/grid/index.ts
var GridModule = class {
  kind = "grid";
  uniforms = {
    origin: "vec3",
    axisX: "vec3",
    axisY: "vec3",
    size1: "float",
    size2: "float",
    color1: "vec3",
    color2: "vec3",
    distance: "float"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new GridModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return glUBOProxy(this.uniforms);
  }
  async createResources(context, uniformsProxy) {
    const bin = context.resourceBin("Grid");
    const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
    const program = await context.makeProgramAsync(bin, { vertexShader: shader_default3, fragmentShader: shader_default4, uniformBufferBlocks: ["Camera", "Grid"] });
    return { bin, uniforms, program };
  }
};
var GridModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
  }
  update(state) {
    const { context, resources } = this;
    const { uniforms } = resources;
    const { grid, localSpaceTranslation } = state;
    if (context.hasStateChanged({ grid, localSpaceTranslation })) {
      const { values } = this.uniforms;
      const { axisX, axisY, origin } = grid;
      const worldLocalMatrix = mat4_exports.fromTranslation(mat4_exports.create(), vec3_exports.negate(vec3_exports.create(), localSpaceTranslation));
      values.origin = vec3_exports.transformMat4(vec3_exports.create(), origin, worldLocalMatrix);
      values.axisX = axisX;
      values.axisY = axisY;
      values.color1 = grid.color1;
      values.color2 = grid.color2;
      values.size1 = grid.size1;
      values.size2 = grid.size2;
      values.distance = grid.distance;
      context.updateUniformBuffer(uniforms, this.uniforms);
    }
  }
  render(state) {
    const { context, resources } = this;
    const { program, uniforms } = resources;
    const { gl, cameraUniforms } = context;
    if (state.grid.enabled) {
      glState(gl, {
        program,
        uniformBuffers: [cameraUniforms, uniforms],
        depth: {
          test: true,
          writeMask: false
        },
        sample: {
          alphaToCoverage: false
        },
        blend: {
          enable: true,
          srcRGB: "SRC_ALPHA",
          dstRGB: "ONE_MINUS_SRC_ALPHA",
          srcAlpha: "ZERO",
          dstAlpha: "ONE"
        }
      });
      const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
      context["addRenderStatistics"](stats);
    }
  }
  contextLost() {
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};

// ../core3d/modules/octree/shaders/render.vert
var render_default = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Scene {\n    SceneUniforms scene;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nuniform OctreeTextures textures;\n\nout OctreeVaryings varyings;\nflat out OctreeVaryingsFlat varyingsFlat;\n\nlayout(location = 0) in vec4 vertexPosition;\n#if (PASS != PASS_PRE)\nlayout(location = 1) in vec3 vertexNormal;\nlayout(location = 2) in uint vertexMaterial;\nlayout(location = 3) in uint vertexObjectId;\nlayout(location = 4) in vec2 vertexTexCoord0;\nlayout(location = 5) in vec4 vertexColor0;\nlayout(location = 6) in vec4 vertexProjectedPos;\nlayout(location = 7) in vec4 vertexDeviations;\nlayout(location = 8) in uint vertexHighlight;\n#else\nconst vec3 vertexNormal = vec3(0);\nconst uint vertexMaterial = 0U;\nconst uint vertexObjectId = 0U;\nconst vec2 vertexTexCoord0 = vec2(0);\nconst vec4 vertexColor0 = vec4(1);\nconst vec4 vertexProjectedPos = vec4(0);\nconst vec4 vertexDeviations = vec4(0);\nconst uint vertexHighlight = 0U;\n#endif\n\nvoid main() {\n    vec4 vertPos = vertexPosition;\n    if(scene.useProjectedPosition && vertexProjectedPos.w != 0.) {\n        vertPos = vertexProjectedPos;\n    }\n    vec4 posLS = node.modelLocalMatrix * vertPos;\n    vec4 posVS = camera.localViewMatrix * posLS;\n    gl_Position = camera.viewClipMatrix * posVS;\n\n    vec4 color = vertexMaterial == 0xffU ? vertexColor0 : texture(textures.materials, vec2((float(vertexMaterial) + .5) / 256., .5));\n    float deviation = uintBitsToFloat(0x7f800000U); // +inf\n\n#if (MODE == MODE_POINTS)\n    deviation = vertexDeviations[scene.deviationIndex];\n    if(scene.deviationFactor > 0. && deviation != uintBitsToFloat(0x7f800000U)) {\n        vec4 gradientColor = getGradientColor(textures.gradients, deviation, deviationV, scene.deviationRange);\n        color = mix(vertexColor0, gradientColor, scene.deviationFactor);\n    }\n\n        // compute point size\n    float linearSize = scene.metricSize + node.tolerance * scene.toleranceFactor;\n    float projectedSize = max(0., camera.viewClipMatrix[1][1] * linearSize * float(camera.viewSize.y) * 0.5 / gl_Position.w);\n    gl_PointSize = min(scene.maxPixelSize, max(1.0, scene.pixelSize + projectedSize));\n\n        // Convert position to window coordinates\n    vec2 halfsize = camera.viewSize * 0.5;\n    varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);\n\n        // Convert radius to window coordinates\n    varyings.radius = max(1.0, gl_PointSize * 0.5);\n#elif defined (HIGHLIGHT)\n    if(vertexHighlight >= 0xFEU) {\n        gl_Position = vec4(0); // hide 0xff group by outputting degenerate triangles/lines\n    }\n#endif\n\n    varyings.positionVS = posVS.xyz;\n    varyings.normalVS = normalize(camera.localViewMatrixNormal * vertexNormal);\n    varyings.texCoord0 = vertexTexCoord0;\n    varyings.deviation = deviation;\n    varyings.elevation = posLS.y;\n    varyingsFlat.color = color;\n    varyingsFlat.objectId = vertexObjectId;\n    varyingsFlat.highlight = vertexHighlight;\n}\n";

// ../core3d/modules/octree/shaders/render.frag
var render_default2 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Scene {\n    SceneUniforms scene;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nuniform OctreeTextures textures;\n\nin OctreeVaryings varyings;\nflat in OctreeVaryingsFlat varyingsFlat;\n\n#if (PASS != PASS_PICK)\nlayout(location = 0) out vec4 fragColor;\n#else\nlayout(location = 1) out uvec4 fragPick;\n#endif\n\nvoid main() {\n    float linearDepth = -varyings.positionVS.z;\n#if defined(CLIP)\n    if(linearDepth < camera.near)\n        discard;\n\n    float s = clipping.mode == clippingModeIntersection ? -1. : 1.;\n    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;\n    for(uint i = 0U; i < clipping.numPlanes; i++) {\n        inside = inside && dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.;\n    }\n    if (clipping.mode == clippingModeIntersection ? inside : !inside) {\n        discard;\n    }\n#endif\n\n    vec4 baseColor;\n    uint objectId;\n    uint highlight;\n    baseColor = varyingsFlat.color;\n    objectId = varyingsFlat.objectId;\n    highlight = varyingsFlat.highlight;\n\n    vec3 normalVS = normalize(varyings.normalVS);\n    // compute geometric/flat normal from derivatives\n    vec3 axisX = dFdx(varyings.positionVS);\n    vec3 axisY = dFdy(varyings.positionVS);\n    vec3 geometricNormalVS = normalize(cross(axisX, axisY));\n\n    // ensure that vertex normal points in same direction as geometric normal (which always faces camera)\n    if(dot(normalVS, normalVS) < 0.1 || dot(normalVS, geometricNormalVS) < 0.) {\n        normalVS = geometricNormalVS;\n    }\n    vec3 normalWS = normalize(camera.viewLocalMatrixNormal * normalVS);\n    vec3 geometricNormalWS = normalize(camera.viewLocalMatrixNormal * geometricNormalVS);\n\n    vec4 rgba = vec4(0);\n#if (MODE == MODE_POINTS)\n    rgba = baseColor;\n#elif (MODE == MODE_TERRAIN)\n    rgba = getGradientColor(textures.gradients, varyings.elevation, elevationV, scene.elevationRange);\n#elif (MODE == MODE_TRIANGLES)\n    if(baseColor == vec4(0)) {\n        rgba = texture(textures.base_color, varyings.texCoord0);\n    } else {\n        rgba = baseColor;\n#if (PASS != PASS_PICK)\n        vec4 diffuseOpacity = rgba;\n        diffuseOpacity.rgb = sRGBToLinear(diffuseOpacity.rgb);\n\n        vec4 specularShininess = vec4(mix(0.4f, 0.1f, baseColor.a)); // TODO: get from varyings instead\n        specularShininess.rgb = sRGBToLinear(specularShininess.rgb);\n\n        vec3 V = camera.viewLocalMatrixNormal * normalize(varyings.positionVS);\n        vec3 N = normalize(normalWS);\n\n        vec3 irradiance = texture(textures.ibl.diffuse, N).rgb;\n        float perceptualRoughness = clamp((1.0f - specularShininess.a), 0.0f, 1.0f);\n        perceptualRoughness *= perceptualRoughness;\n        float lod = perceptualRoughness * (scene.iblMipCount - 1.0f);\n        vec3 reflection = textureLod(textures.ibl.specular, reflect(V, N), lod).rgb;\n\n        vec3 rgb = diffuseOpacity.rgb * irradiance + specularShininess.rgb * reflection;\n        rgba = vec4(rgb, rgba.a);\n#endif\n    }\n#endif\n\n#if (PASS == PASS_PICK)\n    if(rgba.a < scene.pickOpacityThreshold)\n        discard;\n#endif\n\n#if defined (HIGHLIGHT)\n    if(highlight == 254U) {\n        discard;\n    }\n    if(highlight != 0U || !scene.applyDefaultHighlight) {\n        float u = (float(highlight) + 0.5) / float(maxHighlights);\n        mat4 colorTransform;\n        colorTransform[0] = texture(textures.highlights, vec2(u, 0.5 / 5.0));\n        colorTransform[1] = texture(textures.highlights, vec2(u, 1.5 / 5.0));\n        colorTransform[2] = texture(textures.highlights, vec2(u, 2.5 / 5.0));\n        colorTransform[3] = texture(textures.highlights, vec2(u, 3.5 / 5.0));\n        vec4 colorTranslation = texture(textures.highlights, vec2(u, 4.5 / 5.0));\n        rgba = colorTransform * rgba + colorTranslation;\n    }\n#endif\n\n\n\n    // we put discards here (late) to avoid problems with derivative functions\n#if (MODE == MODE_POINTS)\n    if(distance(gl_FragCoord.xy, varyings.screenPos) > varyings.radius)\n        discard;\n#endif\n\n#if (PASS == PASS_PRE)\n    if(rgba.a < 1.)\n        discard;\n#elif (PASS != PASS_PICK)\n    if(rgba.a <= 0.)\n        discard;\n#endif\n\n#if defined (DITHER) && (PASS == PASS_COLOR)\n    if((rgba.a - 0.5 / 16.0) < dither(gl_FragCoord.xy))\n        discard;\n#endif\n\n#if (PASS != PASS_PICK)\n    fragColor = rgba;\n#elif defined (ADRENO600)\n    fragPick = uvec4(objectId, 0u, 0u, floatBitsToUint(linearDepth));\n#else\n    fragPick = uvec4(objectId, packNormalAndDeviation(geometricNormalWS, varyings.deviation), floatBitsToUint(linearDepth));\n#endif\n}\n";

// ../core3d/modules/octree/shaders/line.vert
var line_default = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Outline {\n    OutlineUniforms outline;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nlayout(location = 0) in vec4 vertexPositions;\nlayout(location = 1) in float vertexOpacity;\nlayout(location = 2) in uint vertexObjectId;\n\nout struct {\n    vec3 positionVS;\n    float opacity;\n} varyings;\n\nflat out struct {\n    uint objectId;\n} varyingsFlat;\n\nvoid main() {\n    vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;\n    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;\n    varyings.positionVS = posVS;\n    varyings.opacity = vertexOpacity;\n    varyingsFlat.objectId = vertexObjectId;\n    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);\n}\n";

// ../core3d/modules/octree/shaders/line.frag
var line_default2 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Outline {\n    OutlineUniforms outline;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nin struct {\n    vec3 positionVS;\n    float opacity;\n} varyings;\n\nflat in struct {\n    uint objectId;\n} varyingsFlat;\n\nlayout(location = 0) out vec4 fragColor;\nlayout(location = 1) out uvec4 fragPick;\n\nvoid main() {\n    // if(clipOutlines(varyings.positionVS, clipping))\n    //     discard;\n\n    fragColor = vec4(outline.color, varyings.opacity);\n    float linearDepth = -varyings.positionVS.z;\n    fragPick = uvec4(varyingsFlat.objectId, 0, 0, floatBitsToUint(linearDepth));\n}\n";

// ../core3d/modules/octree/shaders/intersect.vert
var intersect_default = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Outline {\n    OutlineUniforms outline;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nvec2 intersectEdge(vec3 p0, vec3 p1) {\n    float t = -p0.z / (p1.z - p0.z);\n    return mix(p0.xy, p1.xy, t);\n}\n\nlayout(location = 0) in vec4 vertexPos0;\nlayout(location = 1) in vec4 vertexPos1;\nlayout(location = 2) in vec4 vertexPos2;\nlayout(location = 3) in uint vertexObjectId;\n\nflat out vec4 line_vertices;\nout float opacity;\nflat out uint object_id;\n\nvoid main() {\n    vec3 pos0 = (outline.localPlaneMatrix * node.modelLocalMatrix * vertexPos0).xyz;\n    vec3 pos1 = (outline.localPlaneMatrix * node.modelLocalMatrix * vertexPos1).xyz;\n    vec3 pos2 = (outline.localPlaneMatrix * node.modelLocalMatrix * vertexPos2).xyz;\n    vec3 ab = pos1 - pos0;\n    vec3 ac = pos2 - pos0;\n    vec3 normal = normalize(cross(ab, ac));\n    vec3 z = vec3(pos0.z, pos1.z, pos2.z);\n    bvec3 gt = greaterThan(z, vec3(0));\n    bvec3 lt = lessThan(z, vec3(0));\n    int i = 0;\n    vec2 line[3];\n    // does triangle straddle clipping plane?\n    if(any(gt) && any(lt)) {\n        // find intersecting edges\n        if(any(gt.xy) && any(lt.xy)) {\n            line[i++] = intersectEdge(pos0, pos1);\n        }\n        if(any(gt.yz) && any(lt.yz)) {\n            line[i++] = intersectEdge(pos1, pos2);\n        }\n        if(any(gt.zx) && any(lt.zx)) {\n            line[i++] = intersectEdge(pos2, pos0);\n        }\n    }\n    if(i == 2) {\n        line_vertices = vec4(line[0], line[1]);\n    } else {\n        line_vertices = vec4(0);\n    }\n    opacity = 1. - abs(normal.z);\n    object_id = vertexObjectId;\n}\n";

// ../core3d/modules/octree/shaders/debug.vert
var debug_default = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Scene {\n    SceneUniforms scene;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nuniform OctreeTextures textures;\n\nstruct VaryingsFlat {\n    vec4 color;\n};\nflat out VaryingsFlat varyingsFlat;\n\nconst int ccwIndices[12] = int[12](0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2);\nconst int cwIndices[12] = int[12](0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3);\nconst vec3 corners[8] = vec3[8](vec3(-1, -1, -1), vec3(-1, 1, 1), vec3(1, -1, 1), vec3(1, 1, -1), vec3(-1, -1, 1), vec3(-1, 1, -1), vec3(1, -1, -1), vec3(1, 1, 1));\n\nvoid main() {\n    vec3 corner = corners[gl_VertexID / 12];\n    vec3 pos = corner;\n    pos = (pos + 1.) / 2.;\n    pos = mix(node.min, node.max, pos);\n    int idx = (gl_VertexID / 12) < 4 ? cwIndices[gl_VertexID % 12] : ccwIndices[gl_VertexID % 12];\n    varyingsFlat.color = node.debugColor;\n    if(idx > 0) {\n        vec3 extents = abs(node.max - node.min);\n        float minExtent = min(extents[0], min(extents[1], extents[2]));\n        pos[idx - 1] -= corner[idx - 1] * minExtent * .1;\n        varyingsFlat.color.rgb *= 0.75;\n    }\n    vec4 posVS = camera.localViewMatrix * vec4(pos, 1);\n    gl_Position = camera.viewClipMatrix * posVS;\n}\n";

// ../core3d/modules/octree/shaders/debug.frag
var debug_default2 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Scene {\n    SceneUniforms scene;\n};\n\nlayout(std140) uniform Node {\n    NodeUniforms node;\n};\n\nuniform OctreeTextures textures;\n\nstruct VaryingsFlat {\n    vec4 color;\n};\nflat in VaryingsFlat varyingsFlat;\n\nlayout(location = 0) out vec4 color;\n\nvoid main() {\n    color = varyingsFlat.color;\n}\n";

// ../core3d/modules/octree/shaders/index.ts
var shaders = {
  render: {
    vertexShader: render_default,
    fragmentShader: render_default2
  },
  line: {
    vertexShader: line_default,
    fragmentShader: line_default2
  },
  intersect: {
    vertexShader: intersect_default
  },
  debug: {
    vertexShader: debug_default,
    fragmentShader: debug_default2
  }
};

// ../core3d/modules/octree/mesh.ts
function* createMeshes(resourceBin, geometry) {
  const textures = geometry.textures.map((ti) => {
    if (ti) {
      return resourceBin.createTexture(ti.params);
    }
  });
  for (const subMesh of geometry.subMeshes) {
    let convertAttrib2 = function(a) {
      return a ? { ...a, buffer: buffers[a.buffer] } : null;
    };
    var convertAttrib = convertAttrib2;
    const { vertexAttributes, vertexBuffers, indices, numVertices, numTriangles, drawRanges, objectRanges, materialType } = subMesh;
    const buffers = vertexBuffers.map((vb) => {
      return resourceBin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vb });
    });
    const ib = typeof indices != "number" ? resourceBin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices }) : void 0;
    const count = typeof indices == "number" ? indices : indices.length;
    const indexType = indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
    const { triangles, position, normal, material, objectId, texCoord, color, projectedPos, deviations, highlight } = vertexAttributes;
    const attributes = [position, normal, material, objectId, texCoord, color, projectedPos, deviations, highlight].map(convertAttrib2);
    const triangleAttributes = triangles ? triangles.map(convertAttrib2) : null;
    const highlightVB = buffers[highlight.buffer];
    const vao = resourceBin.createVertexArray({ attributes, indices: ib });
    const vaoPosOnly = position.buffer != 0 ? resourceBin.createVertexArray({ attributes: [attributes[0]], indices: ib }) : null;
    const vaoTriangles = triangleAttributes ? resourceBin.createVertexArray({ attributes: triangleAttributes }) : null;
    resourceBin.subordinate(vao, ...buffers.filter((buf) => buf != highlightVB));
    if (ib) {
      resourceBin.subordinate(vao, ib);
    }
    const drawParams = ib ? { kind: "elements", mode: subMesh.primitiveType, indexType, count } : { kind: "arrays", mode: subMesh.primitiveType, count };
    const baseColorTextureIndex = subMesh.baseColorTexture;
    const baseColorTexture = textures[baseColorTextureIndex] ?? null;
    yield { vao, vaoPosOnly, vaoTriangles, highlightVB, drawParams, drawRanges, numVertices, numTriangles, objectRanges, materialType, baseColorTexture };
  }
}
function updateMeshHighlights(gl, mesh, highlights) {
  const { highlightVB } = mesh;
  if (highlightVB) {
    const highlightBuffer = new Uint8Array(mesh.numVertices);
    if (highlights) {
      for (const { objectId, beginVertex, endVertex } of mesh.objectRanges) {
        const highlight = highlights[objectId];
        if (highlight) {
          highlightBuffer.fill(highlight, beginVertex, endVertex);
        }
      }
    }
    glUpdateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: highlightBuffer, targetBuffer: highlightVB });
  }
}
function deleteMesh(resourceBin, mesh) {
  const { vao, vaoPosOnly, vaoTriangles, highlightVB, baseColorTexture } = mesh;
  resourceBin.delete(vao, vaoPosOnly, vaoTriangles, highlightVB, baseColorTexture);
}
function getMultiDrawParams(mesh, childMask) {
  const drawRanges = mesh.drawRanges.filter((r) => (1 << r.childIndex & childMask) != 0);
  if (drawRanges.length == 0) {
    return;
  }
  const offsetsList = new Int32Array(drawRanges.map((r) => r.byteOffset));
  const countsList = new Int32Array(drawRanges.map((r) => r.count));
  const drawCount = offsetsList.length;
  const { drawParams } = mesh;
  const { mode } = drawParams;
  function isElements2(params) {
    return "indexType" in params;
  }
  if (isElements2(drawParams)) {
    const { indexType } = drawParams;
    return {
      kind: "elements_multidraw",
      mode,
      drawCount,
      indexType,
      byteOffsets: offsetsList,
      counts: countsList
    };
  } else {
    return {
      kind: "arrays_multidraw",
      mode,
      drawCount,
      firstsList: offsetsList,
      counts: countsList
    };
  }
}
function meshPrimitiveCount(mesh, renderedChildMask) {
  let numPrimitives = 0;
  const primitiveType = mesh.drawParams.mode ?? "TRIANGLES";
  for (const drawRange of mesh.drawRanges) {
    const childMask = 1 << drawRange.childIndex;
    if ((renderedChildMask & childMask) != 0) {
      numPrimitives += calcNumPrimitives2(drawRange.count, primitiveType);
    }
  }
  return numPrimitives;
}
function calcNumPrimitives2(vertexCount, primitiveType) {
  let primitiveCount = 0;
  switch (primitiveType) {
    case "TRIANGLES":
      primitiveCount = vertexCount / 3;
      break;
    case "TRIANGLE_STRIP":
    case "TRIANGLE_FAN":
      primitiveCount = vertexCount - 2;
      break;
    case "LINES":
      primitiveCount = vertexCount / 2;
      break;
    case "LINE_STRIP":
      primitiveCount = vertexCount - 1;
      break;
    default:
      primitiveCount = vertexCount;
  }
  return primitiveCount;
}

// ../core3d/modules/octree/node.ts
var _OctreeNode = class {
  constructor(context, data, parent) {
    this.context = context;
    this.data = data;
    const geometryKind = this.geometryKind = typeof parent == "object" ? parent.geometryKind : parent;
    this.parent = typeof parent == "object" ? parent : void 0;
    const { sphere, box } = data.bounds;
    const { center, radius } = sphere;
    this.id = data.id;
    this.resourceBin = context.renderContext.resourceBin("Node");
    this.center = center;
    this.radius = radius;
    this.center4 = vec4_exports.fromValues(center[0], center[1], center[2], 1);
    const [x0, y0, z0] = box.min;
    const [x1, y1, z1] = box.max;
    this.corners = [
      vec4_exports.fromValues(x0, y0, z0, 1),
      vec4_exports.fromValues(x1, y0, z0, 1),
      vec4_exports.fromValues(x0, y1, z0, 1),
      vec4_exports.fromValues(x1, y1, z0, 1),
      vec4_exports.fromValues(x0, y0, z1, 1),
      vec4_exports.fromValues(x1, y0, z1, 1),
      vec4_exports.fromValues(x0, y1, z1, 1),
      vec4_exports.fromValues(x1, y1, z1, 1)
    ];
    const errorModifier = _OctreeNode.errorModifiers[geometryKind];
    this.size = Math.max(box.max[0] - box.min[0], Math.max(box.max[1] - box.min[1], box.max[2] - box.min[2])) * 4 * errorModifier;
    this.uniformsData = glUBOProxy({
      modelLocalMatrix: "mat4",
      tolerance: "float",
      debugColor: "vec4",
      min: "vec3",
      max: "vec3"
    });
    this.uniformsData.values.tolerance = Math.pow(2, data.tolerance);
  }
  id;
  parent;
  resourceBin;
  center;
  radius;
  size;
  children = [];
  meshes = [];
  uniformsData;
  geometryKind;
  uniforms;
  center4;
  corners;
  hasValidModelLocalMatrix = false;
  state = 0 /* collapsed */;
  download;
  visibility = 0 /* undefined */;
  viewDistance = 0;
  projectedSize = 0;
  dispose() {
    const { meshes, uniforms, children, resourceBin } = this;
    for (const mesh of meshes) {
      deleteMesh(resourceBin, mesh);
    }
    if (uniforms) {
      resourceBin.delete(uniforms);
      this.uniforms = void 0;
    }
    console.assert(resourceBin.size == 0);
    resourceBin.dispose();
    for (const child of children) {
      child.dispose();
    }
    meshes.length = 0;
    children.length = 0;
    this.download?.abort();
    this.download = void 0;
    this.state = 0 /* collapsed */;
  }
  get isRoot() {
    return !this.parent;
  }
  get path() {
    return this.id;
  }
  get isSplit() {
    return this.state != 0 /* collapsed */;
  }
  get hasGeometry() {
    return this.meshes.length > 0 || this.uniforms != void 0;
  }
  get renderedChildMask() {
    let { childMask } = this.data;
    for (const child of this.children) {
      if (child.hasGeometry) {
        childMask &= ~(1 << child.data.childIndex);
      }
    }
    return childMask;
  }
  shouldSplit(projectedSizeSplitThreshold) {
    const { visibility, projectedSize, context, geometryKind } = this;
    const hidden = context.hidden[geometryKind ?? -1] ?? false;
    return !hidden && (this.isRoot || visibility != 1 /* none */ && projectedSize > projectedSizeSplitThreshold);
  }
  intersectsPlane(plane) {
    const { center4, radius, corners } = this;
    const distance4 = vec4_exports.dot(plane, center4);
    if (Math.abs(distance4) > radius) {
      return false;
    }
    let side = 0;
    for (const corner of corners) {
      const distance5 = vec4_exports.dot(plane, corner);
      const distSgn = Math.sign(distance5);
      if (side && distSgn != side) {
        return true;
      }
      if (distSgn) {
        side = distSgn;
      }
    }
    return false;
  }
  computeVisibility(state) {
    const { center4, radius, corners } = this;
    let fullyInside = true;
    let fullyOutside = false;
    const { planes } = state.viewFrustum;
    for (const plane of planes) {
      const distance4 = vec4_exports.dot(plane, center4);
      if (distance4 > radius) {
        fullyOutside = true;
        fullyInside = false;
        break;
      } else if (distance4 > -radius)
        fullyInside = false;
    }
    if (fullyInside === fullyOutside) {
      fullyOutside = true;
      fullyInside = true;
      for (const corner of corners) {
        for (const plane of planes) {
          const distance4 = vec4_exports.dot(plane, corner);
          if (distance4 > 0) {
            fullyInside = false;
          } else {
            fullyOutside = false;
          }
        }
      }
    }
    let visibility = 0 /* undefined */;
    if (fullyOutside) {
      visibility = 1 /* none */;
    } else if (!fullyInside) {
      visibility = 2 /* partial */;
    } else {
      visibility = 3 /* full */;
    }
    return visibility;
  }
  get renderedPrimitives() {
    let numPrimitives = 0;
    if (this.visibility != 1 /* none */) {
      const { renderedChildMask } = this;
      if (renderedChildMask) {
        for (const mesh of this.meshes) {
          numPrimitives += meshPrimitiveCount(mesh, renderedChildMask);
        }
      }
    }
    return numPrimitives;
  }
  update(state, parentVisibility = 2 /* partial */) {
    this.visibility = parentVisibility == 2 /* partial */ ? this.computeVisibility(state) : parentVisibility;
    const { context, center4, visibility, radius, uniforms, data, uniformsData, children } = this;
    const { camera, matrices, viewFrustum } = state;
    const imagePlane = viewFrustum.image;
    const projection2 = matrices.getMatrix(1 /* View */, 2 /* Clip */);
    const viewDistance = this.viewDistance = vec4_exports.dot(imagePlane, center4);
    if (visibility <= 1 /* none */) {
      this.projectedSize = 0;
    } else if (camera.kind == "pinhole") {
      const distance4 = Math.max(1e-3, viewDistance - radius);
      this.projectedSize = this.size * projection2[5] / (-distance4 * projection2[11]);
    } else {
      this.projectedSize = this.size * projection2[5];
    }
    if (context.localSpaceChanged || !this.hasValidModelLocalMatrix) {
      let { offset, scale: scale7 } = data;
      const [ox, oy, oz] = offset;
      const [tx, ty, tz] = state.localSpaceTranslation;
      const modelLocalMatrix = mat4_exports.fromValues(
        scale7,
        0,
        0,
        0,
        0,
        scale7,
        0,
        0,
        0,
        0,
        scale7,
        0,
        ox - tx,
        oy - ty,
        oz - tz,
        1
      );
      const { values } = this.uniformsData;
      values.modelLocalMatrix = modelLocalMatrix;
      if (uniforms) {
        glUpdateBuffer(context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniforms });
      }
      this.hasValidModelLocalMatrix = true;
    }
    if (context.debug) {
      let r = 0, g = 0, b = 0;
      switch (visibility) {
        case 2 /* partial */:
          g = 0.25;
          break;
        case 3 /* full */:
          g = 1;
          break;
      }
      switch (this.state) {
        case 2 /* downloading */:
          r = 1;
          break;
        case 3 /* ready */:
          b = 1;
          break;
      }
      const worldLocalMatrix = mat4_exports.fromTranslation(mat4_exports.create(), vec3_exports.negate(vec3_exports.create(), state.localSpaceTranslation));
      const { min: min4, max: max4 } = data.bounds.box;
      const { values } = uniformsData;
      values.debugColor = vec4_exports.fromValues(r, g, b, 1);
      values.min = vec3_exports.transformMat4(vec3_exports.create(), min4, worldLocalMatrix);
      values.max = vec3_exports.transformMat4(vec3_exports.create(), max4, worldLocalMatrix);
      if (uniforms) {
        glUpdateBuffer(context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniforms });
      }
    }
    for (const child of children) {
      child.update(state, this.visibility);
    }
  }
  async downloadNode() {
    const { context, children, meshes, resourceBin } = this;
    const { renderContext, loader, version } = context;
    this.state = 2 /* downloading */;
    const payload = await loader.loadNode(this, version);
    if (payload) {
      const { childInfos, geometry } = payload;
      for (const data of childInfos) {
        const child = new _OctreeNode(context, data, this);
        children.push(child);
      }
      meshes.push(...createMeshes(resourceBin, geometry));
      this.uniforms = resourceBin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: this.uniformsData.buffer.byteLength });
      glUpdateBuffer(this.context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: this.uniformsData.buffer, targetBuffer: this.uniforms });
      renderContext.changed = true;
      this.state = 3 /* ready */;
    } else {
      this.state = 0 /* collapsed */;
    }
  }
  applyHighlights(highlights) {
    const { context, meshes } = this;
    const { gl } = context.renderContext;
    for (const mesh of meshes) {
      updateMeshHighlights(gl, mesh, highlights);
    }
  }
};
var OctreeNode = _OctreeNode;
__publicField(OctreeNode, "errorModifiers", {
  [0 /* terrain */]: 0.08,
  [1 /* triangles */]: 1,
  [2 /* lines */]: 0.5,
  [3 /* points */]: 0.15,
  [4 /* documents */]: 0.08
});

// ../core3d/scene.ts
async function downloadScene(url, abortController) {
  if (!abortController)
    abortController = new AbortController();
  const { signal } = abortController;
  const fullUrl = new URL(url);
  fullUrl.pathname += "scene.json";
  const config = await download(fullUrl, "json", signal);
  console.assert(config.version == "2.0");
  return { url: url.toString(), config };
}
async function createSceneRootNodes(context, config, deviceProfile) {
  const { buffer } = decodeBase64(config.root);
  const { loader } = context;
  const result = await loader.parseNode(buffer, "", deviceProfile, config.version);
  if (!result)
    return;
  const { childInfos } = result;
  const rootNodes = {};
  let hasNodes = false;
  for (const childInfo of childInfos) {
    const geometryKind = childInfo.childIndex;
    const child = new OctreeNode(context, childInfo, geometryKind);
    rootNodes[childInfo.childIndex] = child;
    hasNodes = true;
  }
  return hasNodes ? rootNodes : void 0;
}
async function download(url, kind, signal) {
  const response = await fetch(url, { mode: "cors", signal });
  if (response.ok) {
    return await response[kind]();
  } else {
    throw new Error(`HTTP Error:${response.status} ${response.status}`);
  }
}

// ../core3d/modules/octree/worker/schema_2_0.ts
function readSchema(r) {
  const sizes = r.u32(9);
  const flags = r.u8(10);
  const schema = {
    childInfo: {
      length: sizes[0],
      hash: { start: r.u32(sizes[0]), count: r.u32(sizes[0]) },
      childIndex: r.u8(sizes[0]),
      childMask: r.u32(sizes[0]),
      tolerance: r.i8(sizes[0]),
      totalByteSize: r.u32(sizes[0]),
      offset: {
        length: sizes[0],
        x: r.f64(sizes[0]),
        y: r.f64(sizes[0]),
        z: r.f64(sizes[0])
      },
      scale: r.f32(sizes[0]),
      bounds: {
        length: sizes[0],
        box: {
          length: sizes[0],
          min: {
            length: sizes[0],
            x: r.f32(sizes[0]),
            y: r.f32(sizes[0]),
            z: r.f32(sizes[0])
          },
          max: {
            length: sizes[0],
            x: r.f32(sizes[0]),
            y: r.f32(sizes[0]),
            z: r.f32(sizes[0])
          }
        },
        sphere: {
          length: sizes[0],
          origo: {
            length: sizes[0],
            x: r.f32(sizes[0]),
            y: r.f32(sizes[0]),
            z: r.f32(sizes[0])
          },
          radius: r.f32(sizes[0])
        }
      },
      subMeshes: { start: r.u32(sizes[0]), count: r.u32(sizes[0]) }
    },
    hashBytes: r.u8(sizes[1]),
    subMeshProjection: {
      length: sizes[2],
      objectId: r.u32(sizes[2]),
      primitiveType: r.u8(sizes[2]),
      attributes: r.u8(sizes[2]),
      numDeviations: r.u8(sizes[2]),
      numIndices: r.u32(sizes[2]),
      numVertices: r.u32(sizes[2]),
      numTextureBytes: r.u32(sizes[2])
    },
    subMesh: {
      length: sizes[3],
      childIndex: r.u8(sizes[3]),
      objectId: r.u32(sizes[3]),
      materialIndex: r.u8(sizes[3]),
      primitiveType: r.u8(sizes[3]),
      materialType: r.u8(sizes[3]),
      attributes: r.u8(sizes[3]),
      numDeviations: r.u8(sizes[3]),
      vertices: { start: r.u32(sizes[3]), count: r.u32(sizes[3]) },
      primitiveVertexIndices: { start: r.u32(sizes[3]), count: r.u32(sizes[3]) },
      edgeVertexIndices: { start: r.u32(sizes[3]), count: r.u32(sizes[3]) },
      cornerVertexIndices: { start: r.u32(sizes[3]), count: r.u32(sizes[3]) },
      textures: { start: r.u8(sizes[3]), count: r.u8(sizes[3]) }
    },
    textureInfo: {
      length: sizes[4],
      semantic: r.u8(sizes[4]),
      transform: {
        length: sizes[4],
        e00: r.f32(sizes[4]),
        e01: r.f32(sizes[4]),
        e02: r.f32(sizes[4]),
        e10: r.f32(sizes[4]),
        e11: r.f32(sizes[4]),
        e12: r.f32(sizes[4]),
        e20: r.f32(sizes[4]),
        e21: r.f32(sizes[4]),
        e22: r.f32(sizes[4])
      },
      pixelRange: { start: r.u32(sizes[4]), count: r.u32(sizes[4]) }
    },
    vertex: {
      length: sizes[5],
      position: {
        length: sizes[5],
        x: r.i16(sizes[5]),
        y: r.i16(sizes[5]),
        z: r.i16(sizes[5])
      },
      normal: !flags[0] ? void 0 : {
        length: sizes[5],
        x: r.i8(sizes[5]),
        y: r.i8(sizes[5]),
        z: r.i8(sizes[5])
      },
      color: !flags[1] ? void 0 : {
        length: sizes[5],
        red: r.u8(sizes[5]),
        green: r.u8(sizes[5]),
        blue: r.u8(sizes[5]),
        alpha: r.u8(sizes[5])
      },
      texCoord: !flags[2] ? void 0 : {
        length: sizes[5],
        x: r.f16(sizes[5]),
        y: r.f16(sizes[5])
      },
      projectedPos: !flags[3] ? void 0 : {
        length: sizes[5],
        x: r.i16(sizes[5]),
        y: r.i16(sizes[5]),
        z: r.i16(sizes[5])
      },
      deviations: {
        length: sizes[5],
        a: !flags[4] ? void 0 : r.f16(sizes[5]),
        b: !flags[5] ? void 0 : r.f16(sizes[5]),
        c: !flags[6] ? void 0 : r.f16(sizes[5]),
        d: !flags[7] ? void 0 : r.f16(sizes[5])
      }
    },
    triangle: {
      length: sizes[6],
      topologyFlags: !flags[8] ? void 0 : r.u8(sizes[6])
    },
    vertexIndex: !flags[9] ? void 0 : r.u16(sizes[7]),
    texturePixels: r.u8(sizes[8])
  };
  console.assert(r.eof);
  return schema;
}

// ../core3d/modules/octree/worker/util.ts
var Float16Array = Uint16Array;
var BufferReader = class {
  constructor(buffer) {
    this.buffer = buffer;
    this._u8 = new Uint8Array(buffer, 0, Math.floor(buffer.byteLength / Uint8Array.BYTES_PER_ELEMENT));
    this._u16 = new Uint16Array(buffer, 0, Math.floor(buffer.byteLength / Uint16Array.BYTES_PER_ELEMENT));
    this._u32 = new Uint32Array(buffer, 0, Math.floor(buffer.byteLength / Uint32Array.BYTES_PER_ELEMENT));
    this._i8 = new Int8Array(buffer, 0, Math.floor(buffer.byteLength / Int8Array.BYTES_PER_ELEMENT));
    this._i16 = new Int16Array(buffer, 0, Math.floor(buffer.byteLength / Int16Array.BYTES_PER_ELEMENT));
    this._i32 = new Int32Array(buffer, 0, Math.floor(buffer.byteLength / Int32Array.BYTES_PER_ELEMENT));
    this._f16 = new Uint16Array(buffer, 0, Math.floor(buffer.byteLength / Uint16Array.BYTES_PER_ELEMENT));
    this._f32 = new Float32Array(buffer, 0, Math.floor(buffer.byteLength / Float32Array.BYTES_PER_ELEMENT));
    this._f64 = new Float64Array(buffer, 0, Math.floor(buffer.byteLength / Float64Array.BYTES_PER_ELEMENT));
  }
  pos = 0;
  _u8;
  _u16;
  _u32;
  _i8;
  _i16;
  _i32;
  _f16;
  _f32;
  _f64;
  read(ar, size) {
    if (size == 0)
      return ar.subarray(0, 0);
    const align = ar.BYTES_PER_ELEMENT;
    var padding = align - 1 - (this.pos + align - 1) % align;
    console.assert(padding >= 0 && padding < align);
    const begin = (this.pos + padding) / align;
    const end = begin + size;
    this.pos = end * ar.BYTES_PER_ELEMENT;
    return ar.subarray(begin, end);
  }
  get eof() {
    return this.pos == this.buffer.byteLength;
  }
  u8(size) {
    return this.read(this._u8, size);
  }
  u16(size) {
    return this.read(this._u16, size);
  }
  u32(size) {
    return this.read(this._u32, size);
  }
  i8(size) {
    return this.read(this._i8, size);
  }
  i16(size) {
    return this.read(this._i16, size);
  }
  i32(size) {
    return this.read(this._i32, size);
  }
  f16(size) {
    return this.read(this._f16, size);
  }
  f32(size) {
    return this.read(this._f32, size);
  }
  f64(size) {
    return this.read(this._f64, size);
  }
};

// ../core3d/modules/octree/worker/parser.ts
var primitiveTypeStrings = ["POINTS", "LINES", "LINE_LOOP", "LINE_STRIP", "TRIANGLES", "TRIANGLE_STRIP", "TRIANGLE_FAN"];
function getVec3(v, i) {
  return vec3_exports.fromValues(v.x[i], v.y[i], v.z[i]);
}
function getRange(v, i) {
  const begin = v.start[i];
  const end = begin + v.count[i];
  return [begin, end];
}
function computePrimitiveCount(primitiveType, numIndices) {
  switch (primitiveType) {
    case 0 /* points */:
      return numIndices;
    case 1 /* lines */:
      return numIndices / 2;
    case 2 /* line_loops */:
      return numIndices;
    case 3 /* line_strip */:
      return numIndices - 1;
    case 4 /* triangles */:
      return numIndices / 3;
    case 5 /* triangle_strip */:
      return numIndices - 2;
    case 6 /* triangle_fan */:
      return numIndices - 2;
    default:
      console.warn(`Unknown primitive type: ${primitiveType}!`);
  }
}
function getVertexAttribs(deviations) {
  return {
    position: { type: Uint16Array, components: ["x", "y", "z"] },
    normal: { type: Int8Array, components: ["x", "y", "z"] },
    texCoord: { type: Float16Array, components: ["x", "y"] },
    color: { type: Uint8Array, components: ["red", "green", "blue", "alpha"] },
    projectedPos: { type: Uint16Array, components: ["x", "y", "z"] },
    deviations: { type: Float16Array, components: ["a", "b", "c", "d"].slice(0, deviations) },
    materialIndex: { type: Uint8Array },
    objectId: { type: Uint32Array }
  };
}
function computeVertexOffsets(attribs, deviations = 0) {
  let offset = 0;
  let offsets = {};
  function alignOffset(alignment) {
    const padding = alignment - 1 - (offset + alignment - 1) % alignment;
    offset += padding;
  }
  let maxAlign = 1;
  const vertexAttribs = getVertexAttribs(deviations);
  for (const attrib of attribs) {
    const { type, components } = vertexAttribs[attrib];
    const count = components?.length ?? 1;
    maxAlign = Math.max(maxAlign, type.BYTES_PER_ELEMENT);
    alignOffset(type.BYTES_PER_ELEMENT);
    offsets[attrib] = offset;
    offset += type.BYTES_PER_ELEMENT * count;
  }
  alignOffset(maxAlign);
  offsets.stride = offset;
  return offsets;
}
function getVertexAttribNames(optionalAttributes, deviations, hasMaterials, hasObjectIds) {
  const attribNames = ["position"];
  if (optionalAttributes & 1 /* normal */)
    attribNames.push("normal");
  if (optionalAttributes & 4 /* texCoord */)
    attribNames.push("texCoord");
  if (optionalAttributes & 2 /* color */)
    attribNames.push("color");
  if (optionalAttributes & 8 /* projectedPos */)
    attribNames.push("projectedPos");
  if (deviations > 0)
    attribNames.push("deviations");
  if (hasMaterials) {
    attribNames.push("materialIndex");
  }
  if (hasObjectIds) {
    attribNames.push("objectId");
  }
  return attribNames;
}
function aggregateSubMeshProjections(subMeshProjection, range, separatePositionBuffer, predicate) {
  let primitives = 0;
  let totalTextureBytes = 0;
  let totalNumIndices = 0;
  let totalNumVertices = 0;
  let totalNumVertexBytes = 0;
  const [begin, end] = range;
  for (let i = begin; i < end; i++) {
    const objectId = subMeshProjection.objectId[i];
    if (predicate?.(objectId) ?? true) {
      const indices = subMeshProjection.numIndices[i];
      const vertices = subMeshProjection.numVertices[i];
      const textureBytes2 = subMeshProjection.numTextureBytes[i];
      const attributes = subMeshProjection.attributes[i];
      const deviations = subMeshProjection.numDeviations[i];
      const primitiveType = subMeshProjection.primitiveType[i];
      const hasMaterials = textureBytes2 == 0;
      const hasObjectIds = true;
      const [pos, ...rest] = getVertexAttribNames(attributes, deviations, hasMaterials, hasObjectIds);
      const numBytesPerVertex = separatePositionBuffer ? computeVertexOffsets([pos]).stride + computeVertexOffsets(rest, deviations).stride : computeVertexOffsets([pos, ...rest], deviations).stride;
      primitives += computePrimitiveCount(primitiveType, indices ? indices : vertices) ?? 0;
      totalNumIndices += indices;
      totalNumVertices += vertices;
      totalNumVertexBytes += vertices * numBytesPerVertex;
      totalTextureBytes += textureBytes2;
    } else {
    }
  }
  const idxStride = totalNumVertices < 65535 ? 2 : 4;
  const gpuBytes = totalTextureBytes + totalNumVertexBytes + totalNumIndices * idxStride;
  return { primitives, gpuBytes };
}
function toHex(bytes) {
  return Array.prototype.map.call(bytes, (x) => ("00" + x.toString(16).toUpperCase()).slice(-2)).join("");
}
function getChildren(parentId, schema, separatePositionBuffer, predicate) {
  const { childInfo, hashBytes } = schema;
  const children = [];
  const parentPrimitiveCounts = [];
  for (let i = 0; i < childInfo.length; i++) {
    const childIndex = childInfo.childIndex[i];
    const childMask = childInfo.childMask[i];
    const [hashBegin, hashEnd] = getRange(childInfo.hash, i);
    const hash = hashBytes.slice(hashBegin, hashEnd);
    const id = toHex(hash);
    const tolerance = childInfo.tolerance[i];
    const byteSize = childInfo.totalByteSize[i];
    const offset = getVec3(childInfo.offset, i);
    const scale7 = childInfo.scale[i];
    const bounds = {
      box: {
        min: getVec3(childInfo.bounds.box.min, i),
        max: getVec3(childInfo.bounds.box.max, i)
      },
      sphere: {
        center: getVec3(childInfo.bounds.sphere.origo, i),
        radius: childInfo.bounds.sphere.radius[i]
      }
    };
    const { sphere, box } = bounds;
    vec3_exports.add(sphere.center, sphere.center, offset);
    vec3_exports.add(box.min, box.min, offset);
    vec3_exports.add(box.max, box.max, offset);
    const subMeshProjectionRange = getRange(childInfo.subMeshes, i);
    const parentPrimitives = parentPrimitiveCounts[childIndex];
    const { primitives, gpuBytes } = aggregateSubMeshProjections(schema.subMeshProjection, subMeshProjectionRange, separatePositionBuffer, predicate);
    const primitivesDelta = primitives - (parentPrimitives ?? 0);
    children.push({ id, childIndex, childMask, tolerance, byteSize, offset, scale: scale7, bounds, primitives, primitivesDelta, gpuBytes });
  }
  return children;
}
function* getSubMeshes(schema, predicate) {
  const { subMesh } = schema;
  for (let i = 0; i < subMesh.length; i++) {
    const objectId = subMesh.objectId[i];
    if (predicate?.(objectId) ?? true) {
      const childIndex = subMesh.childIndex[i];
      const objectId2 = subMesh.objectId[i];
      const materialIndex = subMesh.materialIndex[i];
      const materialType = subMesh.materialType[i];
      const primitiveType = subMesh.primitiveType[i];
      const attributes = subMesh.attributes[i];
      const deviations = subMesh.numDeviations[i];
      const vertexRange = getRange(subMesh.vertices, i);
      const indexRange = getRange(subMesh.primitiveVertexIndices, i);
      const textureRange = getRange(subMesh.textures, i);
      yield { childIndex, objectId: objectId2, materialIndex, materialType, primitiveType, attributes, deviations, vertexRange, indexRange, textureRange };
    }
  }
}
function copyToInterleavedArray(dst, src, byteOffset, byteStride, begin, end) {
  const offset = byteOffset / dst.BYTES_PER_ELEMENT;
  const stride = byteStride / dst.BYTES_PER_ELEMENT;
  console.assert(Math.round(offset) == offset);
  console.assert(Math.round(stride) == stride);
  let j = offset;
  for (let i = begin; i < end; i++) {
    dst[j] = src[i];
    j += stride;
  }
}
function fillToInterleavedArray(dst, src, byteOffset, byteStride, begin, end) {
  const offset = byteOffset / dst.BYTES_PER_ELEMENT;
  const stride = byteStride / dst.BYTES_PER_ELEMENT;
  console.assert(Math.round(offset) == offset);
  console.assert(Math.round(stride) == stride);
  let j = offset;
  for (let i = begin; i < end; i++) {
    dst[j] = src;
    j += stride;
  }
}
function getGeometry(schema, separatePositionBuffer, enableOutlines, highlights, predicate) {
  const { vertex, vertexIndex } = schema;
  const filteredSubMeshes = [...getSubMeshes(schema, predicate)];
  let subMeshes = [];
  const referencedTextures = /* @__PURE__ */ new Set();
  const groups = /* @__PURE__ */ new Map();
  for (let i = 0; i < filteredSubMeshes.length; i++) {
    const { materialType, primitiveType, attributes, deviations, childIndex } = filteredSubMeshes[i];
    const key = `${materialType}_${primitiveType}_${attributes}_${deviations}_${childIndex}`;
    let group = groups.get(key);
    if (!group) {
      group = { materialType, primitiveType, attributes, deviations, subMeshIndices: [] };
      groups.set(key, group);
    }
    group.subMeshIndices.push(i);
  }
  highlights.mutex.lockSync();
  for (const { materialType, primitiveType, attributes, deviations, subMeshIndices } of groups.values()) {
    let enumerateBuffers2 = function(possibleBuffers) {
      const buffers = [];
      const indices2 = {};
      for (const [key, value] of Object.entries(possibleBuffers)) {
        const buffer = value;
        let index2 = -1;
        if (buffer) {
          index2 = buffers.indexOf(buffer);
          if (index2 < 0) {
            index2 = buffers.length;
            buffers.push(buffer);
          }
        }
        Reflect.set(indices2, key, index2);
      }
      return [buffers, indices2];
    };
    var enumerateBuffers = enumerateBuffers2;
    if (subMeshIndices.length == 0)
      continue;
    const groupMeshes = subMeshIndices.map((i) => filteredSubMeshes[i]);
    const hasMaterials = groupMeshes.some((m) => m.materialIndex != 255);
    const hasObjectIds = groupMeshes.some((m) => m.objectId != 4294967295);
    const allAttribNames = getVertexAttribNames(attributes, deviations, hasMaterials, hasObjectIds);
    const [posName, ...extraAttribNames] = allAttribNames;
    const attribNames = separatePositionBuffer ? extraAttribNames : allAttribNames;
    const positionStride = computeVertexOffsets([posName], deviations).stride;
    const trianglePosStride = positionStride * 3;
    const attribOffsets = computeVertexOffsets(attribNames, deviations);
    const vertexStride = attribOffsets.stride;
    const childIndices = [...new Set(groupMeshes.map((sm) => sm.childIndex))].sort();
    let numVertices = 0;
    let numIndices = 0;
    let numTriangles = 0;
    for (let i = 0; i < groupMeshes.length; i++) {
      const sm = groupMeshes[i];
      const vtxCnt = sm.vertexRange[1] - sm.vertexRange[0];
      const idxCnt = sm.indexRange[1] - sm.indexRange[0];
      numVertices += vtxCnt;
      numIndices += idxCnt;
      if (primitiveType == 4 /* triangles */) {
        numTriangles += Math.round((idxCnt > 0 ? idxCnt : vtxCnt) / 3);
      }
    }
    const vertexBuffer = new ArrayBuffer(numVertices * vertexStride);
    let trianglePosBuffer;
    let triangleObjectIdBuffer;
    if (enableOutlines && primitiveType == 4 /* triangles */) {
      trianglePosBuffer = new Int16Array(new ArrayBuffer(numTriangles * trianglePosStride));
      triangleObjectIdBuffer = new Uint32Array(numTriangles);
    }
    const positionBuffer = separatePositionBuffer ? new ArrayBuffer(numVertices * positionStride) : void 0;
    let indexBuffer;
    if (vertexIndex) {
      indexBuffer = new (numVertices < 65535 ? Uint16Array : Uint32Array)(numIndices);
    }
    const highlightBuffer = new Uint8Array(numVertices);
    let indexOffset = 0;
    let vertexOffset = 0;
    let trianglePosOffset = 0;
    let triangleObjectIdOffset = 0;
    let drawRanges = [];
    const objectRanges = [];
    const [vertexBuffers, bufIdx] = enumerateBuffers2({
      primary: vertexBuffer,
      highlight: highlightBuffer?.buffer,
      pos: positionBuffer,
      triPos: trianglePosBuffer?.buffer,
      triId: trianglePosBuffer?.buffer
    });
    for (const childIndex of childIndices) {
      const meshes = groupMeshes.filter((sm) => sm.childIndex == childIndex);
      if (meshes.length == 0)
        continue;
      const drawRangeBegin = indexBuffer ? indexOffset : vertexOffset;
      for (const subMesh of meshes) {
        const { vertexRange, indexRange, materialIndex, deviations: deviations2, objectId } = subMesh;
        const context = { materialIndex, objectId };
        const [beginVtx, endVtx] = vertexRange;
        const [beginIdx, endIdx] = indexRange;
        const vertexAttribs = getVertexAttribs(deviations2);
        for (const attribName of attribNames) {
          const { type, components } = vertexAttribs[attribName];
          const dst = new type(vertexBuffer, vertexOffset * vertexStride);
          const count2 = components?.length ?? 1;
          for (var c = 0; c < count2; c++) {
            const offs = attribOffsets[attribName] + c * type.BYTES_PER_ELEMENT;
            if (attribName in vertex) {
              let src = Reflect.get(vertex, attribName);
              if (components) {
                src = Reflect.get(src, components[c]);
              }
              copyToInterleavedArray(dst, src, offs, vertexStride, beginVtx, endVtx);
            } else {
              const src = Reflect.get(context, attribName);
              fillToInterleavedArray(dst, src, offs, vertexStride, beginVtx, endVtx);
            }
          }
        }
        if (trianglePosBuffer && triangleObjectIdBuffer) {
          const { x, y, z } = vertex.position;
          let numTriangles2 = 0;
          if (vertexIndex && indexBuffer) {
            numTriangles2 = (endIdx - beginIdx) / 3;
            for (let i = beginIdx; i < endIdx; i++) {
              const idx = vertexIndex[i] + beginVtx;
              trianglePosBuffer[trianglePosOffset++] = x[idx];
              trianglePosBuffer[trianglePosOffset++] = y[idx];
              trianglePosBuffer[trianglePosOffset++] = z[idx];
            }
          } else {
            numTriangles2 = (endVtx - beginVtx) / 3;
            for (let i = beginVtx; i < endVtx; i++) {
              const idx = i;
              trianglePosBuffer[trianglePosOffset++] = x[idx];
              trianglePosBuffer[trianglePosOffset++] = y[idx];
              trianglePosBuffer[trianglePosOffset++] = z[idx];
            }
          }
          triangleObjectIdBuffer.fill(objectId, triangleObjectIdOffset, triangleObjectIdOffset + numTriangles2);
          triangleObjectIdOffset += numTriangles2;
        }
        if (positionBuffer) {
          const i16 = new Int16Array(positionBuffer, vertexOffset * positionStride);
          copyToInterleavedArray(i16, vertex.position.x, 0, positionStride, beginVtx, endVtx);
          copyToInterleavedArray(i16, vertex.position.y, 2, positionStride, beginVtx, endVtx);
          copyToInterleavedArray(i16, vertex.position.z, 4, positionStride, beginVtx, endVtx);
        }
        if (vertexIndex && indexBuffer) {
          for (let i = beginIdx; i < endIdx; i++) {
            indexBuffer[indexOffset++] = vertexIndex[i] + vertexOffset;
          }
        }
        const highlightIndex = highlights.indices[objectId] ?? 0;
        if (highlightIndex) {
          highlightBuffer.fill(highlightIndex, vertexOffset, vertexOffset + (endVtx - beginVtx));
        }
        const prev = objectRanges.length - 1;
        const endVertex = vertexOffset + endVtx - beginVtx;
        if (prev >= 0 && objectRanges[prev].objectId == objectId) {
          objectRanges[prev].endVertex = endVertex;
        } else {
          objectRanges.push({ objectId, beginVertex: vertexOffset, endVertex });
        }
        vertexOffset += endVtx - beginVtx;
      }
      const drawRangeEnd = indexBuffer ? indexOffset : vertexOffset;
      const byteOffset = drawRangeBegin * (indexBuffer ? indexBuffer.BYTES_PER_ELEMENT : vertexStride);
      const count = drawRangeEnd - drawRangeBegin;
      drawRanges.push({ childIndex, byteOffset, first: drawRangeBegin, count });
    }
    console.assert(vertexOffset == numVertices);
    console.assert(indexOffset == numIndices);
    console.assert(trianglePosOffset == (trianglePosBuffer?.length ?? 0));
    console.assert(triangleObjectIdOffset == (triangleObjectIdBuffer?.length ?? 0));
    const indices = indexBuffer ?? numVertices;
    const [beginTexture, endTexture] = groupMeshes[0].textureRange;
    let baseColorTexture;
    if (endTexture > beginTexture) {
      baseColorTexture = beginTexture;
    }
    if (baseColorTexture != void 0) {
      referencedTextures.add(baseColorTexture);
    }
    const stride = vertexStride;
    const deviationsKind = deviations == 0 || deviations == 1 ? "FLOAT" : `FLOAT_VEC${deviations}`;
    const vertexAttributes = {
      position: { kind: "FLOAT_VEC4", buffer: bufIdx.pos, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: attribOffsets["position"], byteStride: separatePositionBuffer ? 0 : stride },
      normal: (attributes & 1 /* normal */) != 0 ? { kind: "FLOAT_VEC3", buffer: bufIdx.primary, componentCount: 3, componentType: "BYTE", normalized: true, byteOffset: attribOffsets["normal"], byteStride: stride } : null,
      material: hasMaterials ? { kind: "UNSIGNED_INT", buffer: bufIdx.primary, componentCount: 1, componentType: "UNSIGNED_BYTE", normalized: false, byteOffset: attribOffsets["materialIndex"], byteStride: stride } : null,
      objectId: hasObjectIds ? { kind: "UNSIGNED_INT", buffer: bufIdx.primary, componentCount: 1, componentType: "UNSIGNED_INT", normalized: false, byteOffset: attribOffsets["objectId"], byteStride: stride } : null,
      texCoord: (attributes & 4 /* texCoord */) != 0 ? { kind: "FLOAT_VEC2", buffer: bufIdx.primary, componentCount: 2, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["texCoord"], byteStride: stride } : null,
      color: (attributes & 2 /* color */) != 0 ? { kind: "FLOAT_VEC4", buffer: bufIdx.primary, componentCount: 4, componentType: "UNSIGNED_BYTE", normalized: true, byteOffset: attribOffsets["color"], byteStride: stride } : null,
      projectedPos: (attributes & 8 /* projectedPos */) != 0 ? { kind: "FLOAT_VEC4", buffer: bufIdx.primary, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: attribOffsets["projectedPos"], byteStride: stride } : null,
      deviations: deviations != 0 ? { kind: deviationsKind, buffer: bufIdx.primary, componentCount: deviations, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["deviations"], byteStride: stride } : null,
      triangles: trianglePosBuffer ? [
        { kind: "FLOAT_VEC4", buffer: bufIdx.triPos, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: 0, byteStride: 18 },
        { kind: "FLOAT_VEC4", buffer: bufIdx.triPos, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: 6, byteStride: 18 },
        { kind: "FLOAT_VEC4", buffer: bufIdx.triPos, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: 12, byteStride: 18 },
        { kind: "UNSIGNED_INT", buffer: bufIdx.triId, componentCount: 1, componentType: "UNSIGNED_INT", normalized: false, byteOffset: 0, byteStride: 4 }
      ] : null,
      highlight: { kind: "UNSIGNED_INT", buffer: bufIdx.highlight, componentCount: 1, componentType: "UNSIGNED_BYTE", normalized: false, byteOffset: 0, byteStride: 0 }
    };
    objectRanges.sort((a, b) => a.objectId - b.objectId);
    subMeshes.push({
      materialType,
      primitiveType: primitiveTypeStrings[primitiveType],
      numVertices,
      numTriangles,
      objectRanges,
      vertexAttributes,
      vertexBuffers,
      indices,
      baseColorTexture,
      drawRanges
    });
  }
  highlights.mutex.unlock();
  const textures = new Array(schema.textureInfo.length);
  const { textureInfo } = schema;
  for (const i of referencedTextures) {
    const [begin, end] = getRange(textureInfo.pixelRange, i);
    const semantic = textureInfo.semantic[i];
    const transform = [
      textureInfo.transform.e00[i],
      textureInfo.transform.e01[i],
      textureInfo.transform.e02[i],
      textureInfo.transform.e10[i],
      textureInfo.transform.e11[i],
      textureInfo.transform.e12[i],
      textureInfo.transform.e20[i],
      textureInfo.transform.e21[i],
      textureInfo.transform.e22[i]
    ];
    const ktx = schema.texturePixels.subarray(begin, end);
    const params = parseKTX(ktx);
    textures[i] = { semantic, transform, params };
  }
  return { subMeshes, textures };
}
function parseNode(id, separatePositionBuffer, enableOutlines, version, buffer, highlights, applyFilter) {
  console.assert(version == "2.0");
  const r = new BufferReader(buffer);
  var schema = readSchema(r);
  let predicate;
  predicate = applyFilter ? (objectId) => highlights.indices[objectId] != 255 : void 0;
  const childInfos = getChildren(id, schema, separatePositionBuffer, predicate);
  const geometry = getGeometry(schema, separatePositionBuffer, enableOutlines, highlights, predicate);
  return { childInfos, geometry };
}

// ../core3d/modules/octree/worker/download.ts
var AbortableDownload = class {
  constructor(download2) {
    this.download = download2;
  }
  result = Promise.resolve(void 0);
  aborted = false;
  start() {
    this.result = this.download();
  }
  abort() {
    this.aborted = true;
  }
};
var Downloader = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  activeDownloads = 0;
  completeResolve;
  async complete() {
    if (this.activeDownloads > 0) {
      const completePromise = new Promise((resolve, reject) => {
        this.completeResolve = resolve;
      });
      await completePromise;
      this.completeResolve = void 0;
    }
  }
  async request(filename) {
    const url = new URL(filename, this.baseUrl);
    if (!url.search)
      url.search = this.baseUrl?.search ?? "";
    const response = await fetch(url.toString(), { mode: "cors" });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}: ${response.statusText} (${url})`);
    }
    return response;
  }
  downloadArrayBufferAbortable(filename, buffer) {
    const self2 = this;
    const download2 = new AbortableDownload(buffer != void 0 ? downloadAsyncSize : downloadAsync);
    download2.start();
    return download2;
    async function downloadAsyncSize() {
      try {
        self2.activeDownloads++;
        const response = await self2.request(filename);
        if (!response.ok)
          throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
        const reader = response.body.getReader();
        const content = new Uint8Array(buffer);
        let offset = 0;
        while (!download2.aborted) {
          const { done, value } = await reader.read();
          if (done)
            break;
          content.set(value, offset);
          offset += value.length;
        }
        if (!download2.aborted) {
          console.assert(offset == content.length);
          return content.buffer;
        } else {
          reader.cancel();
        }
      } finally {
        self2.activeDownloads--;
        if (self2.activeDownloads == 0 && self2.completeResolve) {
          self2.completeResolve();
        }
      }
    }
    async function downloadAsync() {
      try {
        self2.activeDownloads++;
        const response = await self2.request(filename);
        if (!response.ok)
          throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        while (!download2.aborted) {
          const { done, value } = await reader.read();
          if (done)
            break;
          chunks.push(value);
          size += value.length;
        }
        if (!download2.aborted) {
          const content = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            content.set(chunk, offset);
            offset += chunk.length;
          }
          return content.buffer;
        } else {
          reader.cancel();
        }
      } finally {
        self2.activeDownloads--;
        if (self2.activeDownloads == 0 && self2.completeResolve) {
          self2.completeResolve();
        }
      }
    }
  }
};
__publicField(Downloader, "createImageData");

// ../core3d/modules/octree/mutex.ts
var Mutex = class {
  _view;
  constructor(buffer) {
    this._view = new Int32Array(buffer, 0, 1);
  }
  // will loop until lock is available, so be careful using this in main thread
  lockSpin() {
    const { _view } = this;
    for (; ; ) {
      if (Atomics.compareExchange(_view, 0, 0 /* unlocked */, 1 /* locked */) == 0 /* unlocked */) {
        return;
      }
    }
  }
  // blocking call, use in workers only!
  lockSync() {
    console.assert(self.Worker != void 0);
    const { _view } = this;
    for (; ; ) {
      if (Atomics.compareExchange(_view, 0, 0 /* unlocked */, 1 /* locked */) == 0 /* unlocked */) {
        return;
      }
      Atomics.wait(_view, 0, 1 /* locked */);
    }
  }
  // safe to use from main thread
  async lockAsync() {
    const { _view } = this;
    for (; ; ) {
      if (Atomics.compareExchange(_view, 0, 0 /* unlocked */, 1 /* locked */) == 0 /* unlocked */) {
        return;
      }
      const { async, value } = Atomics.waitAsync(_view, 0, 1 /* locked */);
      if (async) {
        await value;
      }
    }
  }
  unlock() {
    const { _view } = this;
    if (Atomics.compareExchange(_view, 0, 1 /* locked */, 0 /* unlocked */) != 1 /* locked */) {
      throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.notify(_view, 0);
  }
};

// ../core3d/modules/octree/worker/handler.ts
var LoaderHandler = class {
  // will be set right after construction by "buffer" message
  constructor(send) {
    this.send = send;
  }
  downloader = new Downloader();
  downloads = /* @__PURE__ */ new Map();
  highlights = void 0;
  receive(msg) {
    switch (msg.kind) {
      case "buffer":
        this.setBuffer(msg);
        break;
      case "parse":
        this.parse(msg);
        break;
      case "load":
        this.load(msg);
        break;
      case "abort":
        this.abort(msg);
        break;
      case "abort_all":
        this.abortAll(msg);
        break;
      default:
        console.error(`Uknown load message: ${msg}!`);
        break;
    }
  }
  setBuffer(msg) {
    const { buffer } = msg;
    const indices = new Uint8Array(buffer, 4);
    const mutex = new Mutex(buffer);
    this.highlights = { buffer, indices, mutex };
  }
  parseBuffer(buffer, params) {
    const { highlights } = this;
    const { id, version, separatePositionsBuffer, enableOutlines, applyFilter } = params;
    const { childInfos, geometry } = parseNode(id, separatePositionsBuffer, enableOutlines, version, buffer, highlights, applyFilter);
    const readyMsg = { kind: "ready", id, childInfos, geometry };
    const transfer = [];
    for (const { vertexBuffers, indices } of geometry.subMeshes) {
      transfer.push(...vertexBuffers);
      if (typeof indices != "number") {
        transfer.push(indices.buffer);
      }
    }
    this.send(readyMsg, transfer);
  }
  async parse(params) {
    const { id, buffer } = params;
    try {
      this.parseBuffer(buffer, params);
    } catch (error) {
      this.error(id, error);
    }
  }
  async load(params) {
    const { downloader, downloads } = this;
    const { url, id, byteSize } = params;
    try {
      const download2 = downloader.downloadArrayBufferAbortable(url, new ArrayBuffer(byteSize));
      downloads.set(id, download2);
      const buffer = await download2.result;
      downloads.delete(id);
      if (buffer) {
        this.parseBuffer(buffer, params);
      } else {
        const abortedMsg = { kind: "aborted", id };
        this.send(abortedMsg);
      }
    } catch (error) {
      this.error(id, error);
    }
  }
  removeNode(id) {
    const { downloads } = this;
    const download2 = downloads.get(id);
    downloads.delete(id);
    return { download: download2 };
  }
  error(id, error) {
    const { download: download2 } = this.removeNode(id);
    const errorMsg = { kind: "error", id, error };
    this.send(errorMsg);
  }
  abort(params) {
    const { id } = params;
    const { download: download2 } = this.removeNode(id);
    download2?.abort();
  }
  async abortAll(params) {
    const { downloads, downloader } = this;
    for (const download2 of downloads.values()) {
      download2.abort();
    }
    await downloader.complete();
    console.assert(downloads.size == 0);
    const abortedAllMsg = { kind: "aborted_all" };
    this.send(abortedAllMsg);
  }
};

// ../core3d/modules/octree/worker/index.ts
var useWorker = true;

// inline-worker:__inline-worker
function inlineWorker(scriptText) {
  let blob = new Blob([scriptText], { type: "text/javascript" });
  let url = URL.createObjectURL(blob);
  let worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}

// ../core3d/modules/octree/worker/index.worker.ts
function Worker2() {
  return inlineWorker('var ve=Object.defineProperty;var Xe=Object.getOwnPropertySymbols;var Ct=Object.prototype.hasOwnProperty,It=Object.prototype.propertyIsEnumerable;var ye=(t,e,r)=>e in t?ve(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r,L=(t,e)=>{for(var r in e||(e={}))Ct.call(e,r)&&ye(t,r,e[r]);if(Xe)for(var r of Xe(e))It.call(e,r)&&ye(t,r,e[r]);return t};var ct=(t,e)=>{for(var r in e)ve(t,r,{get:e[r],enumerable:!0})};var C=(t,e,r)=>(ye(t,typeof e!="symbol"?e+"":e,r),r);var fe=class{constructor(e){this.download=e;C(this,"result",Promise.resolve(void 0));C(this,"aborted",!1)}start(){this.result=this.download()}abort(){this.aborted=!0}},_e=class{constructor(e){this.baseUrl=e;C(this,"activeDownloads",0);C(this,"completeResolve")}async complete(){this.activeDownloads>0&&(await new Promise((r,n)=>{this.completeResolve=r}),this.completeResolve=void 0)}async request(e){var E,_;let r=new URL(e,this.baseUrl);r.search||(r.search=(_=(E=this.baseUrl)==null?void 0:E.search)!=null?_:"");let n=await fetch(r.toString(),{mode:"cors"});if(!n.ok)throw new Error(`HTTP Error: ${n.status}: ${n.statusText} (${r})`);return n}downloadArrayBufferAbortable(e,r){let n=this,E=new fe(r!=null?_:a);return E.start(),E;async function _(){try{n.activeDownloads++;let o=await n.request(e);if(!o.ok)throw new Error(`HTTP error: ${o.status} ${o.statusText}!`);let R=o.body.getReader(),s=new Uint8Array(r),A=0;for(;!E.aborted;){let{done:T,value:x}=await R.read();if(T)break;s.set(x,A),A+=x.length}if(E.aborted)R.cancel();else return console.assert(A==s.length),s.buffer}finally{n.activeDownloads--,n.activeDownloads==0&&n.completeResolve&&n.completeResolve()}}async function a(){try{n.activeDownloads++;let o=await n.request(e);if(!o.ok)throw new Error(`HTTP error: ${o.status} ${o.statusText}!`);let R=o.body.getReader(),s=[],A=0;for(;!E.aborted;){let{done:T,value:x}=await R.read();if(T)break;s.push(x),A+=x.length}if(E.aborted)R.cancel();else{let T=new Uint8Array(A),x=0;for(let i of s)T.set(i,x),x+=i.length;return T.buffer}}finally{n.activeDownloads--,n.activeDownloads==0&&n.completeResolve&&n.completeResolve()}}}};C(_e,"createImageData");var le=class{constructor(e){C(this,"_view");this._view=new Int32Array(e,0,1)}lockSpin(){let{_view:e}=this;for(;;)if(Atomics.compareExchange(e,0,0,1)==0)return}lockSync(){console.assert(self.Worker!=null);let{_view:e}=this;for(;;){if(Atomics.compareExchange(e,0,0,1)==0)return;Atomics.wait(e,0,1)}}async lockAsync(){let{_view:e}=this;for(;;){if(Atomics.compareExchange(e,0,0,1)==0)return;let{async:r,value:n}=Atomics.waitAsync(e,0,1);r&&await n}}unlock(){let{_view:e}=this;if(Atomics.compareExchange(e,0,1,0)!=1)throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");Atomics.notify(e,0)}};var Se=1e-6,oe=typeof Float32Array!="undefined"?Float32Array:Array,Oe=Math.random;var yr=Math.PI/180;Math.hypot||(Math.hypot=function(){for(var t=0,e=arguments.length;e--;)t+=arguments[e]*arguments[e];return Math.sqrt(t)});var q={};ct(q,{add:()=>Dt,angle:()=>jt,bezier:()=>vt,ceil:()=>Ft,clone:()=>Bt,copy:()=>ut,create:()=>Ve,cross:()=>gt,dist:()=>er,distance:()=>ke,div:()=>Lt,divide:()=>Ke,dot:()=>Ze,equals:()=>$t,exactEquals:()=>Qt,floor:()=>yt,forEach:()=>Er,fromValues:()=>Nt,hermite:()=>Xt,inverse:()=>ht,len:()=>rr,length:()=>we,lerp:()=>Ht,max:()=>Ot,min:()=>ft,mul:()=>Gt,multiply:()=>Ye,negate:()=>Pt,normalize:()=>bt,random:()=>Vt,rotateX:()=>Kt,rotateY:()=>kt,rotateZ:()=>zt,round:()=>Ut,scale:()=>pt,scaleAndAdd:()=>mt,set:()=>Mt,sqrDist:()=>tr,sqrLen:()=>nr,squaredDistance:()=>ze,squaredLength:()=>je,str:()=>qt,sub:()=>Jt,subtract:()=>We,transformMat3:()=>Wt,transformMat4:()=>wt,transformQuat:()=>Yt,zero:()=>Zt});function Ve(){var t=new oe(3);return oe!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function Bt(t){var e=new oe(3);return e[0]=t[0],e[1]=t[1],e[2]=t[2],e}function we(t){var e=t[0],r=t[1],n=t[2];return Math.hypot(e,r,n)}function Nt(t,e,r){var n=new oe(3);return n[0]=t,n[1]=e,n[2]=r,n}function ut(t,e){return t[0]=e[0],t[1]=e[1],t[2]=e[2],t}function Mt(t,e,r,n){return t[0]=e,t[1]=r,t[2]=n,t}function Dt(t,e,r){return t[0]=e[0]+r[0],t[1]=e[1]+r[1],t[2]=e[2]+r[2],t}function We(t,e,r){return t[0]=e[0]-r[0],t[1]=e[1]-r[1],t[2]=e[2]-r[2],t}function Ye(t,e,r){return t[0]=e[0]*r[0],t[1]=e[1]*r[1],t[2]=e[2]*r[2],t}function Ke(t,e,r){return t[0]=e[0]/r[0],t[1]=e[1]/r[1],t[2]=e[2]/r[2],t}function Ft(t,e){return t[0]=Math.ceil(e[0]),t[1]=Math.ceil(e[1]),t[2]=Math.ceil(e[2]),t}function yt(t,e){return t[0]=Math.floor(e[0]),t[1]=Math.floor(e[1]),t[2]=Math.floor(e[2]),t}function ft(t,e,r){return t[0]=Math.min(e[0],r[0]),t[1]=Math.min(e[1],r[1]),t[2]=Math.min(e[2],r[2]),t}function Ot(t,e,r){return t[0]=Math.max(e[0],r[0]),t[1]=Math.max(e[1],r[1]),t[2]=Math.max(e[2],r[2]),t}function Ut(t,e){return t[0]=Math.round(e[0]),t[1]=Math.round(e[1]),t[2]=Math.round(e[2]),t}function pt(t,e,r){return t[0]=e[0]*r,t[1]=e[1]*r,t[2]=e[2]*r,t}function mt(t,e,r,n){return t[0]=e[0]+r[0]*n,t[1]=e[1]+r[1]*n,t[2]=e[2]+r[2]*n,t}function ke(t,e){var r=e[0]-t[0],n=e[1]-t[1],E=e[2]-t[2];return Math.hypot(r,n,E)}function ze(t,e){var r=e[0]-t[0],n=e[1]-t[1],E=e[2]-t[2];return r*r+n*n+E*E}function je(t){var e=t[0],r=t[1],n=t[2];return e*e+r*r+n*n}function Pt(t,e){return t[0]=-e[0],t[1]=-e[1],t[2]=-e[2],t}function ht(t,e){return t[0]=1/e[0],t[1]=1/e[1],t[2]=1/e[2],t}function bt(t,e){var r=e[0],n=e[1],E=e[2],_=r*r+n*n+E*E;return _>0&&(_=1/Math.sqrt(_)),t[0]=e[0]*_,t[1]=e[1]*_,t[2]=e[2]*_,t}function Ze(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function gt(t,e,r){var n=e[0],E=e[1],_=e[2],a=r[0],o=r[1],R=r[2];return t[0]=E*R-_*o,t[1]=_*a-n*R,t[2]=n*o-E*a,t}function Ht(t,e,r,n){var E=e[0],_=e[1],a=e[2];return t[0]=E+n*(r[0]-E),t[1]=_+n*(r[1]-_),t[2]=a+n*(r[2]-a),t}function Xt(t,e,r,n,E,_){var a=_*_,o=a*(2*_-3)+1,R=a*(_-2)+_,s=a*(_-1),A=a*(3-2*_);return t[0]=e[0]*o+r[0]*R+n[0]*s+E[0]*A,t[1]=e[1]*o+r[1]*R+n[1]*s+E[1]*A,t[2]=e[2]*o+r[2]*R+n[2]*s+E[2]*A,t}function vt(t,e,r,n,E,_){var a=1-_,o=a*a,R=_*_,s=o*a,A=3*_*o,T=3*R*a,x=R*_;return t[0]=e[0]*s+r[0]*A+n[0]*T+E[0]*x,t[1]=e[1]*s+r[1]*A+n[1]*T+E[1]*x,t[2]=e[2]*s+r[2]*A+n[2]*T+E[2]*x,t}function Vt(t,e){e=e||1;var r=Oe()*2*Math.PI,n=Oe()*2-1,E=Math.sqrt(1-n*n)*e;return t[0]=Math.cos(r)*E,t[1]=Math.sin(r)*E,t[2]=n*e,t}function wt(t,e,r){var n=e[0],E=e[1],_=e[2],a=r[3]*n+r[7]*E+r[11]*_+r[15];return a=a||1,t[0]=(r[0]*n+r[4]*E+r[8]*_+r[12])/a,t[1]=(r[1]*n+r[5]*E+r[9]*_+r[13])/a,t[2]=(r[2]*n+r[6]*E+r[10]*_+r[14])/a,t}function Wt(t,e,r){var n=e[0],E=e[1],_=e[2];return t[0]=n*r[0]+E*r[3]+_*r[6],t[1]=n*r[1]+E*r[4]+_*r[7],t[2]=n*r[2]+E*r[5]+_*r[8],t}function Yt(t,e,r){var n=r[0],E=r[1],_=r[2],a=r[3],o=e[0],R=e[1],s=e[2],A=E*s-_*R,T=_*o-n*s,x=n*R-E*o,i=E*x-_*T,N=_*A-n*x,l=n*T-E*A,I=a*2;return A*=I,T*=I,x*=I,i*=2,N*=2,l*=2,t[0]=o+A+i,t[1]=R+T+N,t[2]=s+x+l,t}function Kt(t,e,r,n){var E=[],_=[];return E[0]=e[0]-r[0],E[1]=e[1]-r[1],E[2]=e[2]-r[2],_[0]=E[0],_[1]=E[1]*Math.cos(n)-E[2]*Math.sin(n),_[2]=E[1]*Math.sin(n)+E[2]*Math.cos(n),t[0]=_[0]+r[0],t[1]=_[1]+r[1],t[2]=_[2]+r[2],t}function kt(t,e,r,n){var E=[],_=[];return E[0]=e[0]-r[0],E[1]=e[1]-r[1],E[2]=e[2]-r[2],_[0]=E[2]*Math.sin(n)+E[0]*Math.cos(n),_[1]=E[1],_[2]=E[2]*Math.cos(n)-E[0]*Math.sin(n),t[0]=_[0]+r[0],t[1]=_[1]+r[1],t[2]=_[2]+r[2],t}function zt(t,e,r,n){var E=[],_=[];return E[0]=e[0]-r[0],E[1]=e[1]-r[1],E[2]=e[2]-r[2],_[0]=E[0]*Math.cos(n)-E[1]*Math.sin(n),_[1]=E[0]*Math.sin(n)+E[1]*Math.cos(n),_[2]=E[2],t[0]=_[0]+r[0],t[1]=_[1]+r[1],t[2]=_[2]+r[2],t}function jt(t,e){var r=t[0],n=t[1],E=t[2],_=e[0],a=e[1],o=e[2],R=Math.sqrt(r*r+n*n+E*E),s=Math.sqrt(_*_+a*a+o*o),A=R*s,T=A&&Ze(t,e)/A;return Math.acos(Math.min(Math.max(T,-1),1))}function Zt(t){return t[0]=0,t[1]=0,t[2]=0,t}function qt(t){return"vec3("+t[0]+", "+t[1]+", "+t[2]+")"}function Qt(t,e){return t[0]===e[0]&&t[1]===e[1]&&t[2]===e[2]}function $t(t,e){var r=t[0],n=t[1],E=t[2],_=e[0],a=e[1],o=e[2];return Math.abs(r-_)<=Se*Math.max(1,Math.abs(r),Math.abs(_))&&Math.abs(n-a)<=Se*Math.max(1,Math.abs(n),Math.abs(a))&&Math.abs(E-o)<=Se*Math.max(1,Math.abs(E),Math.abs(o))}var Jt=We,Gt=Ye,Lt=Ke,er=ke,tr=ze,rr=we,nr=je,Er=function(){var t=Ve();return function(e,r,n,E,_,a){var o,R;for(r||(r=3),n||(n=0),E?R=Math.min(E*r+n,e.length):R=e.length,o=n;o<R;o+=r)t[0]=e[o],t[1]=e[o+1],t[2]=e[o+2],_(t,t,a),e[o]=t[0],e[o+1]=t[1],e[o+2]=t[2];return e}}();function qe(t){let e=t.u32(9),r=t.u8(10),n={childInfo:{length:e[0],hash:{start:t.u32(e[0]),count:t.u32(e[0])},childIndex:t.u8(e[0]),childMask:t.u32(e[0]),tolerance:t.i8(e[0]),totalByteSize:t.u32(e[0]),offset:{length:e[0],x:t.f64(e[0]),y:t.f64(e[0]),z:t.f64(e[0])},scale:t.f32(e[0]),bounds:{length:e[0],box:{length:e[0],min:{length:e[0],x:t.f32(e[0]),y:t.f32(e[0]),z:t.f32(e[0])},max:{length:e[0],x:t.f32(e[0]),y:t.f32(e[0]),z:t.f32(e[0])}},sphere:{length:e[0],origo:{length:e[0],x:t.f32(e[0]),y:t.f32(e[0]),z:t.f32(e[0])},radius:t.f32(e[0])}},subMeshes:{start:t.u32(e[0]),count:t.u32(e[0])}},hashBytes:t.u8(e[1]),subMeshProjection:{length:e[2],objectId:t.u32(e[2]),primitiveType:t.u8(e[2]),attributes:t.u8(e[2]),numDeviations:t.u8(e[2]),numIndices:t.u32(e[2]),numVertices:t.u32(e[2]),numTextureBytes:t.u32(e[2])},subMesh:{length:e[3],childIndex:t.u8(e[3]),objectId:t.u32(e[3]),materialIndex:t.u8(e[3]),primitiveType:t.u8(e[3]),materialType:t.u8(e[3]),attributes:t.u8(e[3]),numDeviations:t.u8(e[3]),vertices:{start:t.u32(e[3]),count:t.u32(e[3])},primitiveVertexIndices:{start:t.u32(e[3]),count:t.u32(e[3])},edgeVertexIndices:{start:t.u32(e[3]),count:t.u32(e[3])},cornerVertexIndices:{start:t.u32(e[3]),count:t.u32(e[3])},textures:{start:t.u8(e[3]),count:t.u8(e[3])}},textureInfo:{length:e[4],semantic:t.u8(e[4]),transform:{length:e[4],e00:t.f32(e[4]),e01:t.f32(e[4]),e02:t.f32(e[4]),e10:t.f32(e[4]),e11:t.f32(e[4]),e12:t.f32(e[4]),e20:t.f32(e[4]),e21:t.f32(e[4]),e22:t.f32(e[4])},pixelRange:{start:t.u32(e[4]),count:t.u32(e[4])}},vertex:{length:e[5],position:{length:e[5],x:t.i16(e[5]),y:t.i16(e[5]),z:t.i16(e[5])},normal:r[0]?{length:e[5],x:t.i8(e[5]),y:t.i8(e[5]),z:t.i8(e[5])}:void 0,color:r[1]?{length:e[5],red:t.u8(e[5]),green:t.u8(e[5]),blue:t.u8(e[5]),alpha:t.u8(e[5])}:void 0,texCoord:r[2]?{length:e[5],x:t.f16(e[5]),y:t.f16(e[5])}:void 0,projectedPos:r[3]?{length:e[5],x:t.i16(e[5]),y:t.i16(e[5]),z:t.i16(e[5])}:void 0,deviations:{length:e[5],a:r[4]?t.f16(e[5]):void 0,b:r[5]?t.f16(e[5]):void 0,c:r[6]?t.f16(e[5]):void 0,d:r[7]?t.f16(e[5]):void 0}},triangle:{length:e[6],topologyFlags:r[8]?t.u8(e[6]):void 0},vertexIndex:r[9]?t.u16(e[7]):void 0,texturePixels:t.u8(e[8])};return console.assert(t.eof),n}var Ue=Uint16Array,Ce=class{constructor(e){this.buffer=e;C(this,"pos",0);C(this,"_u8");C(this,"_u16");C(this,"_u32");C(this,"_i8");C(this,"_i16");C(this,"_i32");C(this,"_f16");C(this,"_f32");C(this,"_f64");this._u8=new Uint8Array(e,0,Math.floor(e.byteLength/Uint8Array.BYTES_PER_ELEMENT)),this._u16=new Uint16Array(e,0,Math.floor(e.byteLength/Uint16Array.BYTES_PER_ELEMENT)),this._u32=new Uint32Array(e,0,Math.floor(e.byteLength/Uint32Array.BYTES_PER_ELEMENT)),this._i8=new Int8Array(e,0,Math.floor(e.byteLength/Int8Array.BYTES_PER_ELEMENT)),this._i16=new Int16Array(e,0,Math.floor(e.byteLength/Int16Array.BYTES_PER_ELEMENT)),this._i32=new Int32Array(e,0,Math.floor(e.byteLength/Int32Array.BYTES_PER_ELEMENT)),this._f16=new Uint16Array(e,0,Math.floor(e.byteLength/Uint16Array.BYTES_PER_ELEMENT)),this._f32=new Float32Array(e,0,Math.floor(e.byteLength/Float32Array.BYTES_PER_ELEMENT)),this._f64=new Float64Array(e,0,Math.floor(e.byteLength/Float64Array.BYTES_PER_ELEMENT))}read(e,r){if(r==0)return e.subarray(0,0);let n=e.BYTES_PER_ELEMENT;var E=n-1-(this.pos+n-1)%n;console.assert(E>=0&&E<n);let _=(this.pos+E)/n,a=_+r;return this.pos=a*e.BYTES_PER_ELEMENT,e.subarray(_,a)}get eof(){return this.pos==this.buffer.byteLength}u8(e){return this.read(this._u8,e)}u16(e){return this.read(this._u16,e)}u32(e){return this.read(this._u32,e)}i8(e){return this.read(this._i8,e)}i16(e){return this.read(this._i16,e)}i32(e){return this.read(this._i32,e)}f16(e){return this.read(this._f16,e)}f32(e){return this.read(this._f32,e)}f64(e){return this.read(this._f64,e)}};var Qe=new Uint8Array([171,75,84,88,32,49,49,187,13,10,26,10]),_r=12+13*4,or={[5121]:"UNSIGNED_BYTE",[33635]:"UNSIGNED_SHORT_5_6_5",[32819]:"UNSIGNED_SHORT_4_4_4_4",[32820]:"UNSIGNED_SHORT_5_5_5_1",[5131]:"HALF_FLOAT",[5126]:"FLOAT",[5123]:"UNSIGNED_SHORT",[5125]:"UNSIGNED_INT",[34042]:"UNSIGNED_INT_24_8",[5120]:"BYTE",[5122]:"SHORT",[5124]:"INT",[35902]:"UNSIGNED_INT_5_9_9_9_REV",[33640]:"UNSIGNED_INT_2_10_10_10_REV",[35899]:"UNSIGNED_INT_10F_11F_11F_REV"},ar={[6407]:"RGB",[6408]:"RGBA",[6406]:"ALPHA",[6409]:"LUMINANCE",[6410]:"LUMINANCE_ALPHA",[6402]:"DEPTH_COMPONENT",[34041]:"DEPTH_STENCIL",[35904]:"SRGB_EXT",[35906]:"SRGB_ALPHA_EXT",[6403]:"RED",[33319]:"RG",[36244]:"RED_INTEGER",[33320]:"RG_INTEGER",[36248]:"RGB_INTEGER",[36249]:"RGBA_INTEGER"},Rr={[33321]:"R8",[36756]:"R8_SNORM",[33323]:"RG8",[36757]:"RG8_SNORM",[32849]:"RGB8",[36758]:"RGB8_SNORM",[36194]:"RGB565",[32854]:"RGBA4",[32855]:"RGB5_A1",[32856]:"RGBA8",[36759]:"RGBA8_SNORM",[32857]:"RGB10_A2",[36975]:"RGB10_A2UI",[35905]:"SRGB8",[35907]:"SRGB8_ALPHA8",[33325]:"R16F",[33327]:"RG16F",[34843]:"RGB16F",[34842]:"RGBA16F",[33326]:"R32F",[33328]:"RG32F",[34837]:"RGB32F",[34836]:"RGBA32F",[35898]:"R11F_G11F_B10F",[35901]:"RGB9_E5",[33329]:"R8I",[33330]:"R8UI",[33331]:"R16I",[33332]:"R16UI",[33333]:"R32I",[33334]:"R32UI",[33335]:"RG8I",[33336]:"RG8UI",[33337]:"RG16I",[33338]:"RG16UI",[33339]:"RG32I",[33340]:"RG32UI",[36239]:"RGB8I",[36221]:"RGB8UI",[36233]:"RGB16I",[36215]:"RGB16UI",[36227]:"RGB32I",[36209]:"RGB32UI",[36238]:"RGBA8I",[36220]:"RGBA8UI",[36232]:"RGBA16I",[36214]:"RGBA16UI",[36226]:"RGBA32I",[36208]:"RGBA32UI"},sr={[33776]:"COMPRESSED_RGB_S3TC_DXT1_EXT",[33777]:"COMPRESSED_RGBA_S3TC_DXT1_EXT",[33778]:"COMPRESSED_RGBA_S3TC_DXT3_EXT",[33779]:"COMPRESSED_RGBA_S3TC_DXT5_EXT",[37488]:"COMPRESSED_R11_EAC",[37489]:"COMPRESSED_SIGNED_R11_EAC",[37490]:"COMPRESSED_RG11_EAC",[37491]:"COMPRESSED_SIGNED_RG11_EAC",[37492]:"COMPRESSED_RGB8_ETC2",[37493]:"COMPRESSED_RGBA8_ETC2_EAC",[37494]:"COMPRESSED_SRGB8_ETC2",[37495]:"COMPRESSED_SRGB8_ALPHA8_ETC2_EAC",[37496]:"COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2",[37497]:"COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2",[35840]:"COMPRESSED_RGB_PVRTC_4BPPV1_IMG",[35842]:"COMPRESSED_RGBA_PVRTC_4BPPV1_IMG",[35841]:"COMPRESSED_RGB_PVRTC_2BPPV1_IMG",[35843]:"COMPRESSED_RGBA_PVRTC_2BPPV1_IMG",[36196]:"COMPRESSED_RGB_ETC1_WEBGL"},Ar=L(L({},Rr),sr);function Tr(t){let e=new DataView(t.buffer,t.byteOffset,12);for(let a=0;a<Qe.length;a++)if(e.getUint8(a)!=Qe[a])throw new Error("texture missing KTX identifier");let r=Uint32Array.BYTES_PER_ELEMENT,n=new DataView(t.buffer,12+t.byteOffset,13*r),_=n.getUint32(0,!0)===67305985;return{glType:n.getUint32(1*r,_),glTypeSize:n.getUint32(2*r,_),glFormat:n.getUint32(3*r,_),glInternalFormat:n.getUint32(4*r,_),glBaseInternalFormat:n.getUint32(5*r,_),pixelWidth:n.getUint32(6*r,_),pixelHeight:n.getUint32(7*r,_),pixelDepth:n.getUint32(8*r,_),numberOfArrayElements:n.getUint32(9*r,_),numberOfFaces:n.getUint32(10*r,_),numberOfMipmapLevels:n.getUint32(11*r,_),bytesOfKeyValueData:n.getUint32(12*r,_),littleEndian:_}}function*$e(t,e,r){let n=Math.max(1,t.numberOfMipmapLevels),E=Math.max(1,t.numberOfArrayElements),_=t.numberOfFaces,a=Math.max(1,t.pixelDepth),o=_r+t.bytesOfKeyValueData,R=_==6&&t.numberOfArrayElements==0?1:E*_*a,s=new DataView(e.buffer,e.byteOffset);for(let A=0;A<n;A++){let T=t.pixelWidth>>A,x=t.pixelHeight>>A,i=s.getInt32(o,r);o+=4;let N=i/R;console.assert(N%4==0);for(let l=0;l<E;l++)for(let I=0;I<_;I++)for(let F=0;F<a;F++){let P=o;o+=N;let S=o;yield{mip:A,element:l,face:I,width:T,height:x,blobRange:[P,S],buffer:e.subarray(P,S)}}}console.assert(o==e.byteLength)}function Je(t){let e=Tr(t),{littleEndian:r}=e,n=ar[e.glBaseInternalFormat],E=e.numberOfArrayElements>0,_=e.numberOfFaces==6,a=e.pixelDepth>0,o=e.numberOfMipmapLevels>1,R=Math.max(1,e.numberOfMipmapLevels),s=Ar[e.glInternalFormat],A=E?"TEXTURE_ARRAY":_?"TEXTURE_CUBE_MAP":a?"TEXTURE_3D":"TEXTURE_2D",T=e.glType?or[e.glType]:void 0,x=L({width:e.pixelWidth,height:e.pixelHeight},a?{depth:e.pixelDepth}:void 0),i;if(_){let l=new Array(R).fill(null).map(I=>[]);for(let I of $e(e,t,r))l[I.mip][I.face]=I.buffer;i=l}else{i=new Array(R);for(let l of $e(e,t,r))i[l.mip]=l.buffer}let N=o?{mipMaps:i}:{image:i[0]};return L(L({kind:A,internalFormat:s,type:T},x),N)}var xr=["POINTS","LINES","LINE_LOOP","LINE_STRIP","TRIANGLES","TRIANGLE_STRIP","TRIANGLE_FAN"];function Ie(t,e){return q.fromValues(t.x[e],t.y[e],t.z[e])}function ee(t,e){let r=t.start[e],n=r+t.count[e];return[r,n]}function ir(t,e){switch(t){case 0:return e;case 1:return e/2;case 2:return e;case 3:return e-1;case 4:return e/3;case 5:return e-2;case 6:return e-2;default:console.warn(`Unknown primitive type: ${t}!`)}}function Ge(t){return{position:{type:Uint16Array,components:["x","y","z"]},normal:{type:Int8Array,components:["x","y","z"]},texCoord:{type:Ue,components:["x","y"]},color:{type:Uint8Array,components:["red","green","blue","alpha"]},projectedPos:{type:Uint16Array,components:["x","y","z"]},deviations:{type:Ue,components:["a","b","c","d"].slice(0,t)},materialIndex:{type:Uint8Array},objectId:{type:Uint32Array}}}function ae(t,e=0){var o;let r=0,n={};function E(R){let s=R-1-(r+R-1)%R;r+=s}let _=1,a=Ge(e);for(let R of t){let{type:s,components:A}=a[R],T=(o=A==null?void 0:A.length)!=null?o:1;_=Math.max(_,s.BYTES_PER_ELEMENT),E(s.BYTES_PER_ELEMENT),n[R]=r,r+=s.BYTES_PER_ELEMENT*T}return E(_),n.stride=r,n}function Le(t,e,r,n){let E=["position"];return t&1&&E.push("normal"),t&4&&E.push("texCoord"),t&2&&E.push("color"),t&8&&E.push("projectedPos"),e>0&&E.push("deviations"),r&&E.push("materialIndex"),n&&E.push("objectId"),E}function lr(t,e,r,n){var i,N;let E=0,_=0,a=0,o=0,R=0,[s,A]=e;for(let l=s;l<A;l++){let I=t.objectId[l];if((i=n==null?void 0:n(I))==null||i){let F=t.numIndices[l],P=t.numVertices[l],S=t.numTextureBytes[l],y=t.attributes[l],c=t.numDeviations[l],u=t.primitiveType[l],O=S==0,M=!0,[p,...m]=Le(y,c,O,M),Re=r?ae([p]).stride+ae(m,c).stride:ae([p,...m],c).stride;E+=(N=ir(u,F||P))!=null?N:0,a+=F,o+=P,R+=P*Re,_+=S}}let T=o<65535?2:4,x=_+R+a*T;return{primitives:E,gpuBytes:x}}function Sr(t){return Array.prototype.map.call(t,e=>("00"+e.toString(16).toUpperCase()).slice(-2)).join("")}function Cr(t,e,r,n){let{childInfo:E,hashBytes:_}=e,a=[],o=[];for(let R=0;R<E.length;R++){let s=E.childIndex[R],A=E.childMask[R],[T,x]=ee(E.hash,R),i=_.slice(T,x),N=Sr(i),l=E.tolerance[R],I=E.totalByteSize[R],F=Ie(E.offset,R),P=E.scale[R],S={box:{min:Ie(E.bounds.box.min,R),max:Ie(E.bounds.box.max,R)},sphere:{center:Ie(E.bounds.sphere.origo,R),radius:E.bounds.sphere.radius[R]}},{sphere:y,box:c}=S;q.add(y.center,y.center,F),q.add(c.min,c.min,F),q.add(c.max,c.max,F);let u=ee(E.subMeshes,R),O=o[s],{primitives:M,gpuBytes:p}=lr(e.subMeshProjection,u,r,n),m=M-(O!=null?O:0);a.push({id:N,childIndex:s,childMask:A,tolerance:l,byteSize:I,offset:F,scale:P,bounds:S,primitives:M,primitivesDelta:m,gpuBytes:p})}return a}function*Ir(t,e){var n;let{subMesh:r}=t;for(let E=0;E<r.length;E++){let _=r.objectId[E];if((n=e==null?void 0:e(_))==null||n){let a=r.childIndex[E],o=r.objectId[E],R=r.materialIndex[E],s=r.materialType[E],A=r.primitiveType[E],T=r.attributes[E],x=r.numDeviations[E],i=ee(r.vertices,E),N=ee(r.primitiveVertexIndices,E),l=ee(r.textures,E);yield{childIndex:a,objectId:o,materialIndex:R,materialType:s,primitiveType:A,attributes:T,deviations:x,vertexRange:i,indexRange:N,textureRange:l}}}}function ce(t,e,r,n,E,_){let a=r/t.BYTES_PER_ELEMENT,o=n/t.BYTES_PER_ELEMENT;console.assert(Math.round(a)==a),console.assert(Math.round(o)==o);let R=a;for(let s=E;s<_;s++)t[R]=e[s],R+=o}function cr(t,e,r,n,E,_){let a=r/t.BYTES_PER_ELEMENT,o=n/t.BYTES_PER_ELEMENT;console.assert(Math.round(a)==a),console.assert(Math.round(o)==o);let R=a;for(let s=E;s<_;s++)t[R]=e,R+=o}function dr(t,e,r,n,E){var l,I,F,P;let{vertex:_,vertexIndex:a}=t,o=[...Ir(t,E)],R=[],s=new Set,A=new Map;for(let S=0;S<o.length;S++){let{materialType:y,primitiveType:c,attributes:u,deviations:O,childIndex:M}=o[S],p=`${y}_${c}_${u}_${O}_${M}`,m=A.get(p);m||(m={materialType:y,primitiveType:c,attributes:u,deviations:O,subMeshIndices:[]},A.set(p,m)),m.subMeshIndices.push(S)}n.mutex.lockSync();for(let{materialType:S,primitiveType:y,attributes:c,deviations:u,subMeshIndices:O}of A.values()){let he=function(B){let f=[],V={};for(let[j,ue]of Object.entries(B)){let te=ue,K=-1;te&&(K=f.indexOf(te),K<0&&(K=f.length,f.push(te))),Reflect.set(V,j,K)}return[f,V]};var N=he;if(O.length==0)continue;let M=O.map(B=>o[B]),p=M.some(B=>B.materialIndex!=255),m=M.some(B=>B.objectId!=4294967295),Re=Le(c,u,p,m),[tt,...rt]=Re,pe=e?rt:Re,Q=ae([tt],u).stride,nt=Q*3,H=ae(pe,u),$=H.stride,Et=[...new Set(M.map(B=>B.childIndex))].sort(),W=0,Be=0,se=0;for(let B=0;B<M.length;B++){let f=M[B],V=f.vertexRange[1]-f.vertexRange[0],j=f.indexRange[1]-f.indexRange[0];W+=V,Be+=j,y==4&&(se+=Math.round((j>0?j:V)/3))}let me=new ArrayBuffer(W*$),d,J;r&&y==4&&(d=new Int16Array(new ArrayBuffer(se*nt)),J=new Uint32Array(se));let Ne=e?new ArrayBuffer(W*Q):void 0,h;a&&(h=new(W<65535?Uint16Array:Uint32Array)(Be));let Ae=new Uint8Array(W),Te=0,b=0,z=0,xe=0,Pe=[],G=[],[_t,U]=he({primary:me,highlight:Ae==null?void 0:Ae.buffer,pos:Ne,triPos:d==null?void 0:d.buffer,triId:d==null?void 0:d.buffer});for(let B of Et){let f=M.filter(K=>K.childIndex==B);if(f.length==0)continue;let V=h?Te:b;for(let K of f){let{vertexRange:At,indexRange:Tt,materialIndex:xt,deviations:it,objectId:re}=K,lt={materialIndex:xt,objectId:re},[g,X]=At,[Me,De]=Tt,St=Ge(it);for(let D of pe){let{type:ne,components:k}=St[D],Z=new ne(me,b*$),w=(l=k==null?void 0:k.length)!=null?l:1;for(var T=0;T<w;T++){let v=H[D]+T*ne.BYTES_PER_ELEMENT;if(D in _){let Ee=Reflect.get(_,D);k&&(Ee=Reflect.get(Ee,k[T])),ce(Z,Ee,v,$,g,X)}else{let Ee=Reflect.get(lt,D);cr(Z,Ee,v,$,g,X)}}}if(d&&J){let{x:D,y:ne,z:k}=_.position,Z=0;if(a&&h){Z=(De-Me)/3;for(let w=Me;w<De;w++){let v=a[w]+g;d[z++]=D[v],d[z++]=ne[v],d[z++]=k[v]}}else{Z=(X-g)/3;for(let w=g;w<X;w++){let v=w;d[z++]=D[v],d[z++]=ne[v],d[z++]=k[v]}}J.fill(re,xe,xe+Z),xe+=Z}if(Ne){let D=new Int16Array(Ne,b*Q);ce(D,_.position.x,0,Q,g,X),ce(D,_.position.y,2,Q,g,X),ce(D,_.position.z,4,Q,g,X)}if(a&&h)for(let D=Me;D<De;D++)h[Te++]=a[D]+b;let ge=(I=n.indices[re])!=null?I:0;ge&&Ae.fill(ge,b,b+(X-g));let Fe=G.length-1,He=b+X-g;Fe>=0&&G[Fe].objectId==re?G[Fe].endVertex=He:G.push({objectId:re,beginVertex:b,endVertex:He}),b+=X-g}let j=h?Te:b,ue=V*(h?h.BYTES_PER_ELEMENT:$),te=j-V;Pe.push({childIndex:B,byteOffset:ue,first:V,count:te})}console.assert(b==W),console.assert(Te==Be),console.assert(z==((F=d==null?void 0:d.length)!=null?F:0)),console.assert(xe==((P=J==null?void 0:J.length)!=null?P:0));let ot=h!=null?h:W,[be,at]=M[0].textureRange,ie;at>be&&(ie=be),ie!=null&&s.add(ie);let Y=$,Rt=u==0||u==1?"FLOAT":`FLOAT_VEC${u}`,st={position:{kind:"FLOAT_VEC4",buffer:U.pos,componentCount:3,componentType:"SHORT",normalized:!0,byteOffset:H.position,byteStride:e?0:Y},normal:c&1?{kind:"FLOAT_VEC3",buffer:U.primary,componentCount:3,componentType:"BYTE",normalized:!0,byteOffset:H.normal,byteStride:Y}:null,material:p?{kind:"UNSIGNED_INT",buffer:U.primary,componentCount:1,componentType:"UNSIGNED_BYTE",normalized:!1,byteOffset:H.materialIndex,byteStride:Y}:null,objectId:m?{kind:"UNSIGNED_INT",buffer:U.primary,componentCount:1,componentType:"UNSIGNED_INT",normalized:!1,byteOffset:H.objectId,byteStride:Y}:null,texCoord:c&4?{kind:"FLOAT_VEC2",buffer:U.primary,componentCount:2,componentType:"HALF_FLOAT",normalized:!1,byteOffset:H.texCoord,byteStride:Y}:null,color:c&2?{kind:"FLOAT_VEC4",buffer:U.primary,componentCount:4,componentType:"UNSIGNED_BYTE",normalized:!0,byteOffset:H.color,byteStride:Y}:null,projectedPos:c&8?{kind:"FLOAT_VEC4",buffer:U.primary,componentCount:3,componentType:"SHORT",normalized:!0,byteOffset:H.projectedPos,byteStride:Y}:null,deviations:u!=0?{kind:Rt,buffer:U.primary,componentCount:u,componentType:"HALF_FLOAT",normalized:!1,byteOffset:H.deviations,byteStride:Y}:null,triangles:d?[{kind:"FLOAT_VEC4",buffer:U.triPos,componentCount:3,componentType:"SHORT",normalized:!0,byteOffset:0,byteStride:18},{kind:"FLOAT_VEC4",buffer:U.triPos,componentCount:3,componentType:"SHORT",normalized:!0,byteOffset:6,byteStride:18},{kind:"FLOAT_VEC4",buffer:U.triPos,componentCount:3,componentType:"SHORT",normalized:!0,byteOffset:12,byteStride:18},{kind:"UNSIGNED_INT",buffer:U.triId,componentCount:1,componentType:"UNSIGNED_INT",normalized:!1,byteOffset:0,byteStride:4}]:null,highlight:{kind:"UNSIGNED_INT",buffer:U.highlight,componentCount:1,componentType:"UNSIGNED_BYTE",normalized:!1,byteOffset:0,byteStride:0}};G.sort((B,f)=>B.objectId-f.objectId),R.push({materialType:S,primitiveType:xr[y],numVertices:W,numTriangles:se,objectRanges:G,vertexAttributes:st,vertexBuffers:_t,indices:ot,baseColorTexture:ie,drawRanges:Pe})}n.mutex.unlock();let x=new Array(t.textureInfo.length),{textureInfo:i}=t;for(let S of s){let[y,c]=ee(i.pixelRange,S),u=i.semantic[S],O=[i.transform.e00[S],i.transform.e01[S],i.transform.e02[S],i.transform.e10[S],i.transform.e11[S],i.transform.e12[S],i.transform.e20[S],i.transform.e21[S],i.transform.e22[S]],M=t.texturePixels.subarray(y,c),p=Je(M);x[S]={semantic:u,transform:O,params:p}}return{subMeshes:R,textures:x}}function et(t,e,r,n,E,_,a){console.assert(n=="2.0");let o=new Ce(E);var R=qe(o);let s;s=a?x=>_.indices[x]!=255:void 0;let A=Cr(t,R,e,s),T=dr(R,e,r,_,s);return{childInfos:A,geometry:T}}var de=class{constructor(e){this.send=e;C(this,"downloader",new _e);C(this,"downloads",new Map);C(this,"highlights")}receive(e){switch(e.kind){case"buffer":this.setBuffer(e);break;case"parse":this.parse(e);break;case"load":this.load(e);break;case"abort":this.abort(e);break;case"abort_all":this.abortAll(e);break;default:console.error(`Uknown load message: ${e}!`);break}}setBuffer(e){let{buffer:r}=e,n=new Uint8Array(r,4),E=new le(r);this.highlights={buffer:r,indices:n,mutex:E}}parseBuffer(e,r){let{highlights:n}=this,{id:E,version:_,separatePositionsBuffer:a,enableOutlines:o,applyFilter:R}=r,{childInfos:s,geometry:A}=et(E,a,o,_,e,n,R),T={kind:"ready",id:E,childInfos:s,geometry:A},x=[];for(let{vertexBuffers:i,indices:N}of A.subMeshes)x.push(...i),typeof N!="number"&&x.push(N.buffer);this.send(T,x)}async parse(e){let{id:r,buffer:n}=e;try{this.parseBuffer(n,e)}catch(E){this.error(r,E)}}async load(e){let{downloader:r,downloads:n}=this,{url:E,id:_,byteSize:a}=e;try{let o=r.downloadArrayBufferAbortable(E,new ArrayBuffer(a));n.set(_,o);let R=await o.result;if(n.delete(_),R)this.parseBuffer(R,e);else{let s={kind:"aborted",id:_};this.send(s)}}catch(o){this.error(_,o)}}removeNode(e){let{downloads:r}=this,n=r.get(e);return r.delete(e),{download:n}}error(e,r){let{download:n}=this.removeNode(e),E={kind:"error",id:e,error:r};this.send(E)}abort(e){let{id:r}=e,{download:n}=this.removeNode(r);n==null||n.abort()}async abortAll(e){let{downloads:r,downloader:n}=this;for(let _ of r.values())_.abort();await n.complete(),console.assert(r.size==0);let E={kind:"aborted_all"};this.send(E)}};var Br=new de((t,e)=>{postMessage(t,{transfer:e})});onmessage=t=>{let e=t.data;e.kind=="close"?close():Br.receive(e)};\n');
}

// ../core3d/modules/octree/loader.ts
var NodeLoader = class {
  worker;
  handler;
  payloadPromises = /* @__PURE__ */ new Map();
  abortAllPromise = Promise.resolve();
  resolveAbortAll;
  aborted = false;
  constructor(options) {
    if (options.useWorker) {
      const worker = this.worker = Worker2();
      worker.onmessage = (e) => {
        this.receive(e.data);
      };
    }
    this.handler = new LoaderHandler(this.receive.bind(this));
  }
  setBuffer(buffer) {
    const msg = { kind: "buffer", buffer };
    this.send(msg);
  }
  get activeDownloads() {
    return this.payloadPromises.size;
  }
  send(msg) {
    const { worker, handler } = this;
    if (worker) {
      worker.postMessage(msg);
    } else {
      handler.receive(msg);
    }
  }
  receive(msg) {
    if (msg.kind == "aborted_all") {
      const { resolveAbortAll } = this;
      this.resolveAbortAll = void 0;
      resolveAbortAll?.();
      return;
    }
    const { id } = msg;
    const { payloadPromises } = this;
    const payloadPromise = payloadPromises.get(id);
    if (payloadPromise) {
      payloadPromises.delete(id);
      const { resolve, reject } = payloadPromise;
      switch (msg.kind) {
        case "ready":
          resolve(msg);
          break;
        case "aborted":
          resolve(void 0);
          break;
        case "error":
          reject(msg.error);
          break;
      }
    }
  }
  abortAll() {
    this.abortAllPromise = new Promise((resolve) => {
      this.resolveAbortAll = resolve;
    });
    const msg = { kind: "abort_all" };
    this.send(msg);
    this.payloadPromises.clear();
  }
  dispose() {
    const msg = { kind: "close" };
    this.send(msg);
  }
  parseNode(buffer, id, deviceProfile, version) {
    const { payloadPromises } = this;
    const enableOutlines = deviceProfile.features.outline;
    const applyFilter = true;
    const parseMsg = { kind: "parse", buffer, id, version, separatePositionsBuffer: true, enableOutlines, applyFilter };
    const promise = new Promise((resolve, reject) => {
      payloadPromises.set(id, { resolve, reject });
    });
    this.send(parseMsg);
    return promise;
  }
  loadNode(node, version) {
    const { payloadPromises } = this;
    const { deviceProfile } = node.context.renderContext;
    const { id, data } = node;
    if (node.context.url == void 0) {
      return Promise.resolve(void 0);
    }
    const url = new URL(node.context.url);
    url.pathname += node.path;
    const { byteSize } = data;
    const enableOutlines = deviceProfile.features.outline;
    const applyFilter = true;
    const loadMsg = { kind: "load", id, version, url: url.toString(), byteSize, separatePositionsBuffer: true, enableOutlines, applyFilter };
    console.assert(byteSize != 0);
    const abortMsg = { kind: "abort", id };
    const abort = () => {
      this.send(abortMsg);
    };
    node.download = { abort };
    this.send(loadMsg);
    return new Promise((resolve, reject) => {
      payloadPromises.set(id, { resolve, reject });
    });
  }
};

// ../core3d/modules/octree/gradient.ts
function gradientRange(gradient) {
  if (gradient.knots.length == 0)
    return [0, 0];
  return [gradient.knots[0].position, gradient.knots[gradient.knots.length - 1].position];
}
function computeGradientColors(size, gradient) {
  const { knots } = gradient;
  const n = knots.length;
  const pixels = new Uint8ClampedArray(size * 4);
  if (n > 0) {
    let getColor2 = function(index2) {
      const [r, g, b, a] = knots[index2].color;
      return vec4_exports.fromValues(r, g, b, a ?? 1);
    };
    var getColor = getColor2;
    const minValue = knots[0].position;
    const maxValue = knots[n - 1].position;
    let prevIndex = 0;
    const color = getColor2(0);
    for (let i = 0; i < size; i++) {
      const texel = (i + 0.5) / size * (maxValue - minValue) + minValue;
      for (let j = prevIndex; j < n - 1; j++) {
        prevIndex = j;
        const e0 = knots[j].position;
        const e1 = knots[j + 1].position;
        const c0 = getColor2(j);
        const c1 = getColor2(j + 1);
        if (texel >= e0 && texel < e1) {
          const t = (texel - e0) / (e1 - e0);
          vec4_exports.lerp(color, c0, c1, t);
          break;
        }
      }
      const [r, g, b, a] = color;
      pixels[i * 4 + 0] = r * 255;
      pixels[i * 4 + 1] = g * 255;
      pixels[i * 4 + 2] = b * 255;
      pixels[i * 4 + 3] = a * 255;
    }
  }
  return pixels;
}

// ../core3d/modules/octree/context.ts
var OctreeModuleContext = class {
  constructor(renderContext, module, uniforms, resources) {
    this.renderContext = renderContext;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
    this.loader = new NodeLoader({ useWorker });
    const maxObjects = 1e7;
    const maxByteLength = maxObjects + 4;
    const buffer = new SharedArrayBuffer(4, { maxByteLength });
    this.loader.setBuffer(buffer);
    this.highlight = {
      buffer,
      indices: new Uint8Array(buffer, 4),
      mutex: new Mutex(buffer)
    };
  }
  loader;
  gradientsImage = new Uint8ClampedArray(1024 /* size */ * 2 * 4);
  currentProgramFlags = OctreeModule.defaultProgramFlags;
  debug = false;
  suspendUpdates = false;
  localSpaceTranslation = vec3_exports.create();
  localSpaceChanged = false;
  url;
  // rootNode: OctreeNode | undefined;
  rootNodes = {};
  version = "";
  projectedSizeSplitThreshold = 1;
  // baseline node size split threshold = 50% of view height
  hidden = [false, false, false, false, false];
  highlight;
  get highlights() {
    return this.highlight.indices;
  }
  update(state) {
    const { renderContext, resources, uniforms, projectedSizeSplitThreshold, module } = this;
    const { gl, deviceProfile } = renderContext;
    const { scene, localSpaceTranslation, highlights, points, terrain, pick, output, clipping } = state;
    const { values } = uniforms.scene;
    let { currentProgramFlags } = this;
    function updateShaderCompileConstants(flags) {
      if (Object.getOwnPropertyNames(flags).some((key) => currentProgramFlags[key] != flags[key])) {
        currentProgramFlags = { ...currentProgramFlags, ...flags };
      }
    }
    this.projectedSizeSplitThreshold = 1 / deviceProfile.detailBias;
    if (values.iblMipCount != renderContext.iblTextures.numMipMaps) {
      values.iblMipCount = renderContext.iblTextures.numMipMaps;
    }
    this.debug = state.debug.showNodeBounds;
    let updateGradients = false;
    if (renderContext.hasStateChanged({ points })) {
      const { size, deviation } = points;
      const { values: values2 } = uniforms.scene;
      values2.pixelSize = size.pixel ?? 0;
      values2.maxPixelSize = size.maxPixel ?? 20;
      values2.metricSize = size.metric ?? 0;
      values2.toleranceFactor = size.toleranceFactor ?? 0;
      values2.deviationIndex = deviation.index;
      values2.deviationFactor = deviation.mixFactor;
      values2.deviationRange = gradientRange(deviation.colorGradient);
      values2.useProjectedPosition = points.useProjectedPosition;
      const deviationColors = computeGradientColors(1024 /* size */, deviation.colorGradient);
      this.gradientsImage.set(deviationColors, 0 * 1024 /* size */ * 4);
      updateGradients = true;
    }
    if (renderContext.hasStateChanged({ terrain })) {
      const { values: values2 } = uniforms.scene;
      values2.elevationRange = gradientRange(terrain.elevationGradient);
      const elevationColors = computeGradientColors(1024 /* size */, terrain.elevationGradient);
      this.gradientsImage.set(elevationColors, 1 * 1024 /* size */ * 4);
      updateGradients = true;
    }
    if (renderContext.hasStateChanged({ pick })) {
      const { values: values2 } = uniforms.scene;
      values2.pickOpacityThreshold = pick.opacityThreshold;
    }
    if (updateGradients) {
      glUpdateTexture(gl, resources.gradientsTexture, { ...module.gradientImageParams, image: this.gradientsImage });
    }
    if (renderContext.hasStateChanged({ scene })) {
      const { prevState } = renderContext;
      if (scene) {
        const { hide } = scene;
        if (hide != prevState?.scene?.hide) {
          if (hide) {
            const { terrain: terrain2, triangles, lines, points: points2, documents } = hide;
            this.hidden = [terrain2 ?? false, triangles ?? false, lines ?? false, points2 ?? false, documents ?? false];
          } else {
            this.hidden = [true, false, false, false, false];
          }
        }
      }
      if (scene?.url != this.url) {
        if (this.url) {
          this.loader.abortAll();
        }
        for (const rootNode of Object.values(this.rootNodes)) {
          rootNode.dispose();
        }
        this.rootNodes = {};
        const url = scene?.url;
        if (url != this.url) {
          const { highlight } = this;
          const numObjects = scene?.config.numObjects ?? 0;
          const numBytes = numObjects + 4;
          if (highlight.buffer.byteLength != numBytes) {
            highlight.mutex.lockSpin();
            if (numBytes > highlight.buffer.byteLength) {
              highlight.buffer.grow(numBytes);
            }
            highlight.indices = new Uint8Array(highlight.buffer, 4, numObjects);
            updateHighlightBuffer(highlight.indices, state.highlights);
            highlight.mutex.unlock();
          }
          this.url = url;
          if (url) {
            const materialData = makeMaterialAtlas(state);
            if (materialData) {
              glUpdateTexture(gl, resources.materialTexture, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: materialData });
            }
          }
        }
        if (scene) {
          this.version = scene.config.version;
          this.reloadScene(scene);
        }
      }
    }
    const { rootNodes } = this;
    if (renderContext.hasStateChanged({ localSpaceTranslation })) {
      this.localSpaceChanged = localSpaceTranslation !== this.localSpaceTranslation;
      this.localSpaceTranslation = localSpaceTranslation;
    }
    if (renderContext.hasStateChanged({ highlights })) {
      const { groups } = highlights;
      const { highlight } = this;
      const { prevState } = renderContext;
      const prevGroups = prevState?.highlights.groups ?? [];
      updateShaderCompileConstants({ highlight: groups.length > 0 });
      const { values: values2 } = uniforms.scene;
      values2.applyDefaultHighlight = highlights.defaultAction != void 0;
      if (scene) {
        const n = Math.max(groups.length, prevGroups.length);
        let reload = false;
        const prevDefaultAction = prevState?.highlights.defaultAction;
        const currDefaultAction = state.highlights.defaultAction;
        if (prevDefaultAction != currDefaultAction && prevDefaultAction == "filter" || currDefaultAction == "filter") {
          reload = true;
        } else {
          for (let i = 0; i < n; i++) {
            if (groups[i] != prevGroups[i] && (groups[i]?.action == "filter" || prevGroups[i]?.action == "filter")) {
              reload = true;
              break;
            }
          }
        }
        if (reload) {
          this.reloadScene(scene);
        }
      }
      const transforms2 = [highlights.defaultAction, ...groups.map((g) => g.action)];
      const prevTransforms = prevState ? [
        prevState.highlights.defaultAction,
        ...prevState.highlights.groups.map((g) => g.action)
      ] : [];
      if (!sequenceEqual(transforms2, prevTransforms)) {
        const image = createColorTransforms(highlights);
        glUpdateTexture(gl, resources.highlightTexture, { kind: "TEXTURE_2D", width: 256, height: 5, internalFormat: "RGBA32F", type: "FLOAT", image });
      }
      const objectIds = groups.map((g) => g.objectIds);
      const prevObjectIds = prevState?.highlights.groups.map((g) => g.objectIds) ?? [];
      const objectIdsChanged = !sequenceEqual(objectIds, prevObjectIds);
      if (objectIdsChanged) {
        highlight.mutex.lockSpin();
        updateHighlightBuffer(highlight.indices, highlights);
        highlight.mutex.unlock();
        const nodes = [];
        for (const rootNode of Object.values(rootNodes)) {
          nodes.push(...iterateNodes(rootNode));
        }
        for (const node of nodes) {
          node.applyHighlights(highlight.indices);
        }
      }
      ;
    }
    if (renderContext.hasStateChanged({ clipping })) {
      updateShaderCompileConstants({ clip: clipping.enabled });
    }
    if (renderContext.hasStateChanged({ output })) {
      updateShaderCompileConstants({ dither: output.samplesMSAA <= 1 });
    }
    renderContext.updateUniformBuffer(resources.sceneUniforms, uniforms.scene);
    if (this.currentProgramFlags != currentProgramFlags) {
      this.currentProgramFlags = currentProgramFlags;
      OctreeModule.compileShaders(renderContext, resources.bin, resources.programs, currentProgramFlags).then(() => {
        renderContext.changed = true;
      });
    }
    if (!this.suspendUpdates) {
      const nodes = [];
      for (const rootNode of Object.values(rootNodes)) {
        rootNode.update(state);
        const preCollapseNodes = [...iterateNodes(rootNode)];
        for (const node of preCollapseNodes) {
          if (!node.shouldSplit(projectedSizeSplitThreshold * 0.98)) {
            if (node.state != 0 /* collapsed */) {
              node.dispose();
            }
          }
        }
        nodes.push(...iterateNodes(rootNode));
      }
      nodes.sort((a, b) => b.projectedSize - a.projectedSize);
      const { maxGPUBytes } = deviceProfile.limits;
      const { maxPrimitives } = deviceProfile.limits;
      let gpuBytes = 0;
      let primitives = 0;
      for (const node of nodes) {
        if (node.hasGeometry) {
          gpuBytes += node.data.gpuBytes;
          primitives += node.renderedPrimitives;
        }
        if (node.state == 1 /* requestDownload */ || node.state == 2 /* downloading */) {
          primitives += node.data.primitivesDelta;
          gpuBytes += node.data.gpuBytes;
        }
      }
      for (const node of nodes) {
        if (node.shouldSplit(projectedSizeSplitThreshold)) {
          if (node.state == 0 /* collapsed */) {
            if (primitives + node.data.primitivesDelta <= maxPrimitives && gpuBytes + node.data.gpuBytes <= maxGPUBytes) {
              node.state = 1 /* requestDownload */;
              primitives += node.data.primitivesDelta;
              gpuBytes += node.data.gpuBytes;
            }
          }
        }
      }
      sessionStorage.setItem("gpu_bytes", gpuBytes.toLocaleString());
      sessionStorage.setItem("primitives", primitives.toLocaleString());
      const maxDownloads = 8;
      let availableDownloads = maxDownloads - this.loader.activeDownloads;
      for (const node of nodes) {
        if (availableDownloads > 0 && node.state == 1 /* requestDownload */) {
          node.downloadNode();
          availableDownloads--;
        }
      }
    }
    const endTime = performance.now();
  }
  applyDefaultAttributeValues() {
    const { gl } = this.renderContext;
    gl.vertexAttribI4ui(2 /* material */, 255, 0, 0, 0);
    gl.vertexAttribI4ui(3 /* objectId */, 4294967295, 0, 0, 0);
    gl.vertexAttrib4f(5 /* color0 */, 0, 0, 0, 0);
    gl.vertexAttrib4f(6 /* projectedPos */, 0, 0, 0, 0);
    gl.vertexAttrib4f(7 /* deviations */, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    gl.vertexAttribI4ui(8 /* highlight */, 0, 0, 0, 0);
  }
  getRenderNodes(projectedSizeSplitThreshold, rootNode) {
    const nodes = [];
    function iterate(node) {
      let rendered = false;
      if (node.visibility != 1 /* none */) {
        let mask = node.data.childMask;
        if (node.shouldSplit(projectedSizeSplitThreshold)) {
          for (const child of node.children) {
            if (child.hasGeometry) {
              rendered = true;
              if (iterate(child)) {
                mask &= ~(1 << child.data.childIndex);
              }
            }
          }
        }
        if (mask) {
          rendered = true;
          nodes.push({ mask, node });
        }
      }
      return rendered;
    }
    if (rootNode) {
      iterate(rootNode);
      nodes.sort((a, b) => a.node.viewDistance - b.node.viewDistance);
    }
    return nodes;
  }
  prepass(state) {
    const { resources, renderContext } = this;
    const { programs } = resources;
    const { gl } = renderContext;
    for (const rootNode of Object.values(this.rootNodes)) {
      const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
      glState(gl, {
        program: programs.pre,
        depth: { test: true }
      });
      gl.activeTexture(gl.TEXTURE0);
      const meshState = {};
      for (const { mask, node } of renderNodes) {
        this.renderNode(node, mask, meshState, 2 /* pre */);
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }
  render(state) {
    const { resources, renderContext, debug } = this;
    const { usePrepass, samplerSingle, samplerMip } = renderContext;
    const { programs, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
    const { gl, iblTextures, cameraUniforms, clippingUniforms, outlineUniforms, deviceProfile } = renderContext;
    const { diffuse, specular } = iblTextures;
    glState(gl, {
      program: programs.color,
      uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
      cull: { enable: true },
      depth: {
        test: true,
        writeMask: true,
        func: usePrepass ? "LEQUAL" : "LESS"
      },
      textures: [
        { kind: "TEXTURE_2D", texture: null, sampler: samplerSingle },
        // basecolor - will be overridden by nodes that have textures, e.g. terrain nodes.
        { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerNearest },
        { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip },
        { kind: "TEXTURE_2D", texture: materialTexture, sampler: samplerNearest },
        { kind: "TEXTURE_2D", texture: highlightTexture, sampler: samplerNearest },
        { kind: "TEXTURE_2D", texture: gradientsTexture, sampler: samplerNearest }
      ]
    });
    this.applyDefaultAttributeValues();
    gl.activeTexture(gl.TEXTURE0);
    for (const rootNode of Object.values(this.rootNodes)) {
      const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
      const meshState = {};
      for (const { mask, node } of renderNodes) {
        this.renderNode(node, mask, meshState, 0 /* color */);
      }
      if (rootNode.geometryKind == 0 /* terrain */ && state.terrain.asBackground) {
        glClear(gl, { kind: "DEPTH_STENCIL", depth: 1, stencil: 0 });
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (state.outlines.enabled && deviceProfile.features.outline) {
      const [x, y, z, offset] = state.outlines.plane;
      const plane = vec4_exports.fromValues(x, y, z, -offset);
      glState(gl, {
        uniformBuffers: [cameraUniforms, clippingUniforms, outlineUniforms, null],
        depth: {
          test: false,
          writeMask: false
        }
      });
      const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, this.rootNodes[1 /* triangles */]);
      for (const { mask, node } of renderNodes) {
        if (node.intersectsPlane(plane)) {
          this.renderNodeClippingOutline(node, mask);
        }
      }
    }
    if (debug) {
      for (const rootNode of Object.values(this.rootNodes)) {
        const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
        glState(gl, {
          program: programs.debug,
          uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
          depth: {
            test: true,
            writeMask: false,
            func: "GREATER"
          },
          cull: { enable: true },
          blend: {
            enable: true,
            srcRGB: "CONSTANT_ALPHA",
            dstRGB: "ONE_MINUS_CONSTANT_ALPHA",
            color: [0, 0, 0, 0.25]
          }
          // drawBuffers: renderContext.drawBuffers(BufferFlags.color),
        });
        for (const { mask, node } of renderNodes) {
          this.renderNodeDebug(node);
        }
        glState(gl, {
          program: programs.debug,
          depth: { func: "LESS" },
          blend: {
            color: [0, 0, 0, 0.75]
          }
        });
        for (const { mask, node } of renderNodes) {
          this.renderNodeDebug(node);
        }
      }
    }
  }
  pick() {
    const { resources, renderContext } = this;
    const { gl, cameraUniforms, clippingUniforms, outlineUniforms, samplerSingle, samplerMip, iblTextures, prevState, deviceProfile } = renderContext;
    const { programs, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
    const { diffuse, specular } = iblTextures;
    const state = prevState;
    for (const rootNode of Object.values(this.rootNodes)) {
      const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
      glState(gl, {
        program: programs.pick,
        uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
        cull: { enable: true },
        textures: [
          { kind: "TEXTURE_2D", texture: null, sampler: samplerSingle },
          // basecolor - will be overridden by nodes that have textures, e.g. terrain nodes.
          { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerNearest },
          { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip },
          { kind: "TEXTURE_2D", texture: materialTexture, sampler: samplerNearest },
          { kind: "TEXTURE_2D", texture: highlightTexture, sampler: samplerNearest },
          { kind: "TEXTURE_2D", texture: gradientsTexture, sampler: samplerNearest }
        ]
      });
      this.applyDefaultAttributeValues();
      gl.activeTexture(gl.TEXTURE0);
      const meshState = {};
      for (const { mask, node } of renderNodes) {
        this.renderNode(node, mask, meshState, 1 /* pick */);
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (state.outlines.enabled && deviceProfile.features.outline) {
        glState(gl, {
          uniformBuffers: [cameraUniforms, outlineUniforms, null],
          depth: {
            test: false,
            writeMask: false
          }
        });
        for (const { mask, node } of renderNodes) {
          if (node.intersectsPlane(state.viewFrustum.near)) {
            this.renderNodeClippingOutline(node, mask);
          }
        }
      }
      if (rootNode.geometryKind == 0 /* terrain */ && state.terrain.asBackground) {
        glClear(gl, { kind: "DEPTH_STENCIL", depth: 1, stencil: 0 });
      }
    }
  }
  renderNode(node, mask, meshState, pass) {
    const { renderContext } = this;
    const { gl } = renderContext;
    const { resources } = this;
    const { programs } = resources;
    const { data } = node;
    const prepass = pass == 2 /* pre */;
    if (mask && node.uniforms) {
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 3 /* node */, node.uniforms);
      for (const mesh of node.meshes) {
        const { materialType } = mesh;
        const isTransparent = materialType == 2 /* transparent */;
        if (prepass && isTransparent)
          continue;
        gl.bindVertexArray(prepass ? mesh.vaoPosOnly : mesh.vao);
        const mode = mesh.materialType == 3 /* elevation */ ? 2 /* terrain */ : mesh.drawParams.mode == "POINTS" ? 1 /* points */ : 0 /* triangles */;
        if (meshState.mode != mode) {
          meshState.mode = mode;
          gl.useProgram(programs[pass][mode]);
        }
        const doubleSided = mesh.materialType != 0 /* opaque */;
        if (meshState.doubleSided != doubleSided) {
          meshState.doubleSided = doubleSided;
          if (doubleSided) {
            gl.disable(gl.CULL_FACE);
          } else {
            gl.enable(gl.CULL_FACE);
          }
        }
        if (pass == 0 /* color */ || pass == 1 /* pick */) {
          gl.bindTexture(gl.TEXTURE_2D, mesh.baseColorTexture ?? resources.defaultBaseColorTexture);
        }
        if (mask == data.childMask) {
          const stats = glDraw(gl, mesh.drawParams);
          renderContext["addRenderStatistics"](stats);
        } else {
          const multiDrawParams = getMultiDrawParams(mesh, mask);
          if (multiDrawParams) {
            const stats = glDraw(gl, multiDrawParams);
            renderContext["addRenderStatistics"](stats);
          }
        }
      }
    }
  }
  renderNodeClippingOutline(node, mask) {
    const { resources, renderContext, module } = this;
    const { gl } = renderContext;
    const { programs, transformFeedback, vb_line, vao_line } = resources;
    if (mask && node.uniforms) {
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 3 /* node */, node.uniforms);
      for (const mesh of node.meshes) {
        if (mesh.numTriangles && mesh.drawParams.mode == "TRIANGLES" && !mesh.baseColorTexture) {
          for (const drawRange of mesh.drawRanges) {
            if (1 << drawRange.childIndex & mask) {
              const count = drawRange.count / 3;
              const first = drawRange.first / 3;
              console.assert(count * 2 <= module.maxLines);
              glState(gl, {
                program: programs.intersect,
                vertexArrayObject: mesh.vaoTriangles
              });
              glTransformFeedback(gl, { kind: "POINTS", transformFeedback, outputBuffers: [vb_line], count, first });
              glState(gl, {
                program: programs.line,
                vertexArrayObject: vao_line
              });
              const stats = glDraw(gl, { kind: "arrays_instanced", mode: "LINES", count: 2, instanceCount: count });
              renderContext["addRenderStatistics"](stats);
            }
          }
        }
      }
    }
  }
  renderNodeDebug(node) {
    const { renderContext } = this;
    const { gl } = renderContext;
    if (node.renderedChildMask && node.uniforms) {
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 3 /* node */, node.uniforms ?? null);
      const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLES", count: 8 * 12 });
      renderContext["addRenderStatistics"](stats);
    }
  }
  contextLost() {
    const { loader, rootNodes } = this;
    loader.abortAll();
    for (const rootNode of Object.values(rootNodes)) {
      rootNode?.dispose();
    }
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
    this.rootNodes = {};
  }
  async reloadScene(scene) {
    this.suspendUpdates = true;
    await this.loader.abortAllPromise;
    const rootNodes = await createSceneRootNodes(this, scene.config, this.renderContext.deviceProfile);
    if (rootNodes) {
      this.rootNodes = rootNodes;
    }
    this.suspendUpdates = false;
    this.renderContext.changed = true;
  }
};
function makeMaterialAtlas(state) {
  const { scene } = state;
  if (scene) {
    const { config } = scene;
    const { numMaterials } = config;
    if (numMaterials) {
      let zeroes2 = function() {
        return new Uint8ClampedArray(numMaterials);
      }, ones2 = function() {
        const a = new Uint8ClampedArray(numMaterials);
        a.fill(255);
        return a;
      };
      var zeroes = zeroes2, ones = ones2;
      const { diffuse, opacity } = config.materialProperties;
      console.assert(numMaterials <= 256);
      ;
      ;
      const red = decodeBase64(diffuse.red, Uint8ClampedArray) ?? zeroes2();
      const green = decodeBase64(diffuse.green, Uint8ClampedArray) ?? zeroes2();
      const blue = decodeBase64(diffuse.blue, Uint8ClampedArray) ?? zeroes2();
      const alpha = decodeBase64(opacity, Uint8ClampedArray) ?? ones2();
      const srcData = interleaveRGBA(red, green, blue, alpha);
      return srcData;
    }
  }
}
function updateHighlightBuffer(buffer, highlight) {
  const { defaultAction, groups } = highlight;
  function getIndex(action, value) {
    return action == "hide" ? 254 /* hidden */ : action == "filter" ? 255 /* filtered */ : value;
  }
  const defaultValue = getIndex(defaultAction, 0 /* default */);
  buffer.fill(defaultValue);
  let groupIndex = 1;
  for (const group of groups) {
    const idx = getIndex(group.action, groupIndex);
    for (const objectId of group.objectIds) {
      buffer[objectId] = idx;
    }
    groupIndex++;
  }
}
function* iterateNodes(node) {
  if (node) {
    yield node;
    for (const child of node.children) {
      yield* iterateNodes(child);
    }
  }
}
function createColorTransforms(highlights) {
  const numColorMatrices = 256;
  const numColorMatrixCols = 5;
  const numColorMatrixRows = 4;
  const colorMatrices = new Float32Array(numColorMatrices * numColorMatrixRows * numColorMatrixCols);
  for (let i = 0; i < numColorMatrices; i++) {
    for (let j = 0; j < numColorMatrixCols; j++) {
      colorMatrices[(numColorMatrices * j + i) * 4 + j] = 1;
    }
  }
  function copyMatrix(index2, rgbaTransform) {
    for (let col = 0; col < numColorMatrixCols; col++) {
      for (let row = 0; row < numColorMatrixRows; row++) {
        colorMatrices[(numColorMatrices * col + index2) * 4 + row] = rgbaTransform[col + row * numColorMatrixCols];
      }
    }
  }
  const { defaultAction, groups } = highlights;
  copyMatrix(0, getRGBATransform(defaultAction));
  for (let i = 0; i < groups.length; i++) {
    copyMatrix(i + 1, getRGBATransform(groups[i].action));
  }
  return colorMatrices;
}
function interleaveRGBA(r, g, b, a) {
  const n = r.length;
  console.assert(n == g.length && n == b.length && n == a.length);
  const rgba = new Uint8ClampedArray(256 * 4);
  let j = 0;
  for (let i = 0; i < n; i++) {
    rgba[j++] = r[i];
    rgba[j++] = g[i];
    rgba[j++] = b[i];
    rgba[j++] = a[i];
  }
  return rgba;
}
function sequenceEqual(a, b) {
  if (a.length != b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }
  return true;
}
var defaultRGBATransform = [
  1,
  0,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  0,
  1,
  0
];
function getRGBATransform(action) {
  return typeof action != "string" && Array.isArray(action) ? action : defaultRGBATransform;
}

// ../core3d/modules/octree/module.ts
var _OctreeModule = class {
  kind = "octree";
  sceneUniforms = {
    applyDefaultHighlight: "bool",
    iblMipCount: "float",
    pixelSize: "float",
    maxPixelSize: "float",
    metricSize: "float",
    toleranceFactor: "float",
    deviationIndex: "int",
    deviationFactor: "float",
    deviationRange: "vec2",
    useProjectedPosition: "bool",
    elevationRange: "vec2",
    pickOpacityThreshold: "float"
  };
  gradientImageParams = { kind: "TEXTURE_2D", width: 1024 /* size */, height: 2, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null };
  maxHighlights = 8;
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new OctreeModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return {
      scene: glUBOProxy(this.sceneUniforms)
    };
  }
  async createResources(context, uniforms) {
    const bin = context.resourceBin("Watermark");
    const sceneUniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniforms.scene.buffer });
    const samplerNearest = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    const defaultBaseColorTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array([255, 255, 255, 255]) });
    const materialTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null });
    const highlightTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 256, height: 5, internalFormat: "RGBA32F", type: "FLOAT", image: null });
    const gradientsTexture = bin.createTexture(this.gradientImageParams);
    const { outline } = context.deviceProfile.features;
    const transformFeedback = bin.createTransformFeedback();
    let vb_line = null;
    let vao_line = null;
    if (outline) {
      vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: this.maxLines * 24, usage: "STATIC_DRAW" });
      vao_line = bin.createVertexArray({
        attributes: [
          { kind: "FLOAT_VEC4", buffer: vb_line, byteStride: 24, byteOffset: 0, componentType: "FLOAT", divisor: 1 },
          // positions in plane space (line vertex pair)
          { kind: "FLOAT", buffer: vb_line, byteStride: 24, byteOffset: 16, componentType: "FLOAT", divisor: 1 },
          // opacity
          { kind: "UNSIGNED_INT", buffer: vb_line, byteStride: 24, byteOffset: 20, componentType: "UNSIGNED_INT", divisor: 1 }
          // object_id
        ]
      });
    }
    const { textureUniforms, uniformBufferBlocks } = _OctreeModule;
    const programs = {};
    const shadersPromise = _OctreeModule.compileShaders(context, bin, programs);
    const [
      /*color, pick, pre,*/
      intersect,
      line,
      debug
    ] = await Promise.all([
      // context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(ShaderPass.color, ShaderMode.triangles) }),
      // context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(ShaderPass.pick, ShaderMode.triangles) }),
      // context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(ShaderPass.pre, ShaderMode.triangles) }),
      context.makeProgramAsync(bin, { ...shaders.intersect, uniformBufferBlocks: ["Camera", "Clipping", "Outline", "Node"], transformFeedback: { varyings: ["line_vertices", "opacity", "object_id"], bufferMode: "INTERLEAVED_ATTRIBS" } }),
      context.makeProgramAsync(bin, { ...shaders.line, uniformBufferBlocks: ["Camera", "Clipping", "Outline", "Node"] }),
      context.makeProgramAsync(bin, { ...shaders.debug, uniformBufferBlocks }),
      shadersPromise
    ]);
    programs.intersect = intersect;
    programs.line = line;
    programs.debug = debug;
    return {
      bin,
      programs,
      transformFeedback,
      vb_line,
      vao_line,
      sceneUniforms,
      samplerNearest,
      defaultBaseColorTexture,
      materialTexture,
      highlightTexture,
      gradientsTexture
    };
  }
  static shaderConstants(deviceProfile, pass, mode, programFlags = _OctreeModule.defaultProgramFlags) {
    const { clip, dither, highlight } = programFlags;
    const flags = [];
    if (clip || deviceProfile.quirks.slowShaderRecompile) {
      flags.push("CLIP");
    }
    if (dither) {
      flags.push("DITHER");
    }
    if (highlight) {
      flags.push("HIGHLIGHT");
    }
    if (deviceProfile.quirks.adreno600) {
      flags.push("ADRENO600");
    }
    const defines = [
      { name: "PASS", value: pass.toString() },
      { name: "MODE", value: mode.toString() }
    ];
    return { defines, flags };
  }
  static async compileShaders(context, bin, programs, programFlags = _OctreeModule.defaultProgramFlags) {
    const { textureUniforms, uniformBufferBlocks } = _OctreeModule;
    const promises = [];
    for (const pass of _OctreeModule.passes) {
      const modes = programs[pass] ??= {};
      for (const mode of _OctreeModule.modes) {
        const promise = context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: _OctreeModule.shaderConstants(context.deviceProfile, pass, mode, programFlags) });
        const compiledPromise = promise.then((program) => {
          modes[mode] = program;
        });
        promises.push(compiledPromise);
      }
    }
    await Promise.all(promises);
  }
  maxLines = 1024 * 1024;
  // TODO: find a proper size!
};
var OctreeModule = _OctreeModule;
__publicField(OctreeModule, "textureNames", ["base_color", "ibl.diffuse", "ibl.specular", "materials", "highlights", "gradients"]);
__publicField(OctreeModule, "textureUniforms", _OctreeModule.textureNames.map((name) => `textures.${name}`));
__publicField(OctreeModule, "uniformBufferBlocks", ["Camera", "Clipping", "Scene", "Node"]);
__publicField(OctreeModule, "passes", [0 /* color */, 1 /* pick */, 2 /* pre */]);
__publicField(OctreeModule, "modes", [0 /* triangles */, 1 /* points */, 2 /* terrain */]);
__publicField(OctreeModule, "defaultProgramFlags", {
  clip: false,
  dither: false,
  highlight: false
});

// ../core3d/modules/tonemap/shader.vert
var shader_default5 = "layout(std140) uniform Tonemapping {\n    TonemappingUniforms tonemapping;\n};\n\nuniform TonemappingTextures textures;\n\nout TonemappingVaryings varyings;\n\nvoid main() {\n    varyings.uv = vec2(gl_VertexID % 2, gl_VertexID / 2);\n    gl_Position = vec4(varyings.uv * 2.0 - 1.0, 0, 1);\n}\n";

// ../core3d/modules/tonemap/shader.frag
var shader_default6 = "layout(std140) uniform Tonemapping {\n    TonemappingUniforms tonemapping;\n};\n\nuniform TonemappingTextures textures;\n\nin TonemappingVaryings varyings;\n\nlayout(location = 0) out vec4 fragColor;\n\nuint hash(uint x) {\n    x += (x << 10u);\n    x ^= (x >> 6u);\n    x += (x << 3u);\n    x ^= (x >> 11u);\n    x += (x << 15u);\n    return x;\n}\n\n// ACES tone map (faster approximation)\n// see: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/\nvec3 toneMapACES_Narkowicz(vec3 color) {\n    const float A = 2.51;\n    const float B = 0.03;\n    const float C = 2.43;\n    const float D = 0.59;\n    const float E = 0.14;\n    return clamp((color * (A * color + B)) / (color * (C * color + D) + E), 0.0, 1.0);\n}\n\n// ACES filmic tone map approximation\n// see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl\nvec3 RRTAndODTFit(vec3 color) {\n    vec3 a = color * (color + 0.0245786) - 0.000090537;\n    vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;\n    return a / b;\n}\n\nvoid main() {\n    vec4 color = vec4(1, 0, 0, 1);\n    switch(tonemapping.mode) {\n        case tonemapModeColor: {\n            color = texture(textures.color, varyings.uv);\n            color.rgb = RRTAndODTFit(color.rgb * tonemapping.exposure);\n            color.rgb = linearTosRGB(color.rgb);\n            break;\n        }\n        case tonemapModeNormal: {\n            vec3 xyz = unpackNormalAndDeviation(texture(textures.pick, varyings.uv).yz).xyz;\n            if(any(isnan(xyz))) {\n                color.rgb = vec3(0);\n            } else {\n                color.rgb = xyz * .5 + .5;\n            }\n            break;\n        }\n        case tonemapModeDepth: {\n            float linearDepth = uintBitsToFloat(texture(textures.pick, varyings.uv).w);\n            if(isinf(linearDepth)) {\n                color.rgb = vec3(0, 0, 0.25);\n            } else {\n                float i = (linearDepth / tonemapping.maxLinearDepth);\n                color.rgb = vec3(pow(i, 0.5));\n            }\n            break;\n        }\n        case tonemapModeObjectId: {\n            uint objectId = texture(textures.pick, varyings.uv).x;\n            if(objectId == 0xffffffffU) {\n                color.rgb = vec3(0);\n            } else {\n                // color.rgb = vec3(0,1,1);\n                uint rgba = hash(~objectId);\n                float r = float((rgba >> 16U) & 0xffU) / 255.;\n                float g = float((rgba >> 8U) & 0xffU) / 255.;\n                float b = float((rgba >> 0U) & 0xffU) / 255.;\n                color.rgb = vec3(r, g, b);\n            }\n            break;\n        }\n        case tonemapModeDeviation: {\n            float deviation = unpackNormalAndDeviation(texture(textures.pick, varyings.uv).yz).w;\n            color.rgb = deviation > 0. ? vec3(0, deviation / tonemapMaxDeviation, 0) : vec3(-deviation / tonemapMaxDeviation, 0, 0);\n            break;\n        }\n        case tonemapModeZbuffer: {\n            float z = texture(textures.zbuffer, varyings.uv).x;\n            color.rgb = vec3(z);\n            break;\n        }\n    }\n    fragColor = color;\n}\n";

// ../core3d/modules/tonemap/index.ts
var TonemapModule = class {
  kind = "tonemap";
  uniforms = {
    exposure: "float",
    mode: "uint",
    maxLinearDepth: "float"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new TonemapModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return glUBOProxy(this.uniforms);
  }
  async createResources(context, uniformsProxy) {
    const bin = context.resourceBin("Tonemap");
    const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
    const sampler = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    const textureNames = ["color", "pick", "zbuffer"];
    const textureUniforms = textureNames.map((name) => `textures.${name}`);
    const program = await context.makeProgramAsync(bin, { vertexShader: shader_default5, fragmentShader: shader_default6, uniformBufferBlocks: ["Tonemapping"], textureUniforms });
    return { bin, uniforms, sampler, program };
  }
};
var TonemapModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
  }
  update(state) {
    const { context } = this;
    const { uniforms } = this.resources;
    const { camera, tonemapping } = state;
    if (context.hasStateChanged({ camera, tonemapping })) {
      const { camera: camera2, tonemapping: tonemapping2 } = state;
      const { values } = this.uniforms;
      values.exposure = Math.pow(2, tonemapping2.exposure);
      values.mode = tonemapping2.mode;
      values.maxLinearDepth = camera2.far;
      context.updateUniformBuffer(uniforms, this.uniforms);
    }
  }
  render() {
    const { context, resources } = this;
    const { program, sampler, uniforms } = resources;
    const { gl } = context;
    const { textures } = context.buffers;
    context.buffers.resolveMSAA();
    glState(gl, {
      program,
      uniformBuffers: [uniforms],
      textures: [
        { kind: "TEXTURE_2D", texture: textures.color, sampler },
        { kind: "TEXTURE_2D", texture: textures.pick, sampler },
        { kind: "TEXTURE_2D", texture: textures.depth, sampler }
      ],
      frameBuffer: null,
      drawBuffers: ["BACK"],
      depth: {
        test: false,
        writeMask: false
      }
    });
    const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
    context["addRenderStatistics"](stats);
  }
  contextLost() {
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};

// ../core3d/modules/cube/shaders/render.vert
var render_default3 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Cube {\n    CubeUniforms cube;\n};\n\nout CubeVaryings varyings;\n\nlayout(location = 0) in vec4 vertexPosition;\nlayout(location = 1) in vec3 vertexNormal;\nlayout(location = 2) in vec3 vertexColor;\n\nvoid main() {\n    vec4 posVS = camera.localViewMatrix * cube.modelLocalMatrix * vertexPosition;\n    gl_Position = camera.viewClipMatrix * posVS;\n    varyings.posVS = posVS.xyz;\n    varyings.normal = vertexNormal;\n    varyings.color = vertexColor;\n}\n";

// ../core3d/modules/cube/shaders/render.frag
var render_default4 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Cube {\n    CubeUniforms cube;\n};\n\nin CubeVaryings varyings;\n\n#if !defined(PICK)\nlayout(location = 0) out vec4 fragColor;\n#else\nlayout(location = 1) out uvec4 fragPick;\n#endif\n\nvoid main() {\n    float linearDepth = -varyings.posVS.z;\n    if(linearDepth < camera.near || clip(varyings.posVS, clipping))\n        discard;\n#if !defined(PICK)\n    fragColor = vec4(gl_FrontFacing ? varyings.color : vec3(.25), 1);\n#else\n    fragPick = uvec4(cubeId, packNormal(normalize(varyings.normal).xyz), floatBitsToUint(linearDepth));\n#endif\n}\n";

// ../core3d/modules/cube/shaders/line.vert
var line_default3 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Cube {\n    CubeUniforms cube;\n};\n\nlayout(std140) uniform Outline {\n    OutlineUniforms outline;\n};\n\nlayout(location = 0) in vec4 vertexPositions;\nlayout(location = 1) in float vertexOpacity;\n\nout struct {\n    vec3 positionVS;\n    float opacity;\n} varyings;\n\nvoid main() {\n    vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;\n    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;\n    varyings.positionVS = posVS;\n    varyings.opacity = vertexOpacity;\n    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);\n}\n";

// ../core3d/modules/cube/shaders/line.frag
var line_default4 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Cube {\n    CubeUniforms cube;\n};\n\nlayout(std140) uniform Outline {\n    OutlineUniforms outline;\n};\n\nin struct {\n    vec3 positionVS;\n    float opacity;\n} varyings;\n\nlayout(location = 0) out vec4 fragColor;\n\nvoid main() {\n    if(clipOutlines(varyings.positionVS, clipping))\n        discard;\n    fragColor = vec4(outline.color, varyings.opacity);\n}\n";

// ../core3d/modules/cube/shaders/intersect.vert
var intersect_default2 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Cube {\n    CubeUniforms cube;\n};\n\nlayout(std140) uniform Outline {\n    OutlineUniforms outline;\n};\n\nvec2 intersectEdge(vec3 p0, vec3 p1) {\n    float t = -p0.z / (p1.z - p0.z);\n    return mix(p0.xy, p1.xy, t);\n}\n\nlayout(location = 0) in vec4 vertexPos0;\nlayout(location = 1) in vec4 vertexPos1;\nlayout(location = 2) in vec4 vertexPos2;\n\nflat out uvec2 line_vertices;\nout float opacity;\n\nvoid main() {\n    vec3 pos0 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vertexPos0).xyz;\n    vec3 pos1 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vertexPos1).xyz;\n    vec3 pos2 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vertexPos2).xyz;\n    vec3 ab = pos1 - pos0;\n    vec3 ac = pos2 - pos0;\n    vec3 normal = normalize(cross(ab, ac));\n    vec3 z = vec3(pos0.z, pos1.z, pos2.z);\n    bvec3 gt = greaterThan(z, vec3(0));\n    bvec3 lt = lessThan(z, vec3(0));\n    int i = 0;\n    vec2 line[3];\n    // does triangle straddle clipping plane?\n    if(any(gt) && any(lt)) {\n        // find intersecting edges\n        if(any(gt.xy) && any(lt.xy)) {\n            line[i++] = intersectEdge(pos0, pos1);\n        }\n        if(any(gt.yz) && any(lt.yz)) {\n            line[i++] = intersectEdge(pos1, pos2);\n        }\n        if(any(gt.zx) && any(lt.zx)) {\n            line[i++] = intersectEdge(pos2, pos0);\n        }\n    }\n    if(i == 2) {\n        line_vertices = uvec2(packHalf2x16(line[0]), packHalf2x16(line[1]));\n    } else {\n        line_vertices = uvec2(0);\n    }\n    opacity = 1. - abs(normal.z);\n}\n";

// ../core3d/modules/cube/shaders/index.ts
var shaders2 = {
  render: {
    vertexShader: render_default3,
    fragmentShader: render_default4
  },
  line: {
    vertexShader: line_default3,
    fragmentShader: line_default4
  },
  intersect: {
    vertexShader: intersect_default2
  }
};

// ../core3d/modules/cube/index.ts
var CubeModule = class {
  kind = "cube";
  cubeUniforms = {
    modelLocalMatrix: "mat4"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new CubeModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return {
      cube: glUBOProxy(this.cubeUniforms)
    };
  }
  async createResources(context, uniformsProxy) {
    const vertices = createVertices((pos2, norm, col) => [...pos2, ...norm, ...col]);
    const pos = createVertices((pos2) => pos2);
    const indices = createIndices();
    const triplets = new Float32Array(indices.length * 3);
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3);
      const pa = pos.slice(a * 3, (a + 1) * 3);
      const pb = pos.slice(b * 3, (b + 1) * 3);
      const pc = pos.slice(c * 3, (c + 1) * 3);
      triplets.set(pa, i * 3 + 0);
      triplets.set(pb, i * 3 + 3);
      triplets.set(pc, i * 3 + 6);
    }
    const bin = context.resourceBin("Cube");
    const uniforms = {
      cube: bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.cube.buffer.byteLength })
    };
    const transformFeedback = bin.createTransformFeedback();
    const vb_render = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vertices });
    const ib_render = bin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices });
    const vao_render = bin.createVertexArray({
      attributes: [
        { kind: "FLOAT_VEC3", buffer: vb_render, byteStride: 36, byteOffset: 0 },
        // position
        { kind: "FLOAT_VEC3", buffer: vb_render, byteStride: 36, byteOffset: 12 },
        // normal
        { kind: "FLOAT_VEC3", buffer: vb_render, byteStride: 36, byteOffset: 24 }
        // color
      ],
      indices: ib_render
    });
    bin.subordinate(vao_render, vb_render, ib_render);
    const vb_triplets = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: triplets });
    const vao_triplets = bin.createVertexArray({
      attributes: [
        { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 0 },
        // position 0
        { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 12 },
        // position 1
        { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 24 }
        // position 2
      ]
    });
    bin.subordinate(vao_triplets, vb_triplets);
    const vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: 12 * 2 * 4, usage: "STATIC_DRAW" });
    const vb_opacity = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: 12 * 4, usage: "STATIC_DRAW" });
    const vao_line = bin.createVertexArray({
      attributes: [
        // { kind: "FLOAT_VEC2", buffer: vb_line, byteStride: 8, byteOffset: 0 }, // position
        // { kind: "FLOAT_VEC2", buffer: vb_line, byteStride: 4, byteOffset: 0, componentType: "HALF_FLOAT" }, // position
        { kind: "FLOAT_VEC4", buffer: vb_line, byteStride: 8, byteOffset: 0, componentType: "HALF_FLOAT", divisor: 1 },
        // position
        { kind: "FLOAT", buffer: vb_opacity, byteStride: 4, byteOffset: 0, componentType: "FLOAT", divisor: 1 }
        // opacity
      ]
    });
    const uniformBufferBlocks = ["Camera", "Clipping", "Cube"];
    const [color, pick, line, intersect] = await Promise.all([
      context.makeProgramAsync(bin, { ...shaders2.render, uniformBufferBlocks }),
      context.makeProgramAsync(bin, { ...shaders2.render, uniformBufferBlocks, header: { flags: ["PICK"] } }),
      context.makeProgramAsync(bin, { ...shaders2.line, uniformBufferBlocks: [...uniformBufferBlocks, "Outline"] }),
      context.makeProgramAsync(bin, { ...shaders2.intersect, uniformBufferBlocks: [...uniformBufferBlocks, "Outline"], transformFeedback: { varyings: ["line_vertices", "opacity"], bufferMode: "SEPARATE_ATTRIBS" } })
    ]);
    const programs = { color, pick, line, intersect };
    return { bin, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vb_line, vb_opacity, programs };
  }
};
var CubeModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
  }
  update(state) {
    const { context, resources, uniforms } = this;
    const { cube, localSpaceTranslation } = state;
    if (context.hasStateChanged({ cube, localSpaceTranslation })) {
      const { scale: scale7, position } = cube;
      const posLS = vec3_exports.subtract(vec3_exports.create(), position, localSpaceTranslation);
      const m = [
        scale7,
        0,
        0,
        0,
        0,
        scale7,
        0,
        0,
        0,
        0,
        scale7,
        0,
        ...posLS,
        1
      ];
      uniforms.cube.values.modelLocalMatrix = mat4_exports.fromValues(...m);
    }
    context.updateUniformBuffer(resources.uniforms.cube, uniforms.cube);
  }
  render(state) {
    const { context, resources } = this;
    const { programs, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vb_line, vb_opacity } = resources;
    const { gl, cameraUniforms, clippingUniforms, outlineUniforms, deviceProfile } = context;
    if (state.cube.enabled) {
      glState(gl, {
        program: programs.color,
        uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube],
        // drawBuffers: context.drawBuffers(),
        depth: { test: true },
        cull: { enable: false },
        vertexArrayObject: vao_render
      });
      const stats = glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: 36 });
      context["addRenderStatistics"](stats);
      if (state.outlines.enabled && deviceProfile.features.outline) {
        glState(gl, {
          program: programs.intersect,
          uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube, outlineUniforms],
          vertexArrayObject: vao_triplets
        });
        glTransformFeedback(gl, { kind: "POINTS", transformFeedback, outputBuffers: [vb_line, vb_opacity], count: 12 });
        glState(gl, {
          program: programs.line,
          // drawBuffers: context.drawBuffers(BufferFlags.color),
          blend: {
            enable: true,
            srcRGB: "SRC_ALPHA",
            dstRGB: "ONE_MINUS_SRC_ALPHA",
            srcAlpha: "ZERO",
            dstAlpha: "ONE"
          },
          depth: { test: false },
          vertexArrayObject: vao_line
        });
        const stats2 = glDraw(gl, { kind: "arrays_instanced", mode: "LINES", count: 2, instanceCount: 12 });
        context["addRenderStatistics"](stats2);
      }
    }
  }
  pick(state) {
    const { context, resources } = this;
    const { programs, uniforms, vao_render } = resources;
    const { gl, cameraUniforms, clippingUniforms } = context;
    if (state.cube.enabled) {
      glState(gl, {
        program: programs.pick,
        uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube],
        depth: { test: true },
        cull: { enable: false },
        vertexArrayObject: vao_render
      });
      glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: 36 });
    }
  }
  contextLost() {
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};
function createVertices(pack) {
  function face(x, y, color) {
    const normal = vec3_exports.cross(vec3_exports.create(), y, x);
    function vert(fx, fy) {
      const pos = vec3_exports.clone(normal);
      vec3_exports[fx](pos, pos, x);
      vec3_exports[fy](pos, pos, y);
      return pack(pos, normal, color);
    }
    return [
      ...vert("sub", "sub"),
      ...vert("add", "sub"),
      ...vert("sub", "add"),
      ...vert("add", "add")
    ];
  }
  return new Float32Array([
    ...face([0, 0, -1], [0, 1, 0], [1, 0, 0]),
    // right (1, 0, 0)
    ...face([0, 0, 1], [0, 1, 0], [0, 1, 1]),
    // left (-1, 0, 0)
    ...face([1, 0, 0], [0, 0, 1], [0, 1, 0]),
    // top (0, 1, 0)
    ...face([1, 0, 0], [0, 0, -1], [1, 0, 1]),
    // bottom (0, -1, 0)
    ...face([1, 0, 0], [0, 1, 0], [0, 0, 1]),
    // front (0, 0, 1)
    ...face([-1, 0, 0], [0, 1, 0], [1, 1, 0])
    // back (0, 0, -1)
  ]);
}
function createIndices() {
  let idxOffset = 0;
  function face() {
    const idx = [0, 2, 1, 1, 2, 3].map((i) => i + idxOffset);
    idxOffset += 4;
    return idx;
  }
  return new Uint16Array([
    ...face(),
    ...face(),
    ...face(),
    ...face(),
    ...face(),
    ...face()
  ]);
}

// ../core3d/modules/clipping/shader.vert
var shader_default7 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Colors {\n    ClippingColors visualization;\n};\n\nout ClippingVaryings varyings;\n\nvoid main() {\n    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;\n    vec3 dirVS = vec3(pos.x / camera.viewClipMatrix[0][0], pos.y / camera.viewClipMatrix[1][1], -1);\n    varyings.dirVS = dirVS;\n    gl_Position = vec4(pos, 0.9, 1);\n}\n";

// ../core3d/modules/clipping/shader.frag
var shader_default8 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Clipping {\n    ClippingUniforms clipping;\n};\n\nlayout(std140) uniform Colors {\n    ClippingColors visualization;\n};\n\nin ClippingVaryings varyings;\n\nlayout(location = 0) out vec4 fragColor;\nlayout(location = 1) out uvec4 fragPick;\n\nvoid main() {\n    vec3 dir = normalize(varyings.dirVS);\n    float rangeT[2] = float[](0., 1000000.); // min, max T\n    uint idx[2] = uint[](undefinedIndex, undefinedIndex);\n    float s = clipping.mode == 0U ? 1. : -1.;\n    for(uint i = 0U; i < clipping.numPlanes; i++) {\n        vec4 plane = clipping.planes[i];\n        vec3 normal = plane.xyz;\n        float offset = plane.w;\n        float denom = dot(dir, normal);\n        if(abs(denom) > 0.) {\n            float t = -offset / denom;\n            if(denom * s > 0.) {\n                // back facing\n                if(rangeT[0] < t) {\n                    rangeT[0] = t;\n                    idx[0] = i;\n                }\n            } else {\n                // front facing\n                if(rangeT[1] > t) {\n                    rangeT[1] = t;\n                    idx[1] = i;\n                }\n            }\n        }\n    }\n    uint i = clipping.mode == 0U ? 1U : 0U;\n    if(idx[i] == undefinedIndex || rangeT[1] < rangeT[0])\n        discard;\n    vec4 posVS = vec4(dir * rangeT[i], 1.);\n    vec4 posCS = camera.viewClipMatrix * posVS;\n    float ndcDepth = (posCS.z / posCS.w);\n    gl_FragDepth = (gl_DepthRange.diff * ndcDepth + gl_DepthRange.near + gl_DepthRange.far) / 2.;\n    vec4 rgba = visualization.colors[idx[i]];\n    uint objectId = clippingId + idx[i];\n    if(rgba.a == 0.)\n        discard;\n    fragColor = rgba;\n    vec3 normal = camera.viewLocalMatrixNormal * clipping.planes[idx[i]].xyz;\n    float linearDepth = -posVS.z;\n    fragPick = uvec4(objectId, packNormal(normal), floatBitsToUint(linearDepth));\n}\n";

// ../core3d/modules/clipping/index.ts
var ClippingModule = class {
  kind = "clipping";
  uniforms = {
    "colors.0": "vec4",
    "colors.1": "vec4",
    "colors.2": "vec4",
    "colors.3": "vec4",
    "colors.4": "vec4",
    "colors.5": "vec4"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new ClippingModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return glUBOProxy(this.uniforms);
  }
  async createResources(context, uniformsProxy) {
    const bin = context.resourceBin("Clipping");
    const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
    const uniformBufferBlocks = ["Camera", "Clipping", "Colors"];
    const program = await context.makeProgramAsync(bin, { vertexShader: shader_default7, fragmentShader: shader_default8, uniformBufferBlocks });
    return { bin, uniforms, program };
  }
};
var ClippingModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
  }
  update(state) {
    const { context, resources } = this;
    const { clipping } = state;
    if (context.hasStateChanged({ clipping })) {
      const { planes } = clipping;
      const values = this.uniforms.values;
      for (let i = 0; i < planes.length; i++) {
        const { color } = planes[i];
        const idx = i;
        values[`colors.${idx}`] = color ?? [0, 0, 0, 0];
      }
    }
    context.updateUniformBuffer(resources.uniforms, this.uniforms);
  }
  render(state) {
    const { context, resources } = this;
    const { program, uniforms } = resources;
    const { gl, cameraUniforms, clippingUniforms } = context;
    const { clipping } = state;
    if (clipping.draw) {
      glState(gl, {
        program,
        uniformBuffers: [cameraUniforms, clippingUniforms, uniforms],
        drawBuffers: context.drawBuffers(),
        depth: {
          test: true
          // writeMask: true,
        },
        blend: {
          enable: true,
          srcRGB: "SRC_ALPHA",
          dstRGB: "ONE_MINUS_SRC_ALPHA",
          srcAlpha: "ZERO",
          dstAlpha: "ONE"
        }
      });
      const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
      context["addRenderStatistics"](stats);
    }
  }
  contextLost() {
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};

// ../core3d/modules/watermark/shader.vert
var shader_default9 = "layout(std140) uniform Watermark {\n    WatermarkUniforms watermark;\n};\n\nout WatermarkVaryings varyings;\n\nlayout(location = 0) in vec3 vertexPosition;\n\nvoid main() {\n    vec4 p = watermark.modelClipMatrix * vec4(vertexPosition, 1.0);\n    varyings.elevation = p.z;\n    gl_Position = vec4(p.xy, 0.0, 1.0);\n}\n";

// ../core3d/modules/watermark/shader.frag
var shader_default10 = "layout(std140) uniform Watermark {\n    WatermarkUniforms watermark;\n};\n\nin WatermarkVaryings varyings;\n\nlayout(location = 0) out vec4 fragColor;\n\nvoid main() {\n    float a = clamp(varyings.elevation, 0.0, 1.0);\n    fragColor = vec4(watermark.color.rgb, a);\n}";

// ../core3d/modules/watermark/logo.bin
var logo_exports = {};
__export(logo_exports, {
  default: () => logo_default
});
var logo_default = __toBinary("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VwCNAKUAVgBXAKUAigCtAF0AigBdAHsAYABWAKUAfABgAKUAigB7AH0AigB9AHUAfAClAIoAngB8AIoAigB1AGMAigBjAGQAnQCeAIoAnACdAIoAigBkAJsAmwCcAIoAuAC2ALcAtwC5ALoAvAC4ALcAtwC6ALsAtwC7ALwASABHAFUAMwAyAEoASABVADMAVABIADMAMwBKAEkASQBLAFMAUwBOAE0ATQBMAE8ATwBQAFIAUgBRAEIAQgA4ADcANwA2ADUANQA0ADoAOgA5ACYAJgAlAC4ALgAvACgALgAoACcANQA6ACYAJgAuACcAJgAnAC0ANwA1ACYAUgBCADcATQBPAFIASQBTAE0AVAAzAEkARgBUAEkASQBNAFIAJgAtAEEAJgBBAEAASQBSADcARQBGAEkAQwBFAEkAJgBAADEAJgAxADAAQwBJADcARABDADcAJgAwACQAJgAkACMAKwBEADcALAArADcAJgAjADwANwAmADwAKQAsADcAKgApADcANwA8ADsANwA7AD8APQAqADcANwA/AD4APgA9ADcAPgF9AXwBPgF8AZIBHgQ6BDAAHgQwADEANgQ3BDYANgQ2ADcAKgA/BEAEKgBABCkANAQ1BCgANAQoAC8AMQQcBC0AMQQtACcAHQQ0BC8AHQQvAC4AMwQdBC4AMwQuACUAIwQ9BDsAIwQ7ADwANwQhBDUANwQ1ADYAMwAfBEYEMwBGBDIANQAhBDgENQA4BDQAPQAlBD8EPQA/BCoAOAAgBDYEOAA2BDcAOgAiBDkAJAQlBD0AJAQ9AD4APQQ+BD8APQQ/ADsAPgQkBD4APgQ+AD8ARABCBEMERABDBEMAQgBMBCAEQgAgBDgAQARBBCwAQAQsACkAMgQ5BEAAMgRAAEEASQRKBEwASQRMAE0ANAA4BCIENAAiBDoAQwQnBEUAQwRFAEMAJgRCBEQAJgREACsARQAnBEQERQBEBEYAPAQjBDwAPAQ8ACMAHAQyBEEAHARBAC0AOQQeBDEAOQQxAEAASgArBEcESgBHBEkAKQQqBEcAKQRHAEgAKAQpBEgAKARIAFQASwQvBFIASwRSAFAARwQsBEsARwRLAEkASgQuBE8ASgRPAEwASARJBE0ASARNAE4AQQQmBCsAQQQrACwATwAuBEsETwBLBFAAMARMBEIAMARCAFEAIgQzBCUAIgQlACYALQRIBE4ALQROAFMARAQoBFQARARUAEYAIgQmADkASwAsBC0ESwAtBFMAKgRFBFUAKgRVAEcAOgQ7BCQAOgQkADAANQQxBCcANQQnACgAVQBFBB8EVQAfBDMAMgBGBCsEMgArBEoAVgDVBNYEVgDWBFcAYQDoAw4EYQAOBGIAkgF8AXsBewFTAUUBRQFEAXUBdQF0AZABkAGPAUkBSQFIAYIBggFHAUYBRgE0AZEBRgGRAWoBSQGCAUYBdQGQAUkBewFFAXUBQQGSAXsBQgFBAXsBewF1AUkBSQFGAWoBSQFqAUsBQgF7AUkBUgFCAUkBSQFLAUoBSQFKAUwBUAFSAUkBSQFMAU0BSQFNAVABNAFGAY4BjgF/AXcBdwF2AY0BjQGBAYABgAFAAT8BPwF4AYwBjAE+AXoBjAF6AXkBgAE/AYwBdwGNAYABNAGOAXcBNQE0AXcBdwGAAYwBjAF5AVcBjAFXAVYBawE1AXcBTgFrAXcBdwGMAVYBdwFWAVUBTwFOAXcBUQFPAXcBdwFVAVQBdwFUAVEBPgGMAX4BfgE3ATYBNgF9AT4BfgE2AT4BWAF9ATYBNgGLAYoBigGJAW0BbQFlAWQBZAFoAYQBhAGDAYgBiAGHAYYBhgGFAWkBaQFnAWYBZgFvAW4BbgFsAWMBYwFZAUMBYwFDATkBZgFuAWMBhgFpAWYBhAGIAYYBbQFkAYQBNgGKAW0BWgFYATYBOgFaATYBNgFtAYQBhAGGAWYBZgFjATkBZgE5ATgBOgE2AYQBOwE6AYQBZgE4AT0BZgE9ATwBWwE7AYQBXAFbAYQBhAFmATwBhAE8AV0BXgFcAYQBYAFeAYQBhAFdAV8BhAFfAXABYQFgAYQBYgFhAYQBhAFwAXMBhAFzAXIBcQFiAYQBcgFxAYQBzwDRAMsAywDKAMkAyQDIAM0AzQDMAM4AwAC/AMQAzQDOAMAAywDJAM0A0ADPAMsAvQDQAMsAywDNAMAAwADEAMUAxQDCAMEAxQDBAMMAvgC9AMsAxgC+AMsAwADFAMMAwADDANMAxgDLAMAAxwDGAMAAwADTANIAwADSAMcAWgDfBMkEWgDJBFsADgTnA2sADgRrAGIAXAC9BNAEXADQBF0AXgDPBL0EXgC9BFwAXwC8BM8EXwDPBF4AYADUBNUEYADVBFYAYwC/BNMEYwDTBGQACwTrA3oACwR6AHkAZQDZBNsEZQDbBGYAbgDeBMgEbgDIBG8AEwTsA1gAEwRYAGoAEQQSBG0AEQRtAGwAEgTxA3YAEgR2AG0ACgQRBGwACgRsAHQAcADMBM0EcADNBHEAcQDNBM4EcQDOBHIAcwC6BMwEcwDMBHAAdQDSBL8EdQC/BGMAAwQMBIoAAwSKAIkAdwDLBN0EdwDdBHgA9wMLBHkA9wN5AKMAXQDQBNEEXQDRBHsADQTvA4EADQSBAIAAfADEBNQEfADUBGAAewDRBL4EewC+BH0AfQC+BNIEfQDSBHUAfgDwA+UDfgDlA38AggDYBMcEggDHBIMAegDrA/0DegD9A4cAhgDGBNgEhgDYBIIALwQwBFEALwRRAFIAVwDWBMUEVwDFBI0AmAAEBA8EmAAPBJkACATmA4UACASFAIQAEAT7A4wAEASMAIsAFAT5A4gAFASIAFkA/gP/A6QA/gOkAGgAjgDgBLEEjgCxBI8AjwCxBLIEjwCyBJAAkACyBLMEkACzBJEAkQCzBLQEkQC0BJIAkgC0BLUEkgC1BJMAkwC1BLYEkwC2BJQAlAC2BLcElAC3BJUAlQC3BLgElQC4BJYAlgC4BLkElgC5BJcAlwC5BLoElwC6BHMAmgC7BLwEmgC8BF8AoADtA/oDoAD6A2kAmwDABMEEmwDBBJwAnADBBMIEnADCBJ0AnQDCBMMEnQDDBJ4AngDDBMQEngDEBHwAWwDJBMoEWwDKBJ8AnwDKBMsEnwDLBHcApQD2A/UDpQD1A6YA+wP4A6EA+wOhAIwAoQD4A/wDoQD8A6IA/wP2A6UA/wOlAKQA+QMQBIsA+QOLAIgAAAQBBKgAAASoAKcApgD1AwAEpgAABKcAZgDbBOAEZgDgBI4A9AMCBKoA9AOqAKkADwQFBLEADwSxAJkAqgACBAMEqgADBIkA5wMGBK0A5wOtAGsAeADdBNwEeADcBKsAgwDHBNoEgwDaBKwAqwDcBNkEqwDZBGUA5gMJBK4A5gOuAIUArADaBN4ErADeBG4AfwDlAw0EfwANBIAAsADyAwoEsAAKBHQA7AMUBFkA7ANZAFgArgAJBPIDrgDyA7AA+gMTBGoA+gNqAGkAbwDIBN8EbwDfBFoADAQEBJgADASYAIoArQAGBAcErQAHBLMABQTzA7IABQSyALEAswAHBAgEswAIBIQAjQDFBNcEjQDXBLQA/AP3A6MA/AOjAKIAtQDuA+0DtQDtA6AAtADXBMYEtADGBIYAsgDzA+gDsgDoA2EA/QPqA2cA/QNnAIcA8QPwA34A8QN+AHYAZADTBMAEZADABJsA6gP+A2gA6gNoAGcAcgDOBLsEcgC7BJoAgQDvA+4DgQDuA7UAAQTpA68AAQSvAKgABQUGBdUABQXVANQAFQQbBLcAFQS3ALYAFgQVBLYAFgS2ALgAGAQXBLoAGAS6ALkAGgQZBLwAGgS8ALsAFwQaBLsAFwS7ALoAvAAZBBYEvAAWBLgAGwQYBLkAGwS5ALcAwQAiAA0AwQANAMMAXANdA6ABXAOgAaEBvwAOAA8AvwAPAMQAvgAYAB0AvgAdAL0A0wAhABcA0wAXANIA7gDvAAMBAwEsAS4BLgHyAOoA6gDrAPQA9AD8AP0A/QD+AP8A/wAzAR4BHgHnAOgA6ADWANcA1wAGAQkBCQEKAR8BHwEgASEBIQH3APgA+AABASoB+AAqAewAHwEhAfgA1wAJAR8BHgHoANcA/QD/AB4B6gD0AP0AAwEuAeoA8QDuAAMBFQHxAAMBAwHqAP0A/QAeAdcA1wAfAfgA+ADsAO0A+ADtANgAFQEDAf0AFAEVAf0A1wD4ANgA1wDYANkAEwEUAf0AEgETAf0A1wDZAB0B1wAdAfUAEQESAf0AEAERAf0A1wD1APYA1wD2ACkBDwEQAf0ADgEPAf0A1wApAeMA1wDjAOQADgH9ANcADQEOAdcA1wDkAAwB1wAMAQ0BzAAMAM4ADADAAM4AwgARACIAwgAiAMEAxQAQABEAxQARAMIAwAAMAA4AwAAOAL8AxwASAB4AxwAeAMYAyQAVAB8AyQAfAMgAygAUABUAygAVAMkAywAgABQAywAUAMoANwGnA64DNwGuAzYBzQAWAAwAzQAMAMwA0AAZABoA0AAaAM8A0QAbABwAvQAdABkAvQAZANAA0gAXABIA0gASAMcAwwANACEAwwAhANMAcAN1A3IBcANyAXMB5wDKA+MD5wDjA+gAyAAfABYAyAAWAM0AzwAaABsAzwAbANEAcQOJA2EBcQNhAWIBAgEDAe8AAgHvAPAAKwExAQIB4ADpACsBMAHfAOAAFwEvATABCAEWARcBKAEHAQgBLQEnASgBJQEmAS0BIwEkASUB5gAiASMBBQHlAOYAAQH4AAUBAAEBAQUBBQHmACMBIwElAS0BLQEoAQgBCAEXATABMAHgACsBKwECAfAAKwHwABgBCAEwASsBIwEtAQgBAAEFASMBBAEAASMBKwEYAd0AKwHdANwAMgEEASMBCwEyASMBKwHcANoAKwHaANsA1QALASMB1ADVACMBCAErAdsACAHbAPkA3gDUACMB+gDeACMBCAH5APsACAH7APMA+gAjAQgBHAH6AAgBCAHzAOEACAHhAOIAGwEcAQgBGgEbAQgBCAHiABkBGQEaAQgBBAUFBdQABAXUAN4A/QC1A90D/QDdA/4AAQH3BAoFAQEKBSoBDwX5BNkADwXZANgA6wTsBN0A6wTdABgBBwX2BAQBBwUEATIB7wQDBeIA7wTiAOEA6wDiA8ED6wDBA/QACQULBeQACQXkAOMADgX4BO0ADgXtAOwAAwG2A9kDAwHZAywB6gDhA+ID6gDiA+sA3wC4A94D3wDeA+AA2gPhA+oA2gPqAPIA/AT9BO8A/ATvAO4A/QT+BPAA/QTwAO8A6gT8BO4A6gTuAPEABgX1BAsBBgULAdUA+wDuBAIF+wACBfMA/wTtBNoA/wTaANwA+QABBe4E+QDuBPsA2gDtBAAF2gAABdsA4ADeA7cD4AC3A+kABAH2BAgFBAEIBQAB4gTjBA8B4gQPAQ4BIQHHA9sDIQHbA/cABwHTA9wDBwHcAwgBLQG5A8QDLQHEAycBIAUfBTQBIAU0ATUBoAIBAFMEUwRSBAAAUwQAAKAC/gDdA78D/gC/A/8ACwUQBQwBCwUMAeQAAgHYA7YDAgG2AwMB+AC7A80D+ADNAwUBCQHgA8sDCQHLAwoB1wDkA8kD1wDJAwYBFgHUA98DFgHfAxcB4QTiBA4B4QQOAQ0BCAX3BAEBCAUBAQAB5ATlBBEB5AQRARAB8wACBe8E8wDvBOEADAEQBeEEDAHhBA0B5QTmBBIB5QQSAREB5gTnBBMB5gQTARIB5wToBBQB5wQUARMB6ATpBBUB6AQVARQB6QTqBPEA6QTxABUBDQUMBSkBDQUpAfYAGgHxBPIEGgHyBBsBAAUBBfkAAAX5ANsADwHjBOQEDwHkBBAB5gDOA88D5gDPAyIB8ATxBBoB8AQaARkBGwHyBPMEGwHzBBwB8wT0BPoA8wT6ABwB2QD5BPoE2QD6BB0BBgHJA+ADBgHgAwkBHgG9A8oDHgHKA+cACgHLA8gDCgHIAx8BHwHIA8wDHwHMAyABJQHQA9EDJQHRAyYBIAHMA8cDIAHHAyEBtwFDA7YBIgHPA8YDIgHGAyMBKAHSA9MDKAHTAwcBJAHFA9ADJAHQAyUBCAHcA9QDCAHUAxYB9QD7BA0F9QANBfYADAUJBeMADAXjACkB3QDsBP8E3QD/BNwA5QC6A84D5QDOA+YACgUOBewACgXsACoB6ADjA7wD6AC8A9YA9wDbA7sD9wC7A/gA1gC8A+QD1gDkA9cA+AQPBdgA+ATYAO0AMAHDA7gDMAG4A98ALwHVA8MDLwHDAzABLAHZA8IDLAHCAy4B9QQHBTIB9QQyAQsBKwHWA9cDKwHXAzEBJwHEA9IDJwHSAygBMQHXA9gDMQHYAwIBLgHCA9oDLgHaA/IAAwXwBBkBAwUZAeIA/wC/A74D/wC+AzMB+gT7BPUA+gT1AB0BBQHNA7oDBQG6A+UAFwHfA9UDFwHVAy8BMwG+A70DMwG9Ax4B6QC3A9YD6QDWAysB/gTrBBgB/gQYAfAA+gD0BAQF+gAEBd4AJgHRA7kDJgG5Ay0BIwHGA8UDIwHFAyQB9ADBA8AD9ADAA/wAPQGLA6oDPQGqAzwBOQF3A4wDOQGMAzgBOwF0A6MDOwGjAzoBcwN0AzsBcwM7AVsBfQOVA2gBfQNoAWQBQgEYBUEBbgN3AzkBbgM5AUMBRQGkA6EDRQGhA0QBSwEeBR0FSwEdBUoBtANYAVoBpgOCA0YBpgNGAUcBSgEdBRwFSgEcBUwBTAEcBRsFTAEbBU0BTwESBREFTwERBU4BTQEbBRoFTQEaBVABUQETBRIFUQESBU8BUAEaBRkFUAEZBVIBhQOkA0UBhQNFAVMBUgEZBRgFUgEYBUIBVAEUBRMFVAETBVEBFQUUBVQBFQVUAVUBFgUVBVUBFgVVAVYBFwUWBVYBFwVWAVcBPAGqA6sDPAGrA10BsAOvA4wBsAOMAXgBywATACAAhwNzA1sBhwNbAVwBXQGrA3YDXQF2A18BxgAeABgAxgAYAL4AagEiBR4FagEeBUsBmgN/Az8BmgM/AUABYAFyA4gDYAGIA14BiQNyA2ABiQNgAWEBegN5A2MB0QAcABMA0QATAMsAZQF+A30DZQF9A2QBqAOPA2YBqANmAWcBaQGQA6gDaQGoA2cBjQN6A2MBjQNjAWwBZgGPA3sDZgF7A28BTgERBSEFTgEhBWsBbQGWA34DbQF+A2UBewOOA24BewNuAW8BegEkBXkBdgNvA3ABdgNwAV8BcQGKA3EDcQFxA2IBdQOKA3EBdQNxAXIBgQOyA3YBgQN2AXcBhAOgA3QBhAN0AXUBqQNuA0MBqQNDAVkBfwOwA3gBfwN4AT8BtAOGA3wBtAN8AX0BsQOAA4ABsQOAAYEBfAGGA6IDfAGiA3sBJAUXBVcBJAVXAXkBmQOnAzcBmQM3AX4BewGiA4UDewGFA1MBRAGhA4QDRAGEA3UBnAOBA3cBnAN3AX8BawEhBSAFawEgBTUBfAOUA4MBfAODAYQBnQOmA0cBnQNHAYIBcAFvA3ADcAFwA3MBpQOdA4IBpQOCAUgBrAORA4UBrAOFAYYBowO0A1oBowNaAToBjgONA2wBjgNsAW4BjAOLAz0BjAM9ATgBkQOQA2kBkQNpAYUBmAOXA4oBmAOKAYsBiAGTA5IDiAGSA4cBkgOsA4YBkgOGAYcBlwOtA4kBlwOJAYoBlAOTA4gBlAOIAYMBrQOWA20BrQNtAYkBdAGgA58DdAGfA5ABrgOYA4sBrgOLATYBnwOeA48BnwOPAZABrwOZA34BrwN+AYwBmwOxA4EBmwOBAY0BgwOlA0gBgwNIAUkBsgObA40BsgONAXYBswOcA38BswN/AY4BggOzA44BggOOAUYBgAOaA0ABgANAAYABYwF5A3gDYwF4A1kBkQEjBSIFkQEiBWoBNAEfBSMFNAEjBZEBPgEkBXoBlQN8A4QBlQOEAWgBngODA0kBngNJAY8BtAN9AVgBeAOpA1kBQQEYBZIBkgEYBSQFkgEkBT4BxAAPABAAxAAQAMUA6QP0A6kA6QOpAK8AxQHEAdIBsAGvAccBxQHSAbAB0QHFAbABsAHHAcYBxgHIAdAB0AHLAcoBygHJAcwBzAHNAc8BzwHOAb8BvwG1AbQBtAGzAbIBsgGxAbcBtwG2AaMBowGiAasBqwGsAaUBqwGlAaQBsgG3AaMBowGrAaQBowGkAaoBtAGyAaMBzwG/AbQBygHMAc8BxgHQAcoB0QGwAcYBwwHRAcYBxgHKAc8BowGqAb4BowG+Ab0BxgHPAbQBwgHDAcYBwAHCAcYBowG9Aa4BowGuAa0BwAHGAbQBwQHAAbQBowGtAaEBowGhAaABqAHBAbQBqQGoAbQBowGgAbkBtAGjAbkBpgGpAbQBpwGmAbQBtAG5AbgBtAG4AbwBugGnAbQBtAG8AbsBuwG6AbQBQwNUA6IBQwOiAaMBVgNSA6QBVgOkAaUBpwFgA2EDpwFhA6YBVQNWA6UBVQOlAawBUgM9A6oBUgOqAaQBPgNVA6wBPgOsAasBPwNbA60BPwOtAa4BtAFXA1gDtAFYA7MBsAFAA2cDsAFnA68BsgFCA1kDsgFZA7EBswFYA0IDswFCA7IBtQFBA1cDtQFXA7QBuQFEA14DuQFeA7gBuwFFA0YDuwFGA7oBuAFeA18DuAFfA7wBugFGA2ADugFgA6cBSgNLA8QBSgPEAcUBvwFtA0EDvwFBA7UBpgFhA2IDpgFiA6kBUwNaA70BUwO9Ab4BwQFjA2QDwQFkA8ABwAFkA0gDwAFIA8IBygFqA2sDygFrA8kBqAFHA2MDqAFjA8EBwgFIA2UDwgFlA8MBvAFfA0UDvAFFA7sBXQNEA7kBXQO5AaABWgM/A64BWgOuAb0BsQFZA0MDsQFDA7cBPQNTA74BPQO+AaoBzwFQA1EDzwFRA84BxwFMA2gDxwFoA8YBxgFoA00DxgFNA8gByQFrA08DyQFPA8wBywFpA2oDywFqA8oBWwNcA6EBWwOhAa0BzAFPA2wDzAFsA80BzQFsA1ADzQFQA88BSQNKA8UBSQPFAdEBzgFRA20DzgFtA78B0AFOA2kD0AFpA8sBZQNJA9EBZQPRAcMBSwNmA9IBSwPSAcQByAFNA04DyAFOA9ABtgFDA6MB0gFmA0AD0gFAA7ABqQFiA0cDqQFHA6gBrwFnA0wDrwFMA8cBOAJdBV4FOAJeBTcCOwQ8BCMAOwQjACQA4AEgAh8C4AEfAjYCNgIfAh4CHgL1AecB5wHmARgCGAIXAjQCNAIzAusB6wHqASYCJgLpAegB6AHWATUC6AE1Ag0C6wEmAugBGAI0AusBHgLnARgC4wE2Ah4C5AHjAR4CHgIYAusB6wHoAQ0C6wENAu0B5AEeAusB9AHkAesB6wHtAewB6wHsAe4B8gH0AesB6wHuAe8B6wHvAfIB1gHoATICMgIjAhoCGgIZAjECMQIlAiQCJALiAeEB4QEbAjACMALgAR0CMAIdAhwCJALhATACGgIxAiQC1gEyAhoC1wHWARoCGgIkAjACMAIcAvkBMAL5AfgBDgLXARoC8AEOAhoCGgIwAvgBGgL4AfcB8QHwARoC8wHxARoCGgL3AfYBGgL2AfMB4AEwAiECIQLZAdgB2AEgAuABIQLYAeAB+gEiAiACIALYAS8CLwIuAi0CLQIQAggCCAIHAgsCCwIoAicCJwIsAisCKwIqAikCKQIMAgoCCgIJAhICEgIRAg8CDwIGAvwB/AHlAdsBDwL8AdsBCgISAg8CKwIpAgoCCwInAisCLQIIAgsCIAIvAi0C+gEgAi0CLQILAisCKwIKAg8CDwLbAdoBDwLaAd8B+wH6AS0C/QH7AS0CKwIPAt8BKwLfAd4B3AH9AS0C3QHcAS0CKwLeAQACKwIAAgIC/gHdAS0C/wH+AS0CKwICAhMCKwITAhYC/wEtAisCAQL/ASsCKwIWAhUCKwIVAhQCAwIBAisCBAIDAisCKwIUAgUCBQIEAisC2wHYAu0C2wHtAtoB4gH7AuAC4gHgAuEB5gIFA+cB5gLnAfUB3QHVAgQD3QEEA9wBAQLpAugCAQLoAv8BNQI2BTUFNQI1BQ0C8wEnBSYF8wEmBfEB3wHsAgsD3wELA94BzwLYAtsBzwLbAeUB5wEFAwID5wECA+YB6QEHA+MC6QHjAugB7gEvBS4F7gEuBe8B5AE3BeMB4AE4BR0C8AElBTQF8AE0BQ4CKAUnBfMBKAXzAfYB8gEtBSwF8gEsBfQB9AEsBTcF9AE3BeQB+wH9ARUDKgUpBfcBKgX3AfgBKQUoBfYBKQX2AfcBDQI1BTEFDQIxBe0BKwUqBfgBKwX4AfkBDgI0BTMFDgIzBdcBIAIiAhUD/wHoAtQC/wHUAv4B3gELAwwD3gEMAwACAAIMA9cCAALXAgIC/AEKA88C/AHPAuUBBgLbAtoCAwLTAukCAwLpAgECBALqAtMCBALTAgMCBQLSAuoCBQLqAgQCCgIJA/ACCgLwAgkCCALfAt4CCALeAgcCBwLeAvYCBwL2AgsCDALxAgkDDAIJAwoCDwLuAtsCDwLbAgYCAgLXAtACAgLQAhMCOAUrBfkBOAX5ARwC7AEwBS8F7AEvBe4BEAL3At8CEALfAggCEgLcAu8CEgLvAhECCQLwAtwCCQLcAhICFQLWAusCFQLrAhQCFALrAtICFALSAgUCFgLRAtYCFgLWAhUCGgLiAhMDGgITAxkCGALlAgEDGAIBAxcC5wIDAx4C5wIeAh8C4QHgAhED4QERAxsCEwLQAtECEwLRAhYCIQL6AggDIQIIA9kBMQUwBewBMQXsAe0BIAIVA+cCIALnAh8CIgL6ARUD/ADAA7UD/AC1A/0AJQISA+ECJQLhAiQCAwPmAvUBAwP1AR4CIwL9AuICIwLiAhoC5gECA+UC5gHlAhgCJgL+AgcDJgIHA+kBKALdAvUCKAL1AicC6gEGA/4C6gH+AiYCKgINA/ICKgLyAikC3AEEAxUD3AEVA/0B2gHtAuwC2gHsAt8BGwIRAxADGwIQAzACEQLvAu4CEQLuAg8CKQLyAvECKQLxAgwCLAL0AvMCLALzAisCKwLzAg0DKwINAyoCLQIOA/cCLQL3AhACJwL1AvQCJwL0AiwCLwL5AvgCLwL4Ai4CLgL4Ag4DLgIOAy0C2AEPA/kC2AH5Ai8CNAIAA/8CNAL/AjMCMAIQA/oCMAL6AiECMQL8AhIDMQISAyUC6wHkAgYD6wEGA+oBGQITA/wCGQL8AjECMgIUA/0CMgL9AiMC6AHjAhQD6AEUAzICFwIBAwADFwIAAzQCJALhAvsCJAL7AuIBOAUcAh0C1gEyBTYF1gE2BTUC4wE3BTYCCwL2At0CCwLdAigCMwL/AuQCMwLkAusBBgLaAtkCBgLZAvwB/AHZAgoDLgUtBfIBLgXyAe8BNgI3BTgFNgI4BeAB8QEmBSUF8QElBfAB/gHUAtUC/gHVAt0BCQAHAJQBlAGVAZYBlgGXAQsACwCTAQoAnwHTAZsBCwAKAJ8BlAGWAQsACAAJAJQB1QEIAJQBlAELAJ8BnwGbAZoBmgGdAZ4BmgGeAZwB1AHVAZQBmQHUAZQBnwGaAZwBnwGcAQUAmQGUAZ8BmAGZAZ8BnwEFAAYAnwEGAJgBnQHJArgCnQG4Ap4B1AHCAr0C1AG9AtUBngG4As0CngHNApwBmAHIArwCmAG8ApkBnwHOAswCnwHMAtMBmwHLAsoCmwHKApoB0wHMAssC0wHLApsBlgHFArsClgG7ApcBlAHHAroCmgHKAskCmgHJAp0BlAG6AsYClAHGApUBBwC/Ar4ClQHGAsUClQHFApYBCwDEAs4CCwDOApMBzgKfAQoABQC5AsMCBQDDAgYACADBAsACCADAAgkA1QG9AsEC1QHBAggAlwG7AsQClwHEAgsACQDAAr8CCQC/AgcAnAHNArkCnAG5AgUABwC+AscCBwDHApQBmQG8AsICmQHCAtQBBgDDAsgCBgDIApgBiQKKAosCiQKLAowCjgKNAogCjgKIAo8CVAM+A6sBVAOrAaIBUwJaAoICUwKCAksCeQJUAlMCdwJ4AnkCYQJiAncCOQJeAmECSAI6AjkCdgJJAkgCWAKGAnYCgwJZAlgCbQKKAoMCawJtAoMCgwJYAnYCdgJIAjkCOQJhAncCdwJ5AlMCUwJLAkoCUwJKAjwCOQJ3AlMCgwJ2AjkCagJrAoMCaQJqAoMCOQJTAjwCOQI8AjsCaAJpAoMCZwJoAoMCOQI7AnUCOQJ1AlICZgJnAoMCZAJmAoMCOQJSAlECOQJRAoECZAKDAjkCZQJkAjkCOQKBAkUCRAJlAjkCRQJEAjkCOgI0AzUDOgI1AzkCPAJnBVEFPAJRBTsCPgJFBVgFPgJYBT0CPwJXBUUFPwJFBT4CQAJEBVcFQAJXBT8CQQJcBV0FQQJdBTgCQwJHBVsFQwJbBUICRQJhBWMFRQJjBUQCRwIxAx0DRwIdA0YCSQIWAzMDSQIzA0gCSwJmBVAFSwJQBUoCTQJUBVUFTQJVBUwCTAJVBVYFTAJWBU4CTwJCBVQFTwJUBU0CUAJaBUcFUAJHBUMCUgJTBWUFUgJlBVECVAIqAzADVAIwA1MCPQJYBVkFPQJZBVUCVgJMBVwFVgJcBUECVQJZBUYFVQJGBVcCVwJGBVoFVwJaBVACWQItAycDWQInA1gCWwJgBU8FWwJPBVoCXAJOBWAFXAJgBVsCUwIwAxwDUwIcA10COQI1AxcDOQIXA14CYAIlAysDYAIrA18CXgIXAy8DXgIvA2ECYQIvAxgDYQIYA2ICNwJeBU0FNwJNBWMCZQJoBTkFZQI5BWQCZAI5BToFZAI6BWYCZgI6BTsFZgI7BWcCZwI7BTwFZwI8BWgCaAI8BT0FaAI9BWkCaQI9BT4FaQI+BWoCagI+BT8FagI/BWsCbQJABUEFbQJBBWwCbAJBBUIFbAJCBU8CbwImAy4DbwIuA24CcAJDBUQFcAJEBUACcgJIBUkFcgJJBXECcQJJBUoFcQJKBXMCcwJKBUsFcwJLBXQCdAJLBUwFdAJMBVYCOwJRBVIFOwJSBXUCdQJSBVMFdQJTBVICdgIpAxYDdgIWA0kCYgIYAxkDYgIZA3cCdwIZAxoDdwIaA3gCeAIaAxsDeAIbA3kCRgIdAx4DRgIeA3oCegIeAx8DegIfA3sCewIfAyADewIgA3wCfAIgAyEDfAIhA30CfQIhAyIDfQIiA34CgAIjAyQDgAIkA38CfwIkAyUDfwIlA2ACRAJjBWgFRAJoBWUCUQJlBWQFUQJkBYECWgJPBWIFWgJiBYICgQJkBWEFgQJhBUUCgwIsAy0DgwItA1kCSAIzAzQDSAI0AzoCggJiBWYFggJmBUsChAIyAyMDhAIjA4ACSgJQBWcFSgJnBTwCXwIrAyYDXwImA28CXQIcAzEDXQIxA0cCYwJNBV8FYwJfBYUChgIoAykDhgIpA3YChQJfBU4FhQJOBVwCfgIiAzIDfgIyA4QCbgIuAzwDbgI8A4cCQgJbBUgFQgJIBXICTgJWBUMFTgJDBXACGwMqA1QCGwNUAnkCWAInAygDWAIoA4YChwI8A4gCiQI3AywDiQIsA4oCiwI2AzgDiwI4A4wCjAI4AzcDjAI3A4kCigIsA4MCawI/BUAFawJABW0COQM7A40COQONAo4COgM5A44COgOOAo8CeARfBJACeASQAp4CPAM6A48CPAOPAogCOwM2A4sCOwOLAo0CiwKKAm0CiwJtAmwCiAKNAosCQAI/AogCcAJAAogCiwJsAk8CiwJPAk0CcAKIAosCTgJwAosCiwJNAkwCTAJOAosCWwJaAlMCUwJdAkcCRwJGAnoCegJ7AnwCfAJ9An4CfgKEAoACgAJ/AmACYAJfAm8CbwJuAocChwKIAj8ChwI/Aj4CYAJvAocCfgKAAmACegJ8An4CUwJHAnoCXAJbAlMChQJcAlMCUwJ6An4CfgJgAocChwI+Aj0ChwI9AlUChQJTAn4CYwKFAn4ChwJVAlcChwJXAlACNwJjAn4COAI3An4ChwJQAkMChwJDAkICQQI4An4CVgJBAn4CfgKHAkICfgJCAnICdAJWAn4CcwJ0An4CfgJyAnECfgJxAnMCrgKNBFkEWQSiArcCWQS3Aq4CkAJfBF4EawRQBJECkgJcBHMEkwJOBGkElAJbBHEElAJxBJUCkQJQBE8EZARNBJYCZASWApkClwJiBGEElwJhBJgClgJNBGMEYwRiBJcCYwSXApYCmQJlBGQEZgRlBJkCZwRmBJkCZwSZApoCmgJoBGcEaQRoBJoCaQSaApMCdARcBJICdASSApsCTwRqBJMCTwSTApECagROBJMCXQR1BJsCXQSbApwCXgR3BJwCXgScApACnAJ2BF0EcwRyBJ0CcwSdApICmwJ1BHQEdwR2BJwCngJ5BHgEegR5BJ4CnwJ7BHoEnwJ6BJ4CmAJ8BHsEmAJ7BJ8CUQRtBKACnQJyBFsEnQJbBJQCpAJVBFQEAQCgAqQCVAQBAKQCmAJhBGAEAABuBFEEAABRBKAC+gH7ARUDVwRWBKQCWgRwBKECWgShApUCbARrBJECbASRAqACpAJvBFcEoQKiAlkEWQRYBKMCWQSjAqECowJYBG8EowJvBKQClQJxBFoEgASBBAIAgAQCAKYCoAJtBGwEmAJgBHwEVgRVBKQChAShBKYCqASnBKUCpgSlBKcCrwSuBKgCrwSoAqkCqQSoBKUCqQSlAqwCpwSmBKcCpwSnAqUClQSUBK0ClQStAqsCsASvBKkCrgStBLECrgSxAqgCpAR+BKoCpASqAqcChwSIBAMAhwQDALQCAwCcBJsEAwCbBLQClwSWBKsClwSrArQCmQSYBLQCpQSkBKcCqgSpBKwClASLBK0ChgSHBLQCjASNBK4CjASuArMCrQKLBH0ErQJ9BLACfgR/BK8CfgSvAqoCfQSOBLACrQSsBLECAgCjBIMEAgCDBKYCsAKOBI8EqwKWBJUEjwSQBLICjwSyArACsgKQBJEEkgSTBLMCkwSMBLMCkQSSBLMCkQSzArICfwSABKYCfwSmAq8CrASrBKwCrASsArECqwSqBKwCmASXBLQCBACaBJkEBACZBLQCtQKeBJ0EtQKdBLQCtgKFBJ4EtgKeBLUCnwSFBLYCnwS2AqYCoASfBKYCogSEBKYCnQSGBLQCgwSiBKYCmwSKBAQAmwQEALQCoQSgBKYCogJwBLAEsASpArcCsAS3AqICiAOHA1wBiANcAV4BcASiAqECAQBUBFMEAABSBG4EBACKBJoEAwCJBJwEAwCIBIkEAgCCBKMEAgCBBIIEoAKRApMCkwKaApkCmQKWApcClwKYAqMCowKkAqACoAKTApkCmQKXAqMCmQKjAqACrwKmArYCtgK3AqkCqQKoArECsQKsAqUCpQKnAqoCqgKvArYCtgKpArECsQKlAqoCtgKxAqoCtgK1ArQCtAKrAq0CrQKwArICsgKzAq4CrgK3ArYCtgK0Aq0CrQKyAq4CrQKuArYCnwKeApACkAKcApsCmwKSAp0ClAKVAqECmwKdApQCnwKQApsCowKYAp8ClAKhAqMCnwKbApQClAKjAp8CkwHOAgoA2QEIAw8D2QEPA9gBMwUyBdYBMwXWAdcB");

// ../core3d/modules/watermark/index.ts
var _WatermarkModule = class {
  kind = "watermark";
  uniforms = {
    modelClipMatrix: "mat4",
    color: "vec4"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new WatermarkModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return glUBOProxy(this.uniforms);
  }
  async createResources(context, uniformsProxy) {
    const bin = context.resourceBin("Watermark");
    const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
    const { vertices, indices } = _WatermarkModule.geometry();
    const vb = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vertices });
    const ib = bin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices });
    const vao = bin.createVertexArray({
      attributes: [
        { kind: "FLOAT_VEC3", buffer: vb, byteStride: 12, byteOffset: 0 }
        // position
      ],
      indices: ib
    });
    bin.subordinate(vao, vb, ib);
    const program = await context.makeProgramAsync(bin, { vertexShader: shader_default9, fragmentShader: shader_default10, uniformBufferBlocks: ["Watermark"] });
    return { bin, uniforms, vao, program };
  }
  // Logo data are comes from the binary buffer of an gltf file. It has positions and triangle indices only. Z-coordinate is used for antialiasing. Mesh has been tesselated such that each triangle lies in a single antialiasing slope, i.e. has vertices along one edge only.
  static geometry() {
    const vertices = new Float32Array(logo_default.buffer, 0, _WatermarkModule.vertexBufferBytes / 4).slice();
    const indices = new Uint16Array(logo_default.buffer, _WatermarkModule.vertexBufferBytes, _WatermarkModule.numIndices).slice();
    return { vertices, indices };
  }
};
var WatermarkModule = _WatermarkModule;
// these magic numbers are the byte offsets and lengths from gltf bufferViews
__publicField(WatermarkModule, "vertexBufferBytes", 16620);
__publicField(WatermarkModule, "indexBufferBytes", 12276);
__publicField(WatermarkModule, "numIndices", _WatermarkModule.indexBufferBytes / 2);
var WatermarkModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
  }
  update(state) {
    const { context, resources } = this;
    const { output } = state;
    6;
    if (context.hasStateChanged({ output })) {
      const { values } = this.uniforms;
      const padding = 1;
      const size = 0.2;
      const { width, height } = output;
      const w = 12.717909812927246 - 42313020094297826e-20;
      const h = 0.0024876839015632868 + 1.87906813621521;
      const e = 0.1;
      const d = Math.hypot(w, h);
      const diag = Math.hypot(width, height) * size;
      const sx = 2 * diag / d / width;
      const sy = 2 * diag / d / height;
      const sz = diag / d * e * 0.5 / h;
      const m = [
        sx,
        0,
        0,
        0,
        0,
        sy,
        0,
        0,
        0,
        0,
        sz,
        0,
        1 - padding * sx,
        -1 + padding * sy,
        sz * 0.5,
        1
      ];
      values.modelClipMatrix = m;
      values.color = [43 / 255, 46 / 255, 52 / 255, 0.5];
      context.updateUniformBuffer(resources.uniforms, this.uniforms);
    }
  }
  render() {
    const { context, resources, module } = this;
    const { program, uniforms, vao } = resources;
    const { gl } = context;
    glState(gl, {
      program,
      uniformBuffers: [uniforms],
      depth: { writeMask: false },
      cull: { enable: true },
      vertexArrayObject: vao,
      blend: {
        enable: true,
        srcRGB: "SRC_ALPHA",
        srcAlpha: "ONE",
        dstRGB: "ONE",
        dstAlpha: "ONE"
      }
    });
    const stats = glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: WatermarkModule.numIndices });
    context["addRenderStatistics"](stats);
  }
  contextLost() {
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};

// ../core3d/modules/dynamic/shader.vert
var shader_default11 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\nlayout(std140) uniform Material {\n    MaterialUniforms material;\n};\n\nlayout(std140) uniform Object {\n    ObjectUniforms object;\n};\n\nuniform DynamicTextures textures;\n\nout DynamicVaryings varyings;\nflat out DynamicVaryingsFlat varyingsFlat;\n\nlayout(location = 0) in vec4 vertexPosition;\nlayout(location = 1) in vec3 vertexNormal;\nlayout(location = 2) in vec4 vertexTangent;\nlayout(location = 3) in vec4 vertexColor0;\nlayout(location = 4) in vec2 vertexTexCoord0;\nlayout(location = 5) in vec2 vertexTexCoord1;\nlayout(location = 6) in mat4x3 vertexInstanceMatrix;\n\nvoid main() {\n    mat4 instanceMatrix = mat4(vertexInstanceMatrix);\n    mat3 instanceMatrixNormal = mat3(instanceMatrix); // TODO: normalize?\n    vec4 posVS = camera.localViewMatrix * instanceMatrix * vertexPosition;\n    gl_Position = camera.viewClipMatrix * posVS;\n    vec3 normalLS = instanceMatrixNormal * vertexNormal;\n    vec3 tangentLS = instanceMatrixNormal * vertexTangent.xyz;\n    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;\n    vec3 vertexPosLS = (instanceMatrix * vertexPosition).xyz;\n    vec3 bitangentLS = cross(normalLS, tangentLS.xyz) * vertexTangent.w;\n    varyings.tbn = mat3(tangentLS, bitangentLS, normalLS);\n\n    varyings.positionVS = posVS.xyz;\n    varyings.toCamera = cameraPosLS - vertexPosLS;\n    varyings.texCoord0 = vertexTexCoord0;\n    varyings.texCoord1 = vertexTexCoord1;\n    varyings.color0 = vertexColor0;\n    varyings.linearDepth = -posVS.z;\n    varyingsFlat.objectId = object.baseObjectId != 0xffffU ? object.baseObjectId + uint(gl_InstanceID) : object.baseObjectId;\n}\n";

// ../core3d/modules/dynamic/shader.frag
var shader_default12 = `layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Material {
    MaterialUniforms material;
};

layout(std140) uniform Object {
    ObjectUniforms object;
};

uniform DynamicTextures textures;

in DynamicVaryings varyings;
flat in DynamicVaryingsFlat varyingsFlat;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out uvec4 fragPick;

float clampedDot(vec3 x, vec3 y) {
    return clamp(dot(x, y), 0.0, 1.0);
}

struct NormalInfo {
    vec3 ng;   // Geometric normal
    vec3 n;    // Pertubed normal
    vec3 t;    // Pertubed tangent
    vec3 b;    // Pertubed bitangent
};

// Get normal, tangent and bitangent vectors.
NormalInfo getNormalInfo(vec3 v) {
    vec2 UV = material.normalUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
    vec3 uv_dx = dFdx(vec3(UV, 0));
    vec3 uv_dy = dFdy(vec3(UV, 0));

    if(length(uv_dx) + length(uv_dy) <= 1e-6) {
        uv_dx = vec3(1.0, 0.0, 0.0);
        uv_dy = vec3(0.0, 1.0, 0.0);
    }

    vec3 t_ = (uv_dy.t * dFdx(v) - uv_dx.t * dFdy(v)) / (uv_dx.s * uv_dy.t - uv_dy.s * uv_dx.t);

    vec3 n, t, b, ng;

    vec3 axisX = dFdx(varyings.positionVS);
    vec3 axisY = dFdy(varyings.positionVS);
    vec3 geometricNormalVS = normalize(cross(axisX, axisY));

    vec3 nrm = varyings.tbn[2];
    if(dot(nrm, nrm) < 0.5)
        nrm = camera.viewLocalMatrixNormal * geometricNormalVS;
    ng = normalize(nrm);
    // ng = normalize(varyings.tbn[2]);
    t = normalize(t_ - ng * dot(ng, t_));
    b = cross(ng, t);

    // // Normalize eigenvectors as matrix is linearly interpolated.
    // t = normalize(varyings.tbn[0]);
    // b = normalize(vTvaryings.tbnBN[1]);
    // ng = normalize(varyings.tbn[2]);

    // For a back-facing surface, the tangential basis vectors are negated.
    float facing = step(0., dot(v, ng)) * 2. - 1.;
    t *= facing;
    b *= facing;
    ng *= facing;

    // Compute pertubed normals:
    if(material.normalUVSet >= 0) {
        n = texture(textures.normal, UV).rgb * 2. - vec3(1.);
        n *= vec3(material.normalScale, material.normalScale, 1.);
        n = mat3(t, b, ng) * normalize(n);
    } else {
        n = ng;
    }

    NormalInfo info;
    info.ng = ng;
    info.t = t;
    info.b = b;
    info.n = n;
    return info;
}

struct MaterialInfo {
    float perceptualRoughness;      // roughness value, as authored by the model creator (input to shader)
    vec3 f0;                        // full reflectance color (n incidence angle)

    float alphaRoughness;           // roughness mapped to a more linear change in the roughness (proposed by [2])
    vec3 albedoColor;

    vec3 f90;                       // reflectance color at grazing angle
    float metallic;

    vec3 n;
    vec3 baseColor; // getBaseColor()
};

MaterialInfo getMetallicRoughnessInfo(MaterialInfo info, float f0_ior) {
    info.metallic = material.metallicFactor;
    info.perceptualRoughness = material.roughnessFactor;

    if(material.metallicRoughnessUVSet >= 0) {
        vec2 uv = material.metallicRoughnessUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
        // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
        // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
        vec4 mrSample = texture(textures.metallic_roughness, uv);
        info.perceptualRoughness *= mrSample.g;
        info.metallic *= mrSample.b;
    }

    // Achromatic f0 based on IOR.
    vec3 f0 = vec3(f0_ior);

    info.albedoColor = mix(info.baseColor.rgb * (vec3(1.0) - f0), vec3(0), info.metallic);
    info.f0 = mix(f0, info.baseColor.rgb, info.metallic);

    return info;
}

vec3 getIBLRadianceGGX(vec3 n, vec3 v, float perceptualRoughness, vec3 specularColor) {
    float NdotV = clampedDot(n, v);
    vec3 reflection = normalize(reflect(-v, n));
    vec2 brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
    vec2 brdf = texture(textures.lut_ggx, brdfSamplePoint).rg;
    float lod = clamp(perceptualRoughness * float(material.radianceMipCount), 0.0, float(material.radianceMipCount));
    vec4 specularSample = textureLod(textures.ibl.specular, reflection, lod);
    vec3 specularLight = specularSample.rgb;
    return specularLight * (specularColor * brdf.x + brdf.y);
}

vec3 getIBLRadianceLambertian(vec3 n, vec3 diffuseColor) {
    vec3 diffuseLight = texture(textures.ibl.diffuse, n).rgb;
    return diffuseLight * diffuseColor;
}

void main() {
    vec4 baseColor = material.baseColorFactor * varyings.color0;

    if(material.baseColorUVSet >= 0) {
        vec2 uv = material.baseColorUVSet < 1 ? varyings.texCoord0 : varyings.texCoord1;
        vec4 bc = texture(textures.base_color, uv);
        baseColor *= vec4(sRGBToLinear(bc.rgb), bc.a);
    }
    if(baseColor.a < material.alphaCutoff)
        discard;

    vec3 v = normalize(varyings.toCamera);
    NormalInfo normalInfo = getNormalInfo(v);
    vec3 n = normalInfo.n;
    vec3 normal = normalInfo.n;
    // vec3 l = normalize(uSunDir);   // Direction from surface point to light
    // vec3 h = normalize(l + v);     // Direction of the vector between l and v, called halfway vector

    vec4 outColor;

#if defined(PBR_METALLIC_ROUGHNESS)

    MaterialInfo materialInfo;
    materialInfo.baseColor = baseColor.rgb;

    // The default index of refraction of 1.5 yields a dielectric normal incidence reflectance of 0.04.
    float ior = 1.5;
    float f0_ior = 0.04;

    materialInfo = getMetallicRoughnessInfo(materialInfo, f0_ior);

    materialInfo.perceptualRoughness = clamp(materialInfo.perceptualRoughness, 0.0, 1.0);
    materialInfo.metallic = clamp(materialInfo.metallic, 0.0, 1.0);

    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness.
    materialInfo.alphaRoughness = materialInfo.perceptualRoughness * materialInfo.perceptualRoughness;

    // Compute reflectance.
    float reflectance = max(max(materialInfo.f0.r, materialInfo.f0.g), materialInfo.f0.b);

    // Anything less than 2% is physically impossible and is instead considered to be shadowing. Compare to "Real-Time-Rendering" 4th editon on page 325.
    materialInfo.f90 = vec3(clamp(reflectance * 50.0, 0.0, 1.0));

    materialInfo.n = n;

    // LIGHTING
    vec3 f_specular = vec3(0.0);
    vec3 f_diffuse = vec3(0.0);
    vec3 f_emissive = vec3(0.0);

    f_specular += getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0);
    f_diffuse += getIBLRadianceLambertian(n, materialInfo.albedoColor);

    // float NdotL = clampedDot(n, l);
    // float NdotV = clampedDot(n, v);
    // float NdotH = clampedDot(n, h);
    // float LdotH = clampedDot(l, h);
    // float VdotH = clampedDot(v, h);

    // vec3 intensity = vec3(uSunBrightness);

    // if(NdotL > 0.0 || NdotV > 0.0) {
    //     // Calculation of analytical light
    //     //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#acknowledgments AppendixB
    //     f_specular += intensity * NdotL * BRDF_specularGGX(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, VdotH, NdotL, NdotV, NdotH);
    //     f_diffuse += intensity * NdotL * BRDF_lambertian(materialInfo.f0, materialInfo.f90, materialInfo.albedoColor, VdotH);
    // }

    f_emissive = material.emissiveFactor;
    if(material.emissiveUVSet >= 0) {
        vec2 uv = material.emissiveUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
        f_emissive *= sRGBToLinear(texture(textures.emissive, uv).rgb);
    }

    vec3 color = (f_emissive + f_diffuse + f_specular) + ambientLight * materialInfo.albedoColor;

    // Apply optional PBR terms for additional (optional) shading
    if(material.occlusionUVSet >= 0) {
        vec2 uv = material.occlusionUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
        float ao = texture(textures.occlusion, uv).r;
        color = mix(color, color * ao, material.occlusionStrength);
    }

    outColor.rgb = materialInfo.albedoColor;
    outColor.a = baseColor.a;

#else

    outColor = baseColor;

#endif

    fragColor = outColor;
    // only write to pick buffers for opaque triangles (for devices without OES_draw_buffers_indexed support)
    if(outColor.a >= 0.99) {
        fragPick = uvec4(varyingsFlat.objectId, packNormal(normal), floatBitsToUint(varyings.linearDepth));
    }
}
`;

// ../core3d/modules/dynamic/index.ts
var DynamicModule = class {
  kind = "dynamic";
  materialUniforms = {
    baseColor: "vec4"
  };
  instanceUniforms = {
    modelViewMatrix: "mat4"
  };
  async withContext(context) {
    const resources = await this.createResources(context);
    return new DynamicModuleContext(context, this, resources);
  }
  async createResources(context) {
    const bin = context.resourceBin("Dynamic");
    const defaultSampler = bin.createSampler({ magnificationFilter: "LINEAR", minificationFilter: "LINEAR_MIPMAP_LINEAR", wrap: ["REPEAT", "REPEAT"] });
    const defaultTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array(4) });
    const uniformBufferBlocks = ["Camera", "Material", "Object"];
    const textureNames = ["lut_ggx", "ibl.diffuse", "ibl.specular", "base_color", "metallic_roughness", "normal", "emissive", "occlusion"];
    const textureUniforms = textureNames.map((name) => `textures.${name}`);
    const [unlit, ggx] = await Promise.all([
      context.makeProgramAsync(bin, { vertexShader: shader_default11, fragmentShader: shader_default12, uniformBufferBlocks, textureUniforms }),
      context.makeProgramAsync(bin, { vertexShader: shader_default11, fragmentShader: shader_default12, uniformBufferBlocks, textureUniforms, header: { flags: ["PBR_METALLIC_ROUGHNESS"] } })
    ]);
    const programs = { unlit, ggx };
    return { bin, defaultSampler, defaultTexture, programs };
  }
};
var DynamicModuleContext = class {
  constructor(context, module, resources) {
    this.context = context;
    this.module = module;
    this.resources = resources;
    this.iblTextures = context.iblTextures;
  }
  iblTextures;
  buffers = /* @__PURE__ */ new Map();
  geometries = /* @__PURE__ */ new Map();
  objects = /* @__PURE__ */ new Map();
  materials = /* @__PURE__ */ new Map();
  images = /* @__PURE__ */ new Map();
  samplers = /* @__PURE__ */ new Map();
  update(state) {
    const { context, resources } = this;
    const { bin, defaultSampler, defaultTexture, programs } = resources;
    const { dynamic, localSpaceTranslation } = state;
    if (context.hasStateChanged({ dynamic })) {
      function* getTextures(material) {
        const { baseColorTexture } = material;
        if (baseColorTexture)
          yield baseColorTexture.texture;
        if (material.kind == "ggx") {
          const { emissiveTexture, metallicRoughnessTexture, normalTexture, occlusionTexture } = material;
          if (emissiveTexture)
            yield emissiveTexture.texture;
          if (metallicRoughnessTexture)
            yield metallicRoughnessTexture.texture;
          if (normalTexture)
            yield normalTexture.texture;
          if (occlusionTexture)
            yield occlusionTexture.texture;
        }
      }
      const primitives = [...new Set(dynamic.objects.flatMap((o) => o.mesh.primitives))];
      const geometries = [...new Set(primitives.map((p) => p.geometry))];
      const materials = [...new Set(primitives.map((p) => p.material))];
      const textures = [...new Set(materials.flatMap((m) => [...getTextures(m)]))];
      const images = [...new Set(textures.map((t) => t.image))];
      const samplers = [...new Set(textures.map((t) => t.sampler).filter((s) => s))];
      const objects = [...new Set(dynamic.objects.map((o) => o))];
      const vertexBuffers = new Set(geometries.flatMap((g) => [...Object.values(g.attributes).map((a) => a.buffer).filter((b) => b)]));
      const indexBuffers = new Set(geometries.map((g) => typeof g.indices == "number" ? void 0 : g.indices).filter((b) => b));
      const numVertexBuffers = vertexBuffers.size;
      const buffers = [...vertexBuffers, ...indexBuffers];
      syncAssets(bin, buffers, this.buffers, (data, idx) => new BufferAsset(bin, idx < numVertexBuffers ? "ARRAY_BUFFER" : "ELEMENT_ARRAY_BUFFER", data));
      syncAssets(bin, images, this.images, (data) => new TextureAsset(bin, data));
      syncAssets(bin, samplers, this.samplers, (data) => new SamplerAsset(bin, data));
      syncAssets(bin, geometries, this.geometries, (data) => new GeometryAsset(bin, data, this.buffers));
      syncAssets(bin, objects, this.objects, (data) => new ObjectAsset(bin, context, data, state));
      syncAssets(bin, materials, this.materials, (data) => new MaterialAsset(bin, context, data, this.images, this.samplers, defaultTexture, defaultSampler, programs[data.kind]));
    }
    if (context.hasStateChanged({ localSpaceTranslation })) {
      for (const instance of this.objects.values()) {
        instance.update(context, state);
      }
    }
    if (context.iblTextures != this.iblTextures) {
      this.iblTextures = context.iblTextures;
      for (const material of this.materials.values()) {
        material.update(context, defaultTexture);
      }
    }
  }
  render(state) {
    const { context } = this;
    const { gl, cameraUniforms } = context;
    glState(gl, {
      uniformBuffers: [cameraUniforms],
      depth: {
        test: true,
        writeMask: true
      }
    });
    const { objects, geometries, materials } = this;
    const meshes = [];
    let numPrimitives = 0;
    state.dynamic.objects.forEach((p) => {
      numPrimitives += p.mesh.primitives.length;
    });
    if (numPrimitives != geometries.size) {
      return;
    }
    for (const obj of state.dynamic.objects) {
      const objAsset = objects.get(obj);
      for (const primitive of obj.mesh.primitives) {
        const geometry = geometries.get(primitive.geometry);
        const material = materials.get(primitive.material);
        meshes.push({ material, geometry, object: objAsset });
      }
    }
    meshes.sort((a, b) => {
      let diff = a.material.index - b.material.index;
      if (diff == 0) {
        diff = a.object.index - b.object.index;
      }
      return diff;
    });
    gl.vertexAttrib4f(3, 1, 1, 1, 1);
    let currentMaterial = void 0;
    let currentObject = void 0;
    for (const { material, object, geometry } of meshes) {
      if (currentMaterial != material) {
        currentMaterial = material;
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, material.uniformsBuffer);
        glState(gl, currentMaterial.stateParams);
      }
      if (currentObject != object) {
        currentObject = object;
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, object.uniformsBuffer);
      }
      gl.bindVertexArray(geometry.resources.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, object.instancesBuffer);
      for (let i = 0; i < 4; i++) {
        const attrib = i + 6 /* matrix0 */;
        gl.vertexAttribPointer(attrib, 3, gl.FLOAT, false, 4 * 12, i * 12);
        gl.vertexAttribDivisor(attrib, 1);
        gl.enableVertexAttribArray(attrib);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      const kind = `${geometry.drawParams.kind}_instanced`;
      const params = { ...geometry.drawParams, kind, instanceCount: object.numInstances };
      const stats = glDraw(gl, params);
      gl.bindVertexArray(null);
      context["addRenderStatistics"](stats);
    }
    for (let i = 0; i < 4; i++) {
      const attrib = i + 6 /* matrix0 */;
      gl.disableVertexAttribArray(attrib);
    }
  }
  pick(state) {
    this.render(state);
  }
  contextLost() {
  }
  dispose() {
    const { resources, buffers, geometries, materials, objects } = this;
    const { bin, programs, defaultSampler, defaultTexture } = resources;
    this.contextLost();
    const assets = [...buffers.values(), ...geometries.values(), ...materials.values(), ...objects.values()];
    for (const asset of assets) {
      asset.dispose(bin);
    }
    bin.delete(programs.unlit, programs.ggx, defaultSampler, defaultTexture);
    console.assert(bin.size == 0);
    bin.dispose();
    buffers.clear();
    geometries.clear();
    materials.clear();
    objects.clear();
  }
};
function syncAssets(bin, uniqueResources, map, create7) {
  const unreferenced = new Map(map);
  for (const resource of uniqueResources) {
    unreferenced.delete(resource);
  }
  for (const [resource, asset] of unreferenced) {
    map.delete(resource);
    asset.dispose(bin);
  }
  let idx = 0;
  for (const resource of uniqueResources) {
    let asset = map.get(resource);
    if (!asset) {
      asset = create7(resource, idx);
      map.set(resource, asset);
    }
    asset.index = idx++;
  }
}
var BufferAsset = class {
  index = 0;
  buffer;
  constructor(bin, kind, srcData) {
    this.buffer = bin.createBuffer({ kind, srcData });
  }
  dispose(bin) {
    bin.delete(this.buffer);
  }
};
var GeometryAsset = class {
  index = 0;
  drawParams;
  resources;
  constructor(bin, data, buffers) {
    const hasIndexBuffer = typeof data.indices != "number";
    const indexType = !hasIndexBuffer ? void 0 : data.indices instanceof Uint32Array ? "UNSIGNED_INT" : data.indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_BYTE";
    const mode = data.primitiveType;
    const count = hasIndexBuffer ? data.indices.length : data.indices;
    this.drawParams = { kind: hasIndexBuffer ? "elements" : "arrays", mode, count, indexType };
    const { position, normal, tangent, color0, texCoord0, texCoord1 } = data.attributes;
    function convAttr(a) {
      if (!a)
        return null;
      const { buffer } = buffers.get(a.buffer);
      return { ...a, buffer };
    }
    const indices = typeof data.indices == "number" ? void 0 : bin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: data.indices });
    const params = {
      attributes: [
        convAttr(position),
        convAttr(normal),
        convAttr(tangent),
        convAttr(color0),
        convAttr(texCoord0),
        convAttr(texCoord1)
      ],
      indices
    };
    const vao = bin.createVertexArray(params);
    if (indices) {
      bin.subordinate(vao, indices);
    }
    this.resources = { vao };
  }
  dispose(bin) {
    bin.delete(this.resources.vao);
  }
};
var ObjectAsset = class {
  constructor(bin, context, data, state) {
    this.data = data;
    const uniformsDesc = {
      worldLocalMatrix: "mat4",
      baseObjectId: "uint"
    };
    this.uniforms = glUBOProxy(uniformsDesc);
    const { values } = this.uniforms;
    values.baseObjectId = data.baseObjectId ?? 4294967295;
    this.uniformsBuffer = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
    const { instances } = data;
    this.numInstances = instances.length;
    this.instancesBuffer = ObjectAsset.createInstancesBuffer(bin, instances, state.localSpaceTranslation);
    this.update(context, state);
  }
  index = 0;
  uniforms;
  numInstances;
  uniformsBuffer;
  instancesBuffer;
  static createInstancesBuffer(bin, instances, localSpaceTranslation) {
    const srcData = ObjectAsset.computeInstanceMatrices(instances, localSpaceTranslation);
    return bin.createBuffer({ kind: "ARRAY_BUFFER", srcData });
  }
  static computeInstanceMatrices(instances, localSpaceTranslation) {
    const srcData = new Float32Array(instances.length * 12);
    for (let i = 0; i < instances.length; i++) {
      const { position, rotation } = instances[i];
      const translatedPos = vec3_exports.sub(vec3_exports.create(), position, localSpaceTranslation);
      const transform = rotation ? mat4_exports.fromRotationTranslation(mat4_exports.create(), rotation, translatedPos) : mat4_exports.fromTranslation(mat4_exports.create(), translatedPos);
      const [e00, e01, e02, e03, e10, e11, e12, e13, e20, e21, e22, e23, e30, e31, e32, e33] = transform;
      const elems4x3 = [e00, e01, e02, e10, e11, e12, e20, e21, e22, e30, e31, e32];
      srcData.set(elems4x3, i * elems4x3.length);
    }
    return srcData;
  }
  update(context, state) {
    const { uniforms, uniformsBuffer, data, instancesBuffer } = this;
    const { localSpaceTranslation } = state;
    const { values } = uniforms;
    values.worldLocalMatrix = mat4_exports.fromTranslation(mat4_exports.create(), vec3_exports.negate(vec3_exports.create(), state.localSpaceTranslation));
    if (context.hasStateChanged({ localSpaceTranslation })) {
      const srcData = ObjectAsset.computeInstanceMatrices(data.instances, localSpaceTranslation);
      glUpdateBuffer(context.gl, { kind: "ARRAY_BUFFER", srcData, targetBuffer: instancesBuffer });
    }
    context.updateUniformBuffer(uniformsBuffer, uniforms);
  }
  dispose(bin) {
    bin.delete(this.uniformsBuffer);
  }
};
var MaterialAsset = class {
  index = 0;
  kind;
  uniforms;
  stateParams;
  uniformsBuffer;
  textures = {};
  samplers = {};
  constructor(bin, context, data, textures, samplers, defaultTexture, defaultSamper, program) {
    this.kind = data.kind;
    const blend = {
      enable: true,
      srcRGB: "SRC_ALPHA",
      dstRGB: "ONE_MINUS_SRC_ALPHA",
      srcAlpha: "ZERO",
      dstAlpha: "ONE"
    };
    this.stateParams = {
      program,
      cull: { enable: data.doubleSided ? false : true },
      blend: data.alphaMode == "BLEND" ? blend : void 0
      // drawBuffers: context.drawBuffers(data.alphaMode == "BLEND" ? BufferFlags.color : BufferFlags.all), // for devices without OES_draw_buffers_indexed support
    };
    const uniformsDesc = {
      baseColorFactor: "vec4",
      emissiveFactor: "vec3",
      roughnessFactor: "float",
      metallicFactor: "float",
      normalScale: "float",
      occlusionStrength: "float",
      alphaCutoff: "float",
      baseColorUVSet: "int",
      metallicRoughnessUVSet: "int",
      normalUVSet: "int",
      occlusionUVSet: "int",
      emissiveUVSet: "int",
      radianceMipCount: "uint"
    };
    const uniformsProxy = this.uniforms = glUBOProxy(uniformsDesc);
    let tex = this.textures;
    let samp = this.samplers;
    const { values } = uniformsProxy;
    const { baseColorTexture } = data;
    values.baseColorFactor = data.baseColorFactor ?? [1, 1, 1, 1];
    values.baseColorUVSet = data.baseColorTexture ? data.baseColorTexture.texCoord ?? 0 : -1;
    values.alphaCutoff = data.alphaCutoff ?? data.alphaMode == "MASK" ? 0.5 : 0;
    values.radianceMipCount = context.iblTextures.numMipMaps;
    if (baseColorTexture) {
      tex.baseColor = textures.get(baseColorTexture.texture.image).texture;
      samp.baseColor = samplers.get(baseColorTexture.texture.sampler)?.sampler ?? defaultSamper;
    }
    if (data.kind == "ggx") {
      const { roughnessFactor, metallicFactor, emissiveFactor, emissiveTexture, normalTexture, occlusionTexture, metallicRoughnessTexture } = data;
      values.roughnessFactor = roughnessFactor ?? 1;
      values.metallicFactor = metallicFactor ?? 1;
      values.emissiveFactor = emissiveFactor ?? [0, 0, 0];
      values.metallicRoughnessUVSet = metallicRoughnessTexture ? metallicRoughnessTexture.texCoord ?? 0 : -1;
      values.normalUVSet = normalTexture ? normalTexture.texCoord ?? 0 : -1;
      values.normalScale = normalTexture?.scale ?? 1;
      values.occlusionUVSet = occlusionTexture ? occlusionTexture.texCoord ?? 0 : -1;
      values.occlusionStrength = occlusionTexture?.strength ?? 1;
      values.emissiveUVSet = emissiveTexture ? emissiveTexture.texCoord ?? 0 : -1;
      if (emissiveTexture) {
        tex.emissive = textures.get(emissiveTexture.texture.image).texture;
        samp.emissive = samplers.get(emissiveTexture.texture.sampler)?.sampler ?? defaultSamper;
      }
      if (normalTexture) {
        tex.normal = textures.get(normalTexture.texture.image).texture;
        samp.normal = samplers.get(normalTexture.texture.sampler)?.sampler ?? defaultSamper;
      }
      if (occlusionTexture) {
        tex.occlusion = textures.get(occlusionTexture.texture.image).texture;
        samp.occlusion = samplers.get(occlusionTexture.texture.sampler)?.sampler ?? defaultSamper;
      }
      if (metallicRoughnessTexture) {
        tex.metallicRoughness = textures.get(metallicRoughnessTexture.texture.image).texture;
        samp.metallicRoughness = samplers.get(metallicRoughnessTexture.texture.sampler)?.sampler ?? defaultSamper;
      }
    } else {
      values.roughnessFactor = 1;
      values.metallicFactor = 1;
      values.emissiveFactor = [0, 0, 0];
      values.metallicRoughnessUVSet = -1;
      values.normalUVSet = -1;
      values.normalScale = 0;
      values.occlusionUVSet = -1;
      values.occlusionStrength = 0;
      values.emissiveUVSet = -1;
    }
    this.uniformsBuffer = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
    this.update(context, defaultTexture);
  }
  update(context, defaultTexture) {
    const { iblTextures, lut_ggx, samplerSingle, samplerMip } = context;
    const { uniforms, uniformsBuffer, textures, samplers } = this;
    const { diffuse, specular, numMipMaps } = iblTextures;
    const mutableState = this.stateParams;
    mutableState.textures = [
      { kind: "TEXTURE_2D", texture: lut_ggx, sampler: samplerSingle },
      { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerSingle },
      { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip },
      { kind: "TEXTURE_2D", texture: textures.baseColor ?? defaultTexture, sampler: samplers.baseColor ?? null },
      { kind: "TEXTURE_2D", texture: textures.metallicRoughness ?? defaultTexture, sampler: samplers.metallicRoughness ?? null },
      { kind: "TEXTURE_2D", texture: textures.normal ?? defaultTexture, sampler: samplers.normal ?? null },
      { kind: "TEXTURE_2D", texture: textures.emissive ?? defaultTexture, sampler: samplers.emissive ?? null },
      { kind: "TEXTURE_2D", texture: textures.occlusion ?? defaultTexture, sampler: samplers.occlusion ?? null }
    ];
    uniforms.values.radianceMipCount = numMipMaps;
    context.updateUniformBuffer(uniformsBuffer, uniforms);
  }
  dispose(bin) {
    bin.delete(this.uniformsBuffer);
  }
};
var TextureAsset = class {
  index = 0;
  texture;
  constructor(bin, image) {
    this.texture = bin.createTexture(image.params);
  }
  dispose(bin) {
    bin.delete(this.texture);
  }
};
var SamplerAsset = class {
  index = 0;
  sampler;
  constructor(bin, sampler) {
    this.sampler = bin.createSampler(sampler);
  }
  dispose(bin) {
    bin.delete(this.sampler);
  }
};

// ../core3d/modules/toon_outline/shader.vert
var shader_default13 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\n// layout(std140) uniform ToonOutline {\n//     ToonOutlineUniforms toonOutline;\n// };\n\nout vec2 uv;\n\nvoid main() {\n    uv = vec2(gl_VertexID % 2, gl_VertexID / 2);\n    gl_Position = vec4(uv * 2.0 - 1.0, 0, 1);\n}\n";

// ../core3d/modules/toon_outline/shader.frag
var shader_default14 = "layout(std140) uniform Camera {\n    CameraUniforms camera;\n};\n\n// layout(std140) uniform ToonOutline {\n//     ToonOutlineUniforms toonOutline;\n// };\n\nuniform TonemappingTextures textures;\n\nin vec2 uv;\nlayout(location = 0) out vec4 fragColor;\n\n    const float horizontalSobel[25] = float[](\n        1., 1., 2., 1., 1.,\n        2., 2.,4.,2.,2.,\n        0., 0., 0., 0., 0.,\n        -2., -2., -4., -2., -2.,\n        - 1., -1., -2., -1., -1.);\n\n    const float verticalSobel[25] = float[](\n        1., 2.,  0., -2., -1.,\n        1., 2.,  0., -2., -1.,\n        2., 4.,  0., -4., -2.,\n        1., 2.,  0., -2., -1.,\n        1., 2.,  0., -2., -1.);\n\n\nbool objectTest(uint objectId, vec2 bl, vec2 tr, vec2 br, vec2 tl) {\n    uint obj0 = texture(textures.pick, bl).x;\n    if (obj0 != objectId) {\n        return true;\n    }\n    uint obj1 = texture(textures.pick, tr).x;\n    if(obj1 != objectId) {\n        return true;\n    }\n    uint obj2 = texture(textures.pick, br).x;\n    if(obj2 != objectId) {\n        return true;\n    }\n    uint obj3 = texture(textures.pick, tl).x;\n    if(obj3 != objectId) {\n        return true;\n    }\n    return false;\n}\n\n    float getPixelOffset(int index, float pixelSize) {\n        switch (index) {\n            case 0:\n            return -pixelSize * 2.;\n            case 1: \n            return -pixelSize;\n            case 2:\n            return 0.;\n            case 3:\n            return pixelSize;\n            case 4: \n            return pixelSize * 2.;\n        }\n        return 0.;\n    }\n\n    vec2 getUvCoord(int i, int j, vec2 uv, float pixelSizeX, float pixelSizeY) {\n        return uv + vec2(getPixelOffset(i, pixelSizeX), getPixelOffset(j, pixelSizeY));\n    }\n\nfloat depthTest2(float centerDepth, vec2 uv, float pixelSizeX, float pixelSizeY) {\n    const float threshold = 0.02;\n    float horizontal = 0.;\n    float vertical = 0.;\n    for(int i = 0; i < 5; ++i) {\n        for(int j = 0; j < 5; ++j) {\n            int idx = i * 5 + j;\n            if(idx == 12) {\n                continue;\n            }\n            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);\n            if(uvCoord.x < 0. || uvCoord.y < 0.) {\n                return 0.;\n            }\n            float sobelFactorH = horizontalSobel[idx];\n            float sobelFactorV = verticalSobel[idx];\n            float val = abs(centerDepth - uintBitsToFloat(texture(textures.pick, uvCoord).w)) / centerDepth > threshold ? 1. : 0.;\n            horizontal += sobelFactorH * val;\n            vertical += sobelFactorV * val;\n        }\n    }\n    return sqrt(pow(horizontal, 2.) + pow(vertical, 2.)) / 35.;\n}\n\n\nfloat normalTest2(vec3 centerNormal, vec2 uv, float pixelSizeX, float pixelSizeY) {\n\n    const float threshold = 0.05;\n    //     float f0 = 1.;\n    // float f1 = 1.;\n    // float horizontalSobel[25] = float[](f0, f0, f0 * 2., f0, f0, f1, f1, f1 * 2., f1, f1, 0., 0., 0., 0., 0., -f1, -f1, -f1 * 2., -f1, -f1, -f0, -f0, -f0 * 2., -f0, -f0);\n\n    // float verticalSobel[25] = float[](f0, f1, 0., -f0, -f1, f0, f1, 0., -f0, -f1, f0 * 2., f1 * 2., 0., -f0 * 2., -f1 * 2., f0, f1, 0., -f0, -f1, f0, f1, 0., -f0, -f0);\n\n    float horizontal = 0.;\n    float vertical = 0.;\n    for(int i = 0; i < 5; ++i) {\n        for(int j = 0; j < 5; ++j) {\n            int idx = i * 5 + j;\n            if(idx == 12) {\n                continue;\n            }\n            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);\n            if (uvCoord.x < 0. || uvCoord.y < 0.) {\n                return 0.;\n            }\n            float sobelFactorH = horizontalSobel[idx];\n            float sobelFactorV = verticalSobel[idx];\n            float val = dot(centerNormal, unpackNormalAndDeviation(texture(textures.pick, uvCoord).yz).xyz) < threshold ? 1. : 0.;\n            horizontal += sobelFactorH * val;\n            vertical += sobelFactorV * val;\n        }\n    }\n\n    return sqrt(pow(horizontal, 2.) + pow(vertical, 2.)) / 25.;\n}\n\n\nvoid main() {\n    float pixelSizeX = 1.f / camera.viewSize.x;\n    float pixelSizeY = 1.f / camera.viewSize.y;\n\n    //uint objectId = texture(textures.pick, uv).x;\n    float centerDepth = uintBitsToFloat(texture(textures.pick, uv).w);\n    vec3 centerNormal = unpackNormalAndDeviation(texture(textures.pick, uv).yz).xyz;\n\n    float normalEdge = 0.;\n    float depthEdge = depthTest2(centerDepth, uv, pixelSizeX , pixelSizeY);\n     if(depthEdge < 0.8) {\n         normalEdge = normalTest2(centerNormal, uv, pixelSizeX, pixelSizeY);\n    }\n    float edge = min(0.8, max(depthEdge, normalEdge));\n\n    if ( edge < 0.3) {\n        discard;\n    }\n    fragColor = vec4(0,0,0, 1) * edge;\n    //fragColor = vec4(toonOutline.color, 1) * edge;\n}\n";

// ../core3d/modules/toon_outline/index.ts
var ToonModule = class {
  kind = "toon_outline";
  uniforms = {
    color: "vec3"
  };
  async withContext(context) {
    const uniforms = this.createUniforms();
    const resources = await this.createResources(context, uniforms);
    return new ToonModuleContext(context, this, uniforms, resources);
  }
  createUniforms() {
    return glUBOProxy(this.uniforms);
  }
  async createResources(context, uniformsProxy) {
    const bin = context.resourceBin("Grid");
    const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
    const sampler = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    const textureNames = ["color", "pick", "zbuffer"];
    const textureUniforms = textureNames.map((name) => `textures.${name}`);
    const program = await context.makeProgramAsync(bin, { vertexShader: shader_default13, fragmentShader: shader_default14, uniformBufferBlocks: ["Camera"], textureUniforms });
    return { bin, uniforms, sampler, program };
  }
};
function isEnabled(context, state) {
  return state.toonOutline.enabled && (context.isIdleFrame || !state.toonOutline.onlyOnIdleFrame);
}
var ToonModuleContext = class {
  constructor(context, module, uniforms, resources) {
    this.context = context;
    this.module = module;
    this.uniforms = uniforms;
    this.resources = resources;
  }
  update(state) {
    const { context, resources } = this;
    if (context.deviceProfile.quirks.adreno600) {
      return;
    }
    const { uniforms } = resources;
    const { toonOutline, localSpaceTranslation } = state;
    if (context.hasStateChanged({ toonOutline, localSpaceTranslation })) {
      const { values } = this.uniforms;
      values.color = toonOutline.color;
      context.updateUniformBuffer(uniforms, this.uniforms);
    }
    if (context.isRendering() && !context.isPickBuffersValid() && isEnabled(context, state)) {
      context.renderPickBuffers();
    }
  }
  render(state) {
    const { context, resources } = this;
    if (context.deviceProfile.quirks.adreno600) {
      return;
    }
    const { program, uniforms, sampler } = resources;
    const { gl, cameraUniforms } = context;
    const { textures } = context.buffers;
    if (context.isRendering() && context.isPickBuffersValid() && isEnabled(context, state)) {
      glState(gl, {
        program,
        uniformBuffers: [cameraUniforms, uniforms],
        textures: [
          { kind: "TEXTURE_2D", texture: textures.color, sampler },
          { kind: "TEXTURE_2D", texture: textures.pick, sampler },
          { kind: "TEXTURE_2D", texture: textures.depth, sampler }
        ],
        sample: {
          alphaToCoverage: true
        },
        blend: {
          enable: false,
          srcRGB: "SRC_ALPHA",
          dstRGB: "ONE_MINUS_SRC_ALPHA",
          srcAlpha: "ONE",
          dstAlpha: "ONE"
        },
        depth: {
          test: false,
          writeMask: false
        }
      });
      const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
      context["addRenderStatistics"](stats);
    }
  }
  contextLost() {
  }
  dispose() {
    this.contextLost();
    this.resources.bin.dispose();
  }
};

// ../core3d/modules/index.ts
function createDefaultModules() {
  return [
    new BackgroundModule(),
    new CubeModule(),
    new OctreeModule(),
    new DynamicModule(),
    new ToonModule(),
    new GridModule(),
    new ClippingModule(),
    new WatermarkModule(),
    new TonemapModule()
  ];
}

// ../core3d/highlight.ts
function createNeutralHighlight() {
  return [
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}
function createTransparentHighlight(opacity) {
  return [
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    opacity,
    0
  ];
}
function createColorSetHighlight(color) {
  const [r, g, b, a] = color;
  return [
    0,
    0,
    0,
    0,
    r,
    0,
    0,
    0,
    0,
    g,
    0,
    0,
    0,
    0,
    b,
    0,
    0,
    0,
    0,
    a ?? 1
  ];
}
function createRGBATransformHighlight(options) {
  const r = normalizeLinearTransform(options.red);
  const g = normalizeLinearTransform(options.green);
  const b = normalizeLinearTransform(options.blue);
  const a = normalizeLinearTransform(options.opacity);
  return [
    r[0],
    0,
    0,
    0,
    r[1],
    0,
    g[0],
    0,
    0,
    g[1],
    0,
    0,
    b[0],
    0,
    b[1],
    0,
    0,
    0,
    a[0],
    a[1]
  ];
}
function createHSLATransformHighlight(options) {
  const [ls, lo] = normalizeLinearTransform(options.lightness);
  const [as, ao] = normalizeLinearTransform(options.opacity);
  function mix(a, b, t) {
    return a + (b - a) * t;
  }
  const ss = options.saturation ?? 1;
  const s0 = mix(1 / 3, 1, ss) * ls;
  const s1 = mix(1 / 3, 0, ss) * ls;
  return [
    s0,
    s1,
    s1,
    0,
    lo,
    s1,
    s0,
    s1,
    0,
    lo,
    s1,
    s1,
    s0,
    0,
    lo,
    0,
    0,
    0,
    as,
    ao
  ];
}
function isLinearTransform(transform) {
  return typeof transform == "object";
}
function normalizeLinearTransform(transform) {
  let scale7 = 1;
  let offset = 0;
  if (isLinearTransform(transform)) {
    if (transform.scale != void 0) {
      scale7 = transform.scale;
    }
    if (transform.offset != void 0) {
      offset = transform.offset;
    }
  } else if (typeof transform == "number") {
    scale7 = 0;
    offset = transform;
  }
  return [scale7, offset];
}

// ../core3d/benchmark/benchmark.ts
var _Benchmark = class {
  canvas;
  gl;
  constructor() {
    const options = {
      alpha: true,
      antialias: false,
      depth: false,
      desynchronized: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false
    };
    const { size } = _Benchmark;
    const canvas = this.canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.style.backgroundColor = "red";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.right = "0";
    canvas.style.bottom = "0";
    canvas.style.zIndex = "10";
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl2", options);
    if (!gl)
      throw new Error("Unable to create WebGL 2 context!");
    this.gl = gl;
  }
  dispose() {
    const { gl, canvas } = this;
    document.body.removeChild(canvas);
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }
};
var Benchmark = _Benchmark;
__publicField(Benchmark, "size", 1024);
__publicField(Benchmark, "numPixels", _Benchmark.size * _Benchmark.size);

// ../core3d/benchmark/util.ts
function waitFrame() {
  return new Promise((resolve) => {
    function animate(time) {
      resolve(time);
    }
    requestAnimationFrame(animate);
  });
}
async function measure(action) {
  const elapsed = [];
  let prevTime;
  async function tick() {
    const time = await waitFrame();
    if (prevTime != void 0) {
      elapsed.push(time - prevTime);
    }
    prevTime = time;
  }
  const frames = 6;
  for (let i = 0; i < frames; i++) {
    await tick();
  }
  elapsed.sort((a, b) => a - b);
  const medianInterval = elapsed[Math.round(elapsed.length / 2)];
  const fps = Math.round(1e3 / medianInterval);
  console.log({ fps });
  let iterations = 1;
  for (; ; ) {
    prevTime = void 0;
    elapsed.length = 0;
    for (let i = 0; i < frames; i++) {
      await tick();
      for (let j = 0; j < iterations; j++) {
        action(j);
      }
    }
    elapsed.sort((a, b) => a - b);
    const averageFrameInterval = elapsed.slice(1, elapsed.length - 1).reduce((a, b) => a + b) / (elapsed.length - 2);
    if (averageFrameInterval > 100) {
      return averageFrameInterval / iterations;
    }
    iterations = Math.max(iterations + 1, Math.round(iterations * 1.75));
    console.log(iterations);
  }
}

// ../core3d/benchmark/shaders/fillrate.vert
var fillrate_default = "out float instance;\n\nvoid main() {\n    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;\n    // float z = 1. - float(gl_InstanceID) * depth;\n    gl_Position = vec4(pos, 0, 1);\n    instance = float(gl_InstanceID);\n}";

// ../core3d/benchmark/shaders/fillrate.frag
var fillrate_default2 = "in float instance;\nuniform float seed;\n\nconst float PHI = 1.61803398874989484820459;  // \u03A6 = Golden Ratio   \n\nfloat gold_noise(in vec2 xy, in float seed) {\n    return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);\n}\n\nout vec4 fragColor;\nvoid main() {\n    // float v = gold_noise(gl_FragCoord.xy, instance / 1024. + seed);\n    fragColor = vec4(seed, seed, seed, 1);\n    // fragColor = vec4(v, v, v, .5);\n    // fragColor = vec4(1);\n}";

// ../core3d/benchmark/shaders/pointrate.vert
var pointrate_default = "void main() {\n    vec2 pos = vec2(gl_VertexID % 1024, gl_VertexID / 1024) / 512.0 - 1.0;\n    gl_Position = vec4(pos, 0, 1);\n    gl_PointSize = 1.;\n}";

// ../core3d/benchmark/shaders/pointrate.frag
var pointrate_default2 = "uniform vec4 color;\nout vec4 fragColor;\nvoid main() {\n    fragColor = color;\n}";

// ../core3d/benchmark/shaders/index.ts
var shaders3 = {
  fillrate: {
    vertexShader: fillrate_default,
    fragmentShader: fillrate_default2
  },
  pointrate: {
    vertexShader: pointrate_default,
    fragmentShader: pointrate_default2
  }
};

// ../core3d/benchmark/fillrate.ts
var FillrateProfiler = class {
  constructor(benchmark) {
    this.benchmark = benchmark;
    const { gl } = this.benchmark;
    this.program = glCreateProgram(gl, shaders3.fillrate);
    this.uniforms = glUniformLocations(gl, this.program, ["seed"]);
  }
  program;
  uniforms;
  async measure() {
    const { benchmark, program, uniforms } = this;
    const { gl } = benchmark;
    const { size, numPixels } = Benchmark;
    gl.getError();
    const numQuads = 128;
    glState(gl, {
      viewport: { width: size, height: size },
      program,
      blend: {
        enable: true,
        srcRGB: "SRC_ALPHA",
        dstRGB: "ONE_MINUS_SRC_ALPHA",
        srcAlpha: "ONE",
        dstAlpha: "ONE"
      },
      depth: {
        test: false,
        writeMask: false
      }
    });
    function render(iteration) {
      gl.uniform1f(uniforms.seed, Math.random());
      glDraw(gl, { kind: "arrays_instanced", mode: "TRIANGLE_STRIP", count: 4, instanceCount: numQuads });
      gl.flush();
    }
    glClear(gl, { kind: "back_buffer", color: [0, 0, 0, 1] });
    const time = await measure(render);
    const rate = numPixels * numQuads * 1e3 / time;
    return rate;
  }
};

// ../core3d/benchmark/pointrate.ts
var PointrateProfiler = class {
  constructor(benchmark) {
    this.benchmark = benchmark;
    const { gl } = this.benchmark;
    this.program = glCreateProgram(gl, shaders3.pointrate);
    this.uniforms = glUniformLocations(gl, this.program, ["color"]);
  }
  program;
  uniforms;
  async measure() {
    const { benchmark, program, uniforms } = this;
    const { gl } = benchmark;
    const { size, numPixels } = Benchmark;
    gl.getError();
    const numOverdraws = 8;
    glState(gl, {
      viewport: { width: size, height: size },
      program,
      blend: {
        enable: false
      },
      depth: {
        test: false,
        writeMask: false
      }
    });
    function render(iteration) {
      gl.uniform4f(uniforms.color, Math.random(), Math.random(), Math.random(), 1);
      glDraw(gl, { kind: "arrays_instanced", mode: "POINTS", count: numPixels, instanceCount: numOverdraws });
    }
    glClear(gl, { kind: "back_buffer", color: [0, 0, 0, 1] });
    const time = await measure(render);
    const rate = numPixels * numOverdraws * 1e3 / time;
    return rate;
  }
};

// ../core3d/geometry.ts
var testMaterial = {
  kind: "ggx",
  metallicFactor: 1,
  roughnessFactor: 0.1
};
var defaultInstance = {
  position: vec3_exports.create()
};
function createRandomInstances(count = 1, radius) {
  const instances = [];
  const r = radius ?? count <= 1 ? 0 : Math.pow(count, 1 / 3) * 2;
  const rndCoord = () => (Math.random() * 2 - 1) * r;
  const rndAngle = () => Math.random() * 360;
  for (var i = 0; i < count; i++) {
    const position = vec3_exports.fromValues(rndCoord(), rndCoord(), rndCoord());
    if (vec3_exports.sqrLen(position) > r * r) {
      i--;
      continue;
    }
    const rotation = quat_exports.fromEuler(quat_exports.create(), rndAngle(), rndAngle(), rndAngle());
    instances.push({ position, rotation });
  }
  return instances;
}
function createTestCube() {
  const vertices = createCubeVertices((pos, norm, col) => [...pos, ...norm, ...col]);
  const indices = createCubeIndices();
  const attributes = {
    position: { kind: "FLOAT_VEC3", buffer: vertices, byteStride: 36, byteOffset: 0 },
    normal: { kind: "FLOAT_VEC3", buffer: vertices, byteStride: 36, byteOffset: 12 },
    color0: { kind: "FLOAT_VEC3", buffer: vertices, byteStride: 36, byteOffset: 24 }
  };
  const geometry = {
    primitiveType: "TRIANGLES",
    attributes,
    indices
  };
  const primitive = { geometry, material: testMaterial };
  const mesh = { primitives: [primitive] };
  const instances = [defaultInstance];
  return { mesh, instances };
}
function createCubeVertices(pack) {
  function face(x, y, color) {
    const normal = vec3_exports.cross(vec3_exports.create(), y, x);
    function vert(fx, fy) {
      const pos = vec3_exports.clone(normal);
      vec3_exports[fx](pos, pos, x);
      vec3_exports[fy](pos, pos, y);
      return pack(pos, normal, color);
    }
    return [
      ...vert("sub", "sub"),
      ...vert("add", "sub"),
      ...vert("sub", "add"),
      ...vert("add", "add")
    ];
  }
  return new Float32Array([
    ...face([0, 0, -1], [0, 1, 0], [1, 0, 0]),
    // right (1, 0, 0)
    ...face([0, 0, 1], [0, 1, 0], [0, 1, 1]),
    // left (-1, 0, 0)
    ...face([1, 0, 0], [0, 0, 1], [0, 1, 0]),
    // top (0, 1, 0)
    ...face([1, 0, 0], [0, 0, -1], [1, 0, 1]),
    // bottom (0, -1, 0)
    ...face([1, 0, 0], [0, 1, 0], [0, 0, 1]),
    // front (0, 0, 1)
    ...face([-1, 0, 0], [0, 1, 0], [1, 1, 0])
    // back (0, 0, -1)
  ]);
}
function createCubeIndices() {
  let idxOffset = 0;
  function face() {
    const idx = [0, 2, 1, 1, 2, 3].map((i) => i + idxOffset);
    idxOffset += 4;
    return idx;
  }
  return new Uint16Array([
    ...face(),
    ...face(),
    ...face(),
    ...face(),
    ...face(),
    ...face()
  ]);
}
function createTestSphere(detail = 0) {
  const radius = 1;
  const { positionBuffer, normalBuffer, texCoordBuffer } = icosahedron(radius, detail);
  const attributes = {
    position: { kind: "FLOAT_VEC3", buffer: positionBuffer },
    normal: { kind: "FLOAT_VEC3", buffer: normalBuffer },
    texCoord0: { kind: "FLOAT_VEC2", buffer: texCoordBuffer }
  };
  const geometry = {
    primitiveType: "TRIANGLES",
    attributes,
    indices: positionBuffer.length / 3
  };
  const primitive = { geometry, material: testMaterial };
  const mesh = { primitives: [primitive] };
  return { mesh, instances: [defaultInstance] };
}
function icosahedron(radius, detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    -1,
    t,
    0,
    1,
    t,
    0,
    -1,
    -t,
    0,
    1,
    -t,
    0,
    0,
    -1,
    t,
    0,
    1,
    t,
    0,
    -1,
    -t,
    0,
    1,
    -t,
    t,
    0,
    -1,
    t,
    0,
    1,
    -t,
    0,
    -1,
    -t,
    0,
    1
  ];
  const indices = [
    0,
    11,
    5,
    0,
    5,
    1,
    0,
    1,
    7,
    0,
    7,
    10,
    0,
    10,
    11,
    1,
    5,
    9,
    5,
    11,
    4,
    11,
    10,
    2,
    10,
    7,
    6,
    7,
    1,
    8,
    3,
    9,
    4,
    3,
    4,
    2,
    3,
    2,
    6,
    3,
    6,
    8,
    3,
    8,
    9,
    4,
    9,
    5,
    2,
    4,
    11,
    6,
    2,
    10,
    8,
    6,
    7,
    9,
    8,
    1
  ];
  return polyhedron(vertices, indices, radius, detail);
}
function polyhedron(vertices, indices, radius, detail) {
  const vertexBuffer = [];
  const uvBuffer = [];
  subdivide(detail);
  applyRadius(radius);
  generateUVs();
  const positionBuffer = new Float32Array(vertexBuffer);
  const normalBuffer = new Float32Array(vertexBuffer);
  const texCoordBuffer = new Float32Array(uvBuffer);
  if (detail == 0) {
    computeVertexNormals();
  } else {
    normalizeNormals();
  }
  return { positionBuffer, normalBuffer, texCoordBuffer };
  function subdivide(detail2) {
    const a = vec3_exports.create();
    const b = vec3_exports.create();
    const c = vec3_exports.create();
    for (let i = 0; i < indices.length; i += 3) {
      getVertexByIndex(indices[i + 0], a);
      getVertexByIndex(indices[i + 1], b);
      getVertexByIndex(indices[i + 2], c);
      subdivideFace(a, b, c, detail2);
    }
  }
  function subdivideFace(a, b, c, detail2) {
    const cols = detail2 + 1;
    const v = [];
    for (let i = 0; i <= cols; i++) {
      v[i] = [];
      const aj = vec3_exports.lerp(vec3_exports.create(), a, c, i / cols);
      const bj = vec3_exports.lerp(vec3_exports.create(), b, c, i / cols);
      const rows = cols - i;
      for (let j = 0; j <= rows; j++) {
        if (j === 0 && i === cols) {
          v[i][j] = aj;
        } else {
          v[i][j] = vec3_exports.lerp(vec3_exports.create(), aj, bj, j / rows);
        }
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2);
        if (j % 2 === 0) {
          pushVertex(v[i][k + 1]);
          pushVertex(v[i + 1][k]);
          pushVertex(v[i][k]);
        } else {
          pushVertex(v[i][k + 1]);
          pushVertex(v[i + 1][k + 1]);
          pushVertex(v[i + 1][k]);
        }
      }
    }
  }
  function applyRadius(radius2) {
    const vertex = vec3_exports.create();
    for (let i = 0; i < vertexBuffer.length; i += 3) {
      vertex[0] = vertexBuffer[i + 0];
      vertex[1] = vertexBuffer[i + 1];
      vertex[2] = vertexBuffer[i + 2];
      vec3_exports.scale(vertex, vec3_exports.normalize(vertex, vertex), radius2);
      vertexBuffer[i + 0] = vertex[0];
      vertexBuffer[i + 1] = vertex[1];
      vertexBuffer[i + 2] = vertex[2];
    }
  }
  function generateUVs() {
    const vertex = vec3_exports.create();
    for (let i = 0; i < vertexBuffer.length; i += 3) {
      vertex[0] = vertexBuffer[i + 0];
      vertex[1] = vertexBuffer[i + 1];
      vertex[2] = vertexBuffer[i + 2];
      const u = azimuth(vertex) / 2 / Math.PI + 0.5;
      const v = inclination(vertex) / Math.PI + 0.5;
      uvBuffer.push(u, 1 - v);
    }
    correctUVs();
    correctSeam();
  }
  function correctSeam() {
    for (let i = 0; i < uvBuffer.length; i += 6) {
      const x0 = uvBuffer[i + 0];
      const x1 = uvBuffer[i + 2];
      const x2 = uvBuffer[i + 4];
      const max4 = Math.max(x0, x1, x2);
      const min4 = Math.min(x0, x1, x2);
      if (max4 > 0.9 && min4 < 0.1) {
        if (x0 < 0.2)
          uvBuffer[i + 0] += 1;
        if (x1 < 0.2)
          uvBuffer[i + 2] += 1;
        if (x2 < 0.2)
          uvBuffer[i + 4] += 1;
      }
    }
  }
  function pushVertex(vertex) {
    vertexBuffer.push(...vertex);
  }
  function getVertexByIndex(index2, vertex) {
    const stride = index2 * 3;
    vertex[0] = vertices[stride + 0];
    vertex[1] = vertices[stride + 1];
    vertex[2] = vertices[stride + 2];
  }
  function correctUVs() {
    const a = vec3_exports.create();
    const b = vec3_exports.create();
    const c = vec3_exports.create();
    const centroid = vec3_exports.create();
    const uvA = vec2_exports.create();
    const uvB = vec2_exports.create();
    const uvC = vec2_exports.create();
    for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
      vec3_exports.set(a, vertexBuffer[i + 0], vertexBuffer[i + 1], vertexBuffer[i + 2]);
      vec3_exports.set(b, vertexBuffer[i + 3], vertexBuffer[i + 4], vertexBuffer[i + 5]);
      vec3_exports.set(c, vertexBuffer[i + 6], vertexBuffer[i + 7], vertexBuffer[i + 8]);
      vec2_exports.set(uvA, uvBuffer[j + 0], uvBuffer[j + 1]);
      vec2_exports.set(uvB, uvBuffer[j + 2], uvBuffer[j + 3]);
      vec2_exports.set(uvC, uvBuffer[j + 4], uvBuffer[j + 5]);
      vec3_exports.add(centroid, a, b);
      vec3_exports.add(centroid, centroid, c);
      vec3_exports.scale(centroid, centroid, 1 / 3);
      const azi = azimuth(centroid);
      correctUV(uvA, j + 0, a, azi);
      correctUV(uvB, j + 2, b, azi);
      correctUV(uvC, j + 4, c, azi);
    }
  }
  function correctUV(uv, stride, vector, azimuth2) {
    if (azimuth2 < 0 && uv[0] === 1) {
      uvBuffer[stride] = uv[0] - 1;
    }
    if (vector[0] === 0 && vector[2] === 0) {
      uvBuffer[stride] = azimuth2 / 2 / Math.PI + 0.5;
    }
  }
  function azimuth(vector) {
    return Math.atan2(vector[2], -vector[0]);
  }
  function inclination(vector) {
    return Math.atan2(-vector[1], Math.sqrt(vector[0] * vector[0] + vector[2] * vector[2]));
  }
  function computeVertexNormals() {
    if (positionBuffer !== void 0) {
      const cb = vec3_exports.create(), ab = vec3_exports.create();
      for (let i = 0, il = positionBuffer.length; i < il; i += 9) {
        const pA = positionBuffer.subarray(i + 0, i + 3);
        const pB = positionBuffer.subarray(i + 3, i + 6);
        const pC = positionBuffer.subarray(i + 6, i + 9);
        vec3_exports.sub(cb, pC, pB);
        vec3_exports.sub(ab, pA, pB);
        vec3_exports.cross(cb, cb, ab);
        vec3_exports.normalize(cb, cb);
        vec3_exports.copy(normalBuffer.subarray(i + 0, i + 3), cb);
        vec3_exports.copy(normalBuffer.subarray(i + 3, i + 6), cb);
        vec3_exports.copy(normalBuffer.subarray(i + 6, i + 9), cb);
      }
    }
  }
  function normalizeNormals() {
    for (let i = 0, il = normalBuffer.length; i < il; i += 3) {
      const normal = normalBuffer.subarray(i, i + 3);
      vec3_exports.normalize(normal, normal);
    }
  }
}

// ../core3d/gltf/loader.ts
async function request(url, abortController) {
  const signal = abortController?.signal;
  const response = await fetch(url.toString(), { mode: "cors", signal });
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}: ${response.statusText} (${url})`);
  }
  return response;
}
async function downloadJson(url, abortController) {
  const response = await request(url, abortController);
  return await response.json();
}
async function downloadArrayBuffer(url, abortController) {
  const response = await request(url, abortController);
  return await response.arrayBuffer();
}
async function downloadBlob(url, abortController) {
  const response = await request(url, abortController);
  return await response.blob();
}
var BINARY_HEADER_MAGIC = "glTF";
var BINARY_HEADER_LENGTH = 12;
var BINARY_CHUNK_TYPES = { JSON: 1313821514, BIN: 5130562 };
function parseGLB(data) {
  const headerView = new DataView(data, 0, BINARY_HEADER_LENGTH);
  const decoder = new TextDecoder();
  const header = {
    magic: decoder.decode(new Uint8Array(data, 0, 4)),
    version: headerView.getUint32(4, true),
    length: headerView.getUint32(8, true)
  };
  if (header.magic !== BINARY_HEADER_MAGIC) {
    throw new Error("Unsupported glTF-Binary header.");
  } else if (header.version < 2) {
    throw new Error("Unsupported legacy gltf file detected.");
  }
  let json;
  let buffer;
  const chunkView = new DataView(data, BINARY_HEADER_LENGTH);
  let chunkIndex = 0;
  while (chunkIndex < chunkView.byteLength) {
    const chunkLength = chunkView.getUint32(chunkIndex, true);
    chunkIndex += 4;
    const chunkType = chunkView.getUint32(chunkIndex, true);
    chunkIndex += 4;
    if (chunkType === BINARY_CHUNK_TYPES.JSON) {
      const contentArray = new Uint8Array(data, BINARY_HEADER_LENGTH + chunkIndex, chunkLength);
      json = decoder.decode(contentArray);
      json = json.substring(0, json.lastIndexOf("}") + 1);
    } else if (chunkType === BINARY_CHUNK_TYPES.BIN) {
      const contentArray = new Uint8Array(data, BINARY_HEADER_LENGTH + chunkIndex, chunkLength);
      const binaryChunk = new Uint8Array(chunkLength);
      binaryChunk.set(contentArray);
      buffer = binaryChunk.buffer;
    }
    chunkIndex += chunkLength;
  }
  if (!json) {
    throw new Error("glTF-Binary: JSON content not found.");
  }
  if (!buffer) {
    throw new Error("glTF-Binary: Binary chunk not found.");
  }
  return { json, buffer };
}
async function loadData(url, abortController) {
  const path = url.pathname.toLowerCase();
  let gltf;
  let buffers;
  if (path.endsWith(".gltf")) {
    gltf = await downloadJson(url);
    const bufferPromises = (gltf.buffers ?? []).map(async (buf) => {
      const bufferUrl = new URL(buf.uri, url);
      if (!bufferUrl.search)
        bufferUrl.search = url.search ?? "";
      return downloadArrayBuffer(bufferUrl, abortController);
    });
    buffers = await Promise.all(bufferPromises);
  } else if (path.endsWith(".glb")) {
    const glb = await downloadArrayBuffer(url, abortController);
    const { json, buffer } = parseGLB(glb);
    gltf = JSON.parse(json);
    buffers = [buffer];
  } else {
    throw new Error(`Uknown GLTF file extention: "${url}"!`);
  }
  const imageBlobPromises = gltf.images?.map((img) => {
    if (img.uri) {
      const imageUrl = new URL(img.uri, url);
      return downloadBlob(imageUrl, abortController);
    }
  }) ?? [];
  const externalImageBlobs = await Promise.all(imageBlobPromises);
  return { gltf, buffers, externalImageBlobs };
}

// ../core3d/gltf/parser.ts
function decomposeMatrix(transform) {
  const rotation = quat_exports.fromMat3(quat_exports.create(), mat3_exports.fromMat4(mat3_exports.create(), transform));
  const position = vec3_exports.fromValues(transform[12], transform[13], transform[14]);
  return { rotation, position };
}
function getTransform(node) {
  const { matrix, translation, rotation } = node;
  const transform = mat4_exports.create();
  if (matrix) {
    mat4_exports.set(transform, ...matrix);
  } else if (translation || rotation) {
    const t = translation ? vec3_exports.fromValues(...translation) : vec3_exports.create();
    const r = rotation ? quat_exports.fromValues(...rotation) : quat_exports.create();
    mat4_exports.fromRotationTranslation(transform, r, t);
  }
  return transform;
}
async function parseGLTF(buffers, gltf, externalImageBlobs, baseObjectId) {
  const { extensionsRequired, extensionsUsed } = gltf;
  if (extensionsUsed && extensionsUsed.length != 0 && extensionsUsed[0] != "KHR_materials_unlit") {
    console.warn(`The following glTF extensions were used, but are not supported: ${extensionsUsed.join(", ")}!`);
  }
  if (extensionsRequired && extensionsRequired.length != 0 && extensionsRequired[0] != "KHR_materials_unlit") {
    throw new Error(`The following glTF extensions were required, but are not supported: ${extensionsRequired.join(", ")}!`);
  }
  const filters = {
    [9728 /* NEAREST */]: "NEAREST",
    [9729 /* LINEAR */]: "LINEAR",
    [9984 /* NEAREST_MIPMAP_NEAREST */]: "NEAREST_MIPMAP_NEAREST",
    [9985 /* LINEAR_MIPMAP_NEAREST */]: "LINEAR_MIPMAP_NEAREST",
    [9986 /* NEAREST_MIPMAP_LINEAR */]: "NEAREST_MIPMAP_LINEAR",
    [9987 /* LINEAR_MIPMAP_LINEAR */]: "LINEAR_MIPMAP_LINEAR"
  };
  const wrappings = {
    [33071 /* CLAMP_TO_EDGE */]: "CLAMP_TO_EDGE",
    [33648 /* MIRRORED_REPEAT */]: "MIRRORED_REPEAT",
    [10497 /* REPEAT */]: "REPEAT"
  };
  const attributeNames = {
    POSITION: "position",
    NORMAL: "normal",
    TANGENT: "tangent",
    TEXCOORD_0: "texCoord0",
    TEXCOORD_1: "texCoord1",
    COLOR_0: "color0"
  };
  const attributeCompontentTypes = {
    [5126 /* FLOAT */]: "FLOAT",
    [5120 /* BYTE */]: "BYTE",
    [5122 /* SHORT */]: "SHORT",
    [5124 /* INT */]: "INT",
    [5121 /* UNSIGNED_BYTE */]: "UNSIGNED_BYTE",
    [5123 /* UNSIGNED_SHORT */]: "UNSIGNED_SHORT",
    [5125 /* UNSIGNED_INT */]: "UNSIGNED_INT"
  };
  const attributeComponentCounts = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4
  };
  const attributeCompontentTypePrefixes = {
    [5126 /* FLOAT */]: "FLOAT",
    [5120 /* BYTE */]: "INT",
    [5122 /* SHORT */]: "INT",
    [5124 /* INT */]: "INT",
    [5121 /* UNSIGNED_BYTE */]: "UNSIGNED_INT",
    [5123 /* UNSIGNED_SHORT */]: "UNSIGNED_INT",
    [5125 /* UNSIGNED_INT */]: "UNSIGNED_INT"
  };
  const topologies = {
    [0 /* POINTS */]: "POINTS",
    [1 /* LINES */]: "LINES",
    [2 /* LINE_LOOP */]: "LINE_LOOP",
    [3 /* LINE_STRIP */]: "LINE_STRIP",
    [4 /* TRIANGLES */]: "TRIANGLES",
    [5 /* TRIANGLE_STRIP */]: "TRIANGLE_STRIP",
    [6 /* TRIANGLE_FAN */]: "TRIANGLE_FAN"
  };
  const bufferTypes = {
    [5121 /* UNSIGNED_BYTE */]: Uint8Array,
    [5123 /* UNSIGNED_SHORT */]: Uint16Array,
    [5125 /* UNSIGNED_INT */]: Uint32Array,
    [5120 /* BYTE */]: Int8Array,
    [5122 /* SHORT */]: Int16Array,
    [5124 /* INT */]: Int32Array,
    [5126 /* FLOAT */]: Float32Array
  };
  const bufferViews = gltf.bufferViews.map((v) => {
    return new Uint8Array(buffers[v.buffer], v.byteOffset, v.byteLength);
  });
  function getImageBlob(image) {
    const bufferView = gltf.bufferViews[image.bufferView];
    const begin = bufferView.byteOffset ?? 0;
    const end = bufferView.byteLength ? begin + bufferView.byteLength : void 0;
    const buffer = buffers[bufferView.buffer].slice(begin, end);
    return new Blob([buffer]);
  }
  const imagePromises = gltf.images?.map(async (img, idx) => {
    let blob = externalImageBlobs[idx] ?? getImageBlob(img);
    if (img.mimeType) {
      blob = new Blob([blob], { type: img.mimeType });
    }
    const image = await createImageBitmap(blob, { colorSpaceConversion: "none" });
    const { width, height } = image;
    const params = { kind: "TEXTURE_2D", width, height, generateMipMaps: true, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image };
    return { params };
  }) ?? [];
  const images = await Promise.all(imagePromises);
  const samplers = gltf.samplers?.map((s) => {
    const { magFilter, minFilter, wrapS, wrapT } = s;
    const minificationFilter = filters[minFilter ?? 9987 /* LINEAR_MIPMAP_LINEAR */];
    const magnificationFilter = filters[magFilter ?? 9729 /* LINEAR */];
    const wrap = wrapS && wrapT ? [wrappings[wrapS], wrappings[wrapT]] : ["REPEAT", "REPEAT"];
    return { minificationFilter, magnificationFilter, wrap };
  }) ?? [];
  const textures = gltf.textures?.map((t) => {
    const image = images[t.source];
    const sampler = samplers[t.sampler];
    return { image, sampler };
  }) ?? [];
  const defaultMaterial = { kind: "ggx" };
  const materials = gltf.materials?.map((m, i) => {
    const isUnlit = m.extensions && "KHR_materials_unlit" in m.extensions;
    const { pbrMetallicRoughness, normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, alphaMode, alphaCutoff, doubleSided } = m;
    function getTexInfo(texInfo) {
      if (texInfo) {
        const transform = void 0;
        if ("scale" in texInfo) {
          return {
            texture: textures[texInfo.index] ?? null,
            texCoord: texInfo.texCoord,
            scale: texInfo.scale,
            transform
          };
        } else if ("strength" in texInfo) {
          return {
            texture: textures[texInfo.index] ?? null,
            texCoord: texInfo.texCoord,
            strength: texInfo.strength,
            transform
          };
        }
        return {
          texture: textures[texInfo.index] ?? null,
          texCoord: texInfo.texCoord,
          transform
        };
      }
    }
    if (isUnlit) {
      return {
        kind: "unlit",
        doubleSided,
        alphaMode,
        alphaCutoff,
        baseColorFactor: pbrMetallicRoughness?.baseColorFactor,
        baseColorTexture: getTexInfo(pbrMetallicRoughness?.baseColorTexture)
      };
    } else {
      return {
        kind: "ggx",
        doubleSided,
        alphaMode,
        alphaCutoff,
        baseColorFactor: pbrMetallicRoughness?.baseColorFactor,
        metallicFactor: pbrMetallicRoughness?.metallicFactor,
        roughnessFactor: pbrMetallicRoughness?.roughnessFactor,
        emissiveFactor,
        baseColorTexture: getTexInfo(pbrMetallicRoughness?.baseColorTexture),
        metallicRoughnessTexture: getTexInfo(pbrMetallicRoughness?.metallicRoughnessTexture),
        normalTexture: getTexInfo(normalTexture),
        occlusionTexture: getTexInfo(occlusionTexture),
        emissiveTexture: getTexInfo(emissiveTexture)
      };
    }
  }) ?? [];
  const meshes = gltf.meshes?.map((m) => {
    const primitives = m.primitives.map((p) => {
      const attributes = {};
      for (const [key, value] of Object.entries(p.attributes)) {
        const name = attributeNames[key];
        const accessor = gltf.accessors[value];
        console.assert(!accessor.sparse);
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const buffer = bufferViews[accessor.bufferView];
        const componentType = accessor.componentType;
        const prefix = attributeCompontentTypePrefixes[componentType];
        const type = accessor.type;
        const kind = accessor.type == "SCALAR" ? prefix : `${prefix}_${type}`;
        const attrib = {
          kind,
          buffer,
          componentType: attributeCompontentTypes[componentType],
          componentCount: attributeComponentCounts[type],
          normalized: accessor.normalized ?? false,
          byteStride: bufferView.byteStride ?? 0,
          byteOffset: accessor.byteOffset ?? 0
        };
        Reflect.set(attributes, name, attrib);
      }
      ;
      const indicesAccessor = p.indices != void 0 ? gltf.accessors[p.indices] : void 0;
      const count = indicesAccessor ? indicesAccessor.count : gltf.accessors[p.attributes["POSITION"]].count;
      const ib = bufferViews[indicesAccessor?.bufferView ?? -1];
      const IndexBufferType = indicesAccessor ? bufferTypes[indicesAccessor.componentType] : void 0;
      const indices = IndexBufferType ? new IndexBufferType(ib.buffer, ib.byteOffset + (indicesAccessor.byteOffset ?? 0), indicesAccessor.count) : count;
      const mode = topologies[p.mode] ?? "TRIANGLES";
      const geometry = {
        primitiveType: mode,
        attributes,
        indices
      };
      const material = materials[p.material ?? -1] ?? defaultMaterial;
      return { geometry, material };
    });
    return { primitives };
  }) ?? [];
  const objects = [];
  if (gltf.scenes && gltf.nodes) {
    const rootNodes = gltf.scenes[gltf.scene ?? 0].nodes;
    if (rootNodes) {
      let traverseNodeTree2 = function(nodeIndex, parentTransform) {
        const node = gltf.nodes[nodeIndex];
        const transform = getTransform(node);
        if (parentTransform) {
          mat4_exports.multiply(transform, parentTransform, transform);
        }
        if (node.mesh != void 0) {
          const instance = decomposeMatrix(transform);
          const mesh = meshes[node.mesh];
          const obj = { instances: [instance], mesh, baseObjectId };
          objects.push(obj);
        }
        if (node.children) {
          for (const child of node.children) {
            traverseNodeTree2(child, transform);
          }
        }
      };
      var traverseNodeTree = traverseNodeTree2;
      for (const rootNodeIndex of rootNodes) {
        traverseNodeTree2(rootNodeIndex);
      }
    }
  }
  return objects;
}

// ../core3d/gltf/index.ts
async function loadGLTF(url, baseObjectId, abortController) {
  const { gltf, buffers, externalImageBlobs } = await loadData(url, abortController);
  return parseGLTF(buffers, gltf, externalImageBlobs, baseObjectId);
}

// ../core3d/index.ts
function initCore3D(deviceProfile, canvas, setRenderContext) {
  const options = {
    alpha: true,
    antialias: true,
    depth: false,
    desynchronized: false,
    failIfMajorPerformanceCaveat: true,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false
  };
  console.log("HEY");
  const wasmPromise = wasmInstance();
  const blob = new Blob([lut_ggx_default], { type: "image/png" });
  const lut_ggxPromise = createImageBitmap(blob);
  let renderContext;
  let context = { renderContext: void 0 };
  canvas.addEventListener("webglcontextlost", function(event) {
    event.preventDefault();
    console.info("WebGL Context lost!");
    if (renderContext) {
      renderContext["contextLost"]();
      context.renderContext = void 0;
    }
    canvas.width = 300;
    canvas.height = 150;
    if (animId !== void 0)
      cancelAnimationFrame(animId);
    animId = void 0;
  }, false);
  canvas.addEventListener("webglcontextrestored", function(event) {
    console.info("WebGL Context restored!");
    createContext();
  }, false);
  let animId;
  async function createContext() {
    const wasm = await wasmPromise;
    const lut_ggx = await lut_ggxPromise;
    renderContext = new RenderContext(deviceProfile, canvas, wasm, lut_ggx, options);
    await renderContext.init();
    setRenderContext(renderContext);
  }
  createContext();
  return async (value) => {
    deviceProfile = value;
    await createContext();
  };
}

// controller/input.ts
var _ControllerInput = class {
  domElement;
  callbacks;
  axes;
  pointerTable = [];
  _keys = /* @__PURE__ */ new Set();
  _mouseButtonDown = false;
  _zoomY = 0;
  _zoomX = 0;
  _touchMovePrev = [0, 0];
  _touchZoomDistancePrev = 0;
  prevTouchCenter = void 0;
  _mouseButtons = 0 /* none */;
  _fingers = 0;
  _mouseWheelLastActive = 0;
  usePointerLock = true;
  constructor(domElement) {
    this.domElement = domElement ?? document.body;
    this.connect();
    this.axes = {};
    this.resetAxes();
  }
  dispose() {
    this.disconnect();
  }
  get moving() {
    return this.isAnyGestureKeyPressed() || this._mouseButtons != 0 || this._fingers != 0 || this.isScrolling();
  }
  get width() {
    return this.domElement.clientWidth;
  }
  get height() {
    return this.domElement.clientHeight;
  }
  get multiplier() {
    const { _keys } = this;
    let m = 1;
    if (_keys.has("ShiftLeft"))
      m *= 10;
    if (_keys.has("ShiftRight"))
      m *= 10;
    if (_keys.has("ControlRight"))
      m *= 10;
    if (_keys.has("AltLeft"))
      m *= 0.1;
    if (_keys.has("AltRight"))
      m *= 0.1;
    return m;
  }
  get hasShift() {
    const { _keys } = this;
    if (_keys.has("ShiftLeft"))
      return true;
    if (_keys.has("ShiftRight"))
      return true;
    return false;
  }
  get zoomPos() {
    const { width, height, _zoomX, _zoomY } = this;
    if (_zoomX == 0 && _zoomY == 0) {
      return [0, 0];
    }
    return [-(_zoomX - width / 2) / height * 2, (_zoomY - height / 2) / height * 2];
  }
  connect() {
    const { domElement } = this;
    if (!domElement)
      return;
    const options = false;
    domElement.tabIndex = 0;
    domElement.addEventListener("keydown", this.keydown, options);
    domElement.addEventListener("keyup", this.keyup, options);
    domElement.addEventListener("blur", this.blur, options);
    domElement.addEventListener("click", this.click, options);
    domElement.addEventListener("contextmenu", this.contextmenu, options);
    domElement.addEventListener("mousedown", this.mousedown, options);
    domElement.addEventListener("mouseup", this.mouseup, options);
    domElement.addEventListener("mousemove", this.mousemove, options);
    domElement.addEventListener("wheel", this.wheel, options);
    domElement.addEventListener("touchstart", this.touchstart, options);
    domElement.addEventListener("touchmove", this.touchmove, options);
    domElement.addEventListener("touchend", this.touchend, options);
    domElement.addEventListener("touchcancel", this.touchcancel, options);
    domElement.focus();
  }
  disconnect() {
    const { domElement } = this;
    if (!domElement)
      return;
    const options = false;
    domElement.removeEventListener("keydown", this.keydown, options);
    domElement.removeEventListener("keyup", this.keyup, options);
    domElement.removeEventListener("blur", this.blur, options);
    domElement.removeEventListener("click", this.click, options);
    domElement.removeEventListener("contextmenu", this.contextmenu, options);
    domElement.removeEventListener("mousedown", this.mousedown, options);
    domElement.removeEventListener("mouseup", this.mouseup, options);
    domElement.removeEventListener("mousemove", this.mousemove, options);
    domElement.removeEventListener("wheel", this.wheel, options);
    domElement.removeEventListener("touchstart", this.touchstart, options);
    domElement.removeEventListener("touchmove", this.touchmove, options);
    domElement.removeEventListener("touchend", this.touchend, options);
    domElement.removeEventListener("touchcancel", this.touchcancel, options);
  }
  click = (e) => {
    e.preventDefault();
  };
  contextmenu = (e) => {
    e.preventDefault();
  };
  static isGestureKey(code) {
    return _ControllerInput._gestureKeys.indexOf(code) != -1;
  }
  isAnyGestureKeyPressed() {
    return [...this._keys].some((key) => _ControllerInput.isGestureKey(key));
  }
  isScrolling() {
    return performance.now() - this._mouseWheelLastActive < 100;
  }
  keydown = (e) => {
    if (_ControllerInput.isGestureKey(e.code)) {
      e.preventDefault();
    }
    this._keys.add(e.code);
    this._zoomX = 0;
    this._zoomY = 0;
  };
  keyup = (e) => {
    if (_ControllerInput.isGestureKey(e.code)) {
      e.preventDefault();
    }
    this._keys.delete(e.code);
  };
  blur = (e) => {
    if ("exitPointerLock" in document)
      document.exitPointerLock();
    this._keys.clear();
  };
  mousedown = async (e) => {
    const { domElement, axes } = this;
    this._mouseButtonDown = true;
    domElement.focus();
    e.preventDefault();
    this.callbacks?.mouseButtonChanged?.(e);
    await this.callbacks?.moveBegin?.(e);
    this._mouseButtons = e.buttons;
    if (e.buttons & 16 /* forward */) {
      axes.mouse_navigate--;
    } else if (e.buttons & 8 /* backward */) {
      axes.mouse_navigate++;
    }
  };
  mouseup = async (e) => {
    e.preventDefault();
    this._mouseButtons = e.buttons;
    if ("exitPointerLock" in document)
      document.exitPointerLock();
    this.callbacks?.mouseButtonChanged?.(e);
    await this.callbacks?.moveEnd?.(e);
    this._mouseButtonDown = false;
  };
  wheel = async (e) => {
    const { axes } = this;
    this._zoomX = e.offsetX;
    this._zoomY = e.offsetY;
    await this.callbacks?.moveBegin?.(e);
    this._mouseWheelLastActive = performance.now();
    axes.mouse_wheel += e.deltaY;
  };
  mousemove = (e) => {
    if (e.buttons < 1)
      return;
    if (Math.abs(e.movementX) > 100 || Math.abs(e.movementY) > 100)
      return;
    if (this._mouseButtonDown && this.usePointerLock) {
      e.currentTarget.requestPointerLock();
      this._mouseButtonDown = false;
    }
    const { axes } = this;
    if (e.buttons & 2 /* right */) {
      axes.mouse_rmb_move_x += e.movementX;
      axes.mouse_rmb_move_y += e.movementY;
    } else if (e.buttons & 4 /* middle */) {
      axes.mouse_mmb_move_x += e.movementX;
      axes.mouse_mmb_move_y += e.movementY;
    } else if (e.buttons & 1 /* left */) {
      axes.mouse_lmb_move_x += e.movementX;
      axes.mouse_lmb_move_y += e.movementY;
    }
  };
  touchstart = async (event) => {
    this.pointerTable = Array.from(event.touches).map((touch) => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
    const { pointerTable, _touchMovePrev } = this;
    this._fingers = event.touches.length;
    this.callbacks?.touchChanged?.(event);
    switch (pointerTable.length) {
      case 1:
        _touchMovePrev[0] = pointerTable[0].x;
        _touchMovePrev[1] = pointerTable[0].y;
        break;
      default:
        const dx = pointerTable[0].x - pointerTable[1].x;
        const dy = pointerTable[0].y - pointerTable[1].y;
        this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);
        _touchMovePrev[0] = (pointerTable[0].x + pointerTable[1].x) / 2;
        _touchMovePrev[1] = (pointerTable[0].y + pointerTable[1].y) / 2;
        break;
    }
    await this.callbacks?.moveBegin?.(event);
  };
  touchend = async (event) => {
    this.pointerTable = Array.from(event.touches).map((touch) => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
    const { pointerTable, _touchMovePrev } = this;
    this._fingers = event.touches.length;
    this.callbacks?.touchChanged?.(event);
    await this.callbacks?.moveEnd?.(event);
    switch (pointerTable.length) {
      case 0:
        break;
      case 1:
        _touchMovePrev[0] = pointerTable[0].x;
        _touchMovePrev[1] = pointerTable[0].y;
        break;
      default:
        const dx = pointerTable[0].x - pointerTable[1].x;
        const dy = pointerTable[0].y - pointerTable[1].y;
        this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);
        _touchMovePrev[0] = (pointerTable[0].x + pointerTable[1].x) / 2;
        _touchMovePrev[1] = (pointerTable[0].y + pointerTable[1].y) / 2;
        break;
    }
  };
  touchcancel = (event) => {
    event.preventDefault();
    this._fingers = event.touches.length;
    this.pointerTable = Array.from(event.touches).map((touch) => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
  };
  touchmove = (event) => {
    if (event.cancelable)
      event.preventDefault();
    this.pointerTable = Array.from(event.touches).map((touch) => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
    const { pointerTable, _touchMovePrev } = this;
    let { x, y } = pointerTable[0];
    const { axes } = this;
    if (pointerTable.length > 1) {
      const dx = pointerTable[0].x - pointerTable[1].x;
      const dy = pointerTable[0].y - pointerTable[1].y;
      const touchZoomDistance = Math.sqrt(dx * dx + dy * dy);
      x = (pointerTable[0].x + pointerTable[1].x) / 2;
      y = (pointerTable[0].y + pointerTable[1].y) / 2;
      const touchCenter = vec2_exports.fromValues(x, y);
      let dist4 = 0;
      if (this.prevTouchCenter) {
        dist4 = vec2_exports.dist(this.prevTouchCenter, touchCenter);
      }
      this.prevTouchCenter = touchCenter;
      const deltaWheel = this._touchZoomDistancePrev - touchZoomDistance;
      this._touchZoomDistancePrev = touchZoomDistance;
      this._zoomX = x;
      this._zoomY = y;
      if (dist4 * 2 < Math.abs(deltaWheel)) {
        if (pointerTable.length == 2) {
          axes.touch_pinch2 += deltaWheel;
        } else {
          axes.touch_pinch3 += deltaWheel;
        }
      }
    }
    switch (pointerTable.length) {
      case 1:
        axes.touch_1_move_x += x - _touchMovePrev[0];
        axes.touch_1_move_y += y - _touchMovePrev[1];
        break;
      case 2:
        axes.touch_2_move_x += x - _touchMovePrev[0];
        axes.touch_2_move_y += y - _touchMovePrev[1];
        break;
      case 3:
        axes.touch_3_move_x += x - _touchMovePrev[0];
        axes.touch_3_move_y += y - _touchMovePrev[1];
        break;
    }
    _touchMovePrev[0] = x;
    _touchMovePrev[1] = y;
  };
  animate(elapsedTime) {
    const { axes, _keys } = this;
    const delta = elapsedTime * this.height / 2e3;
    if (_keys.size) {
      if (_keys.has("KeyA"))
        axes.keyboard_ad -= delta;
      if (_keys.has("KeyD"))
        axes.keyboard_ad += delta;
      if (_keys.has("KeyW"))
        axes.keyboard_ws -= delta;
      if (_keys.has("KeyS"))
        axes.keyboard_ws += delta;
      if (_keys.has("KeyQ"))
        axes.keyboard_qe += delta;
      if (_keys.has("KeyE"))
        axes.keyboard_qe -= delta;
      if (_keys.has("ArrowLeft"))
        axes.keyboard_arrow_left_right -= delta;
      if (_keys.has("ArrowRight"))
        axes.keyboard_arrow_left_right = delta;
      ;
      if (_keys.has("ArrowUp"))
        axes.keyboard_arrow_up_down -= delta;
      if (_keys.has("ArrowDown"))
        axes.keyboard_arrow_up_down += delta;
    }
  }
  resetAxes() {
    const { axes } = this;
    axes.keyboard_ad = 0;
    axes.keyboard_ws = 0;
    axes.keyboard_qe = 0;
    axes.keyboard_arrow_left_right = 0;
    axes.keyboard_arrow_up_down = 0;
    axes.mouse_lmb_move_x = 0;
    axes.mouse_lmb_move_y = 0;
    axes.mouse_rmb_move_x = 0;
    axes.mouse_rmb_move_y = 0;
    axes.mouse_mmb_move_x = 0;
    axes.mouse_mmb_move_y = 0;
    axes.mouse_navigate = 0;
    axes.mouse_navigate = 0;
    axes.mouse_wheel = 0;
    axes.touch_1_move_x = 0;
    axes.touch_1_move_y = 0;
    axes.touch_2_move_x = 0;
    axes.touch_2_move_y = 0;
    axes.touch_3_move_x = 0;
    axes.touch_3_move_y = 0;
    axes.touch_pinch2 = 0;
    axes.touch_pinch3 = 0;
  }
};
var ControllerInput = _ControllerInput;
__publicField(ControllerInput, "_gestureKeys", ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
var MouseButtons = /* @__PURE__ */ ((MouseButtons2) => {
  MouseButtons2[MouseButtons2["none"] = 0] = "none";
  MouseButtons2[MouseButtons2["left"] = 1] = "left";
  MouseButtons2[MouseButtons2["right"] = 2] = "right";
  MouseButtons2[MouseButtons2["middle"] = 4] = "middle";
  MouseButtons2[MouseButtons2["backward"] = 8] = "backward";
  MouseButtons2[MouseButtons2["forward"] = 16] = "forward";
  return MouseButtons2;
})(MouseButtons || {});

// controller/base.ts
var BaseController = class {
  constructor(input) {
    this.input = input;
  }
  flyTo;
  dispose() {
  }
  get axes() {
    return this.input.axes;
  }
  get moving() {
    return this.input.moving;
  }
  get width() {
    return this.input.width;
  }
  get height() {
    return this.input.height;
  }
  get multiplier() {
    return this.input.multiplier;
  }
  get zoomPos() {
    return this.input.zoomPos;
  }
  get pointerTable() {
    return this.input.pointerTable;
  }
  get hasShift() {
    return this.input.hasShift;
  }
  get currentFlyTo() {
    return this.flyTo?.current;
  }
  setFlyTo(flyTo) {
    let { yaw } = flyTo.begin;
    const target = flyTo.end.yaw;
    if (yaw - target < -180)
      yaw += 360;
    else if (yaw - target > 180)
      yaw -= 360;
    const begin = { ...flyTo.begin, yaw };
    this.flyTo = { ...flyTo, begin, currentFlightTime: 0, current: begin };
  }
  animate(elapsedTime) {
    if (elapsedTime < 0 || elapsedTime > 250)
      elapsedTime = 1e3 / 60;
    this.input.animate(elapsedTime);
    const { flyTo } = this;
    if (flyTo) {
      if (flyTo.currentFlightTime >= flyTo.totalFlightTime) {
        this.flyTo = void 0;
      } else {
        flyTo.currentFlightTime += elapsedTime;
        const { currentFlightTime, totalFlightTime, begin, end, current } = flyTo;
        if (currentFlightTime < totalFlightTime) {
          const lerp5 = (a, b, t2) => a + (b - a) * t2;
          const easeInOut = (t2) => t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2;
          const t = easeInOut(currentFlightTime / totalFlightTime);
          const pos = vec3_exports.lerp(vec3_exports.create(), begin.pos, end.pos, t);
          const pitch = lerp5(begin.pitch, end.pitch, t);
          let yaw = lerp5(begin.yaw, end.yaw, t);
          if (yaw < -180)
            yaw += 360;
          else if (yaw > 180)
            yaw -= 360;
          flyTo.current = { pos, yaw, pitch };
        } else {
          Object.assign(current, end);
        }
      }
    }
  }
  attach() {
    this.input.callbacks = this;
  }
  mouseButtonChanged(event) {
  }
  touchChanged(event) {
  }
  moveBegin(event) {
  }
  moveEnd(event) {
  }
  moveTo(targetPosition, flyTime = 1e3, rotation) {
  }
  zoomTo(boundingSphere, flyTime = 1e3) {
  }
  renderStateChanges(state, elapsedTime) {
    this.animate(elapsedTime);
    if (Object.values(this.input.axes).some((v) => v != 0) || this.currentFlyTo || this.changed) {
      this.update();
      this.input.resetAxes();
      const changes = this.stateChanges(state);
      return Object.keys(changes).length ? { camera: changes } : void 0;
    }
  }
  static getDistanceFromViewPlane(point, cameraPosition, cameraRotation) {
    const dir = vec3_exports.fromValues(0, 0, -1);
    vec3_exports.transformQuat(dir, dir, cameraRotation);
    const offset = -vec3_exports.dot(dir, cameraPosition);
    return vec3_exports.dot(point, dir) + offset;
  }
};

// controller/orientation.ts
var PitchRollYawOrientation = class {
  _pitch = 30;
  _yaw = 0;
  _roll = 0;
  _rot;
  get pitch() {
    return this._pitch;
  }
  set pitch(value) {
    value = clamp(value, -90, 90);
    if (value != this._pitch) {
      this._pitch = value;
      this._rot = void 0;
    }
  }
  get yaw() {
    return this._yaw;
  }
  set yaw(value) {
    while (value >= 360)
      value -= 360;
    while (value < 0)
      value += 360;
    if (value != this._yaw) {
      this._yaw = value;
      this._rot = void 0;
    }
  }
  get roll() {
    return this._roll;
  }
  set roll(value) {
    while (value >= 360)
      value -= 360;
    while (value < 0)
      value += 360;
    if (value != this._roll) {
      this._roll = value;
      this._rot = void 0;
    }
  }
  get rotation() {
    if (!this._rot) {
      this._rot = this.computeRotation();
    }
    return this._rot;
  }
  decomposeRotation(rot) {
    const { yaw, pitch, roll } = decomposeRotation(rot);
    this.yaw = yaw * 180 / Math.PI;
    this.pitch = pitch * 180 / Math.PI;
    this.roll = roll * 180 / Math.PI;
    this._rot = rot;
  }
  computeRotation() {
    const { _roll, _pitch, _yaw } = this;
    return computeRotation(_roll, _pitch, _yaw);
  }
};
function computeRotation(roll, pitch, yaw) {
  const halfYaw = common_exports.toRadian(yaw) * 0.5;
  const halfPitch = common_exports.toRadian(pitch) * 0.5;
  const halfRoll = common_exports.toRadian(roll) * 0.5;
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
  const flipYZ = quat_exports.fromValues(0.7071067811865475, 0, 0, 0.7071067811865476);
  return quat_exports.mul(quat_exports.create(), flipYZ, quat_exports.fromValues(x, y, z, w));
}
function decomposeRotation(rot) {
  const flipXZ = quat_exports.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
  const [qx, qy, qz, qw] = quat_exports.mul(quat_exports.create(), flipXZ, rot);
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
    roll = Math.atan2(2 * (qx * qy + qz * qw), -sqz - sqx + sqy + sqw);
    pitch = Math.asin(-2 * zAxisY);
    yaw = Math.atan2(2 * (qz * qx + qy * qw), sqz - sqx - sqy + sqw);
  }
  return { yaw, pitch, roll };
}
function clamp(v, min4, max4) {
  if (v < min4) {
    v = min4;
  } else if (v > max4) {
    v = max4;
  }
  return v;
}
function rotationFromDirection(dir) {
  const up = common_exports.equals(Math.abs(vec3_exports.dot(vec3_exports.fromValues(0, 0, 1), dir)), 1) ? vec3_exports.fromValues(0, 1, 0) : vec3_exports.fromValues(0, 0, 1);
  const right = vec3_exports.cross(vec3_exports.create(), up, dir);
  vec3_exports.cross(up, dir, right);
  vec3_exports.normalize(up, up);
  vec3_exports.cross(right, up, dir);
  vec3_exports.normalize(right, right);
  return quat_exports.fromMat3(
    quat_exports.create(),
    mat3_exports.fromValues(right[0], right[1], right[2], up[0], up[1], up[2], dir[0], dir[1], dir[2])
  );
}

// controller/orbit.ts
var _OrbitController = class extends BaseController {
  kind = "orbit";
  projection = "pinhole";
  changed = false;
  params;
  orientation = new PitchRollYawOrientation();
  pivot = vec3_exports.create();
  distance;
  fov;
  constructor(input, params) {
    super(input);
    const { pitch, yaw, distance: distance4, pivot, fieldOfView } = this.params = { ..._OrbitController.defaultParams, ...params };
    const { orientation } = this;
    orientation.pitch = pitch;
    orientation.yaw = yaw;
    this.distance = distance4;
    this.fov = fieldOfView;
    this.pivot = pivot;
  }
  get position() {
    const { orientation, pivot, distance: distance4 } = this;
    const pos = vec3_exports.fromValues(0, 0, distance4);
    vec3_exports.transformQuat(pos, pos, orientation.rotation);
    vec3_exports.add(pos, pos, pivot);
    return pos;
  }
  serialize(includeDerived = false) {
    const { kind, pivot, orientation, distance: distance4, fov } = this;
    const { rotation } = orientation;
    this.changed = false;
    return { kind, pivot, rotation, distance: distance4, fovDegrees: fov, ...includeDerived ? { position: this.position } : void 0 };
  }
  updateParams(params) {
    this.params = mergeRecursive(this.params, params);
  }
  init(params) {
    const { kind, position, rotation, pivot, fovDegrees, distance: distance4 } = params;
    console.assert(kind == this.kind);
    if (fovDegrees != void 0) {
      this.fov = fovDegrees;
    }
    if (pivot) {
      this.pivot = pivot;
    }
    if (rotation) {
      this.orientation.decomposeRotation(rotation);
      this.orientation.roll = 0;
    }
    if (distance4) {
      this.distance = distance4;
      if (!pivot && position && rotation) {
        const tmp = vec3_exports.fromValues(0, 0, -distance4);
        vec3_exports.transformQuat(tmp, tmp, rotation);
        this.pivot = vec3_exports.add(tmp, tmp, position);
      }
    }
    if (position && pivot) {
      const { orientation } = this;
      if (!distance4) {
        this.distance = vec3_exports.distance(position, pivot);
      }
      if (!rotation) {
        const [x, y, z] = vec3_exports.sub(vec3_exports.create(), position, pivot);
        const pitch = Math.atan2(-y, vec2_exports.len(vec2_exports.fromValues(x, z)));
        const yaw = Math.atan2(x, z);
        orientation.yaw = yaw * 180 / Math.PI;
        orientation.pitch = pitch * 180 / Math.PI;
        orientation.roll = 0;
      }
    }
    this.attach();
    this.changed = true;
  }
  autoFit(center, radius) {
    const { params } = this;
    this.pivot = center;
    this.distance = Math.min(params.maxDistance, radius / Math.tan(common_exports.toRadian(this.fov) / 2));
    this.changed = true;
  }
  update() {
    const { axes, multiplier, pivot, orientation, distance: distance4, fov, params, height } = this;
    const tx = axes.keyboard_ad + axes.mouse_rmb_move_x - axes.touch_2_move_x;
    const ty = -axes.keyboard_qe + axes.mouse_rmb_move_y - axes.touch_2_move_y;
    const tz = axes.keyboard_ws * 2 + axes.mouse_mmb_move_y + axes.mouse_wheel / 2 + axes.touch_pinch2 * 2;
    const rx = axes.keyboard_arrow_up_down / 5 + axes.mouse_lmb_move_y + axes.touch_1_move_y;
    const ry = axes.keyboard_arrow_left_right / 5 + axes.mouse_lmb_move_x + axes.touch_1_move_x;
    orientation.roll = 0;
    const rotationalVelocity = 180 * params.rotationalVelocity / height;
    if (rx || ry) {
      orientation.pitch += -rx * rotationalVelocity;
      orientation.yaw += -ry * rotationalVelocity;
      this.changed = true;
    }
    const fovRatio = Math.tan(Math.PI / 180 * fov / 2) * 2;
    const linearVelocity = distance4 * fovRatio * multiplier * params.linearVelocity / height;
    if (tz) {
      this.distance += tz * linearVelocity;
      this.changed = true;
    } else if (tx || ty) {
      const worldPosDelta = vec3_exports.transformQuat(vec3_exports.create(), vec3_exports.fromValues(tx * linearVelocity, -ty * linearVelocity, 0), orientation.rotation);
      this.pivot = vec3_exports.add(vec3_exports.create(), pivot, worldPosDelta);
      this.changed = true;
    }
  }
  stateChanges(state) {
    const { pivot, orientation, position, fov } = this;
    const changes = {};
    if (!state || !vec3_exports.exactEquals(state.position, position)) {
      changes.position = position;
    }
    if (!state || state.rotation !== orientation.rotation) {
      changes.rotation = orientation.rotation;
    }
    if (!state || state.pivot !== pivot) {
      changes.pivot = pivot;
    }
    if (!state || state.fov !== fov) {
      changes.fov = fov;
    }
    if (!state) {
      changes.kind = "pinhole";
    }
    return changes;
  }
};
var OrbitController = _OrbitController;
__publicField(OrbitController, "defaultParams", {
  pivot: [0, 0, 0],
  distance: 15,
  pitch: -30,
  yaw: 30,
  maxDistance: 1e3,
  linearVelocity: 1,
  rotationalVelocity: 1,
  fieldOfView: 45
});

// controller/ortho.ts
var _OrthoController = class extends BaseController {
  kind = "ortho";
  projection = "orthographic";
  changed = false;
  params;
  position;
  orientation = new PitchRollYawOrientation();
  fov;
  mouseOrTouchMoving = false;
  constructor(input, params) {
    super(input);
    const { position, rotation, fieldOfView } = this.params = { ..._OrthoController.defaultParams, ...params };
    this.position = position;
    this.orientation.decomposeRotation(rotation);
    this.fov = fieldOfView;
  }
  serialize() {
    const { kind, position, orientation, fov } = this;
    const { rotation } = orientation;
    this.changed = false;
    return { kind, position, rotation, fovMeters: fov };
  }
  updateParams(params) {
    this.params = mergeRecursive(this.params, params);
    if (this.input.callbacks == this) {
      this.input.usePointerLock = this.params.usePointerLock;
    }
  }
  init(params) {
    const { kind, position, rotation, fovMeters, distance: distance4, fovDegrees } = params;
    console.assert(kind == this.kind);
    if (position) {
      this.position = position;
    }
    if (rotation) {
      this.orientation.decomposeRotation(rotation);
    }
    if (fovMeters) {
      this.fov = fovMeters;
    } else if (fovDegrees && distance4) {
      this.fov = _OrthoController.fovFromPerspective(fovDegrees, distance4);
    }
    this.changed = true;
    this.input.usePointerLock = this.params.usePointerLock;
    this.input.callbacks = this;
  }
  autoFit(center, radius) {
    const { orientation } = this;
    const dir = vec3_exports.fromValues(0, 0, radius);
    vec3_exports.transformQuat(dir, dir, orientation.rotation);
    this.position = vec3_exports.add(vec3_exports.create(), center, dir);
    this.orientation.pitch = -90;
    this.orientation.yaw = 0;
    this.orientation.roll = 0;
    this.fov = radius * 2;
    this.changed = true;
  }
  get moving() {
    return this.input.isAnyGestureKeyPressed() || this.input.isScrolling() || this.mouseOrTouchMoving;
  }
  async moveEnd(event) {
    this.mouseOrTouchMoving = false;
  }
  moveTo(targetPosition, flyTime = 1e3, rotation) {
    const { orientation, position } = this;
    if (flyTime) {
      let targetPitch = orientation.pitch;
      let targetYaw = orientation.yaw;
      if (rotation) {
        const { pitch, yaw } = decomposeRotation(rotation);
        targetPitch = pitch / Math.PI * 180;
        targetYaw = yaw / Math.PI * 180;
      }
      this.setFlyTo({
        totalFlightTime: flyTime,
        end: { pos: vec3_exports.clone(targetPosition), pitch: targetPitch, yaw: targetYaw },
        begin: { pos: vec3_exports.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
      });
    } else {
      this.position = targetPosition;
      if (rotation) {
        this.orientation.decomposeRotation(rotation);
      }
      this.changed = true;
    }
  }
  zoomTo(boundingSphere, flyTime = 1e3) {
    const { orientation, position, fov } = this;
    if (flyTime) {
      const dist4 = Math.max(boundingSphere.radius / Math.tan(common_exports.toRadian(fov) / 2), boundingSphere.radius);
      const targetPosition = vec3_exports.create();
      vec3_exports.add(targetPosition, vec3_exports.transformQuat(targetPosition, vec3_exports.fromValues(0, 0, dist4), orientation.rotation), boundingSphere.center);
      this.setFlyTo({
        totalFlightTime: flyTime,
        end: { pos: vec3_exports.clone(targetPosition), pitch: orientation.pitch, yaw: orientation.yaw + 0.05 },
        begin: { pos: vec3_exports.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
      });
    } else {
      const dist4 = boundingSphere.radius / Math.tan(common_exports.toRadian(fov) / 2);
      this.position = vec3_exports.add(vec3_exports.create(), vec3_exports.transformQuat(vec3_exports.create(), vec3_exports.fromValues(0, 0, dist4), orientation.rotation), boundingSphere.center);
      this.changed = true;
    }
  }
  update() {
    const { axes, zoomPos, height, position, orientation, hasShift, currentFlyTo } = this;
    if (currentFlyTo) {
      this.position = vec3_exports.clone(currentFlyTo.pos);
      orientation.pitch = currentFlyTo.pitch;
      orientation.yaw = currentFlyTo.yaw;
      this.changed = true;
      return;
    }
    let tx = -axes.keyboard_ad + axes.mouse_lmb_move_x + axes.mouse_rmb_move_x + axes.mouse_mmb_move_x + axes.touch_1_move_x;
    let ty = -axes.keyboard_ws + axes.mouse_lmb_move_y + axes.mouse_rmb_move_y + axes.mouse_mmb_move_y + axes.touch_1_move_y;
    const tz = axes.mouse_navigate * this.params.stepInterval + axes.touch_pinch3 * 0.1 + (hasShift ? axes.mouse_wheel * 0.01 : 0);
    const rz = axes.keyboard_qe;
    const zoom = (hasShift ? 0 : axes.mouse_wheel) + axes.touch_pinch2;
    const [zoomX, zoomY] = zoomPos;
    if (!this.mouseOrTouchMoving) {
      this.mouseOrTouchMoving = tx > 0.1 || ty > 0.1 || rz > 0.1;
    }
    if (rz) {
      orientation.roll += rz * 0.2;
      this.changed = true;
    }
    if (tx || ty || tz || zoom) {
      if (zoom != 0) {
        const dz = 1 + zoom / height;
        tx += zoomX * -zoom * 0.6;
        ty += zoomY * zoom * 0.6;
        this.fov *= dz;
      }
      const scale7 = this.fov / height;
      const deltaPos = vec3_exports.transformQuat(vec3_exports.create(), vec3_exports.fromValues(tx * scale7 * -1, ty * scale7, tz), orientation.rotation);
      this.position = vec3_exports.add(vec3_exports.create(), position, deltaPos);
      this.changed = true;
    }
  }
  stateChanges(state) {
    const changes = {};
    if (!state || state.position !== this.position) {
      changes.position = this.position;
    }
    if (!state || state.rotation !== this.orientation.rotation) {
      changes.rotation = this.orientation.rotation;
    }
    if (!state || state.fov !== this.fov) {
      changes.fov = this.fov;
    }
    if (!state) {
      changes.kind = "orthographic";
    }
    return changes;
  }
  //perspectiveDepth = BaseController.getDistanceFromViewPlane(pivot);
  static fovFromPerspective(perspectiveFov, perspectiveDepth) {
    return Math.max(0.1, perspectiveDepth) * Math.tan(Math.PI / 180 * perspectiveFov / 2) * 2;
  }
};
var OrthoController = _OrthoController;
__publicField(OrthoController, "defaultParams", {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  fieldOfView: 45,
  stepInterval: 1,
  usePointerLock: false
});

// controller/flight.ts
var _FlightController = class extends BaseController {
  constructor(pickInterface, input, params) {
    super(input);
    this.pickInterface = pickInterface;
    this.params = { ..._FlightController.defaultParams, ...params };
    const { orientation } = this;
    const { pitch, yaw, fieldOfView } = this.params;
    orientation.pitch = pitch;
    orientation.yaw = yaw;
    this.fov = fieldOfView;
  }
  kind = "flight";
  projection = "pinhole";
  changed = false;
  pivotButton = 2 /* right */;
  pivotFingers = 3;
  params;
  position = vec3_exports.create();
  orientation = new PitchRollYawOrientation();
  pivot;
  fov;
  resetPickDelay = 3e3;
  lastUpdatedMoveBegin = 0;
  lastUpdate = 0;
  recordedMoveBegin = void 0;
  inMoveBegin = false;
  mouseOrTouchMoving = false;
  serialize() {
    const { kind, position, orientation, fov } = this;
    const { rotation } = orientation;
    this.changed = false;
    return { kind, position, rotation, fovDegrees: fov };
  }
  init(params) {
    const { kind, position, rotation, fovDegrees } = params;
    console.assert(kind == this.kind);
    if (position) {
      this.position = position;
    }
    if (rotation) {
      this.orientation.decomposeRotation(rotation);
      this.orientation.roll = 0;
    }
    if (fovDegrees != void 0) {
      this.fov = fovDegrees;
    }
    this.changed = false;
    this.input.callbacks = this;
    this.input.usePointerLock = true;
  }
  autoFit(center, radius) {
    const { orientation } = this;
    const maxDistance = 1e3;
    const distance4 = Math.min(maxDistance, radius / Math.tan(common_exports.toRadian(this.fov) / 2));
    const dir = vec3_exports.fromValues(0, 0, distance4);
    vec3_exports.transformQuat(dir, dir, orientation.rotation);
    this.position = vec3_exports.add(vec3_exports.create(), center, dir);
  }
  updateParams(params) {
    this.params = mergeRecursive(this.params, params);
  }
  moveTo(targetPosition, flyTime = 1e3, rotation) {
    const { orientation, position } = this;
    if (flyTime) {
      let targetPitch = orientation.pitch;
      let targetYaw = orientation.yaw;
      if (rotation) {
        const { pitch, yaw } = decomposeRotation(rotation);
        targetPitch = pitch / Math.PI * 180;
        targetYaw = yaw / Math.PI * 180;
      }
      this.setFlyTo({
        totalFlightTime: flyTime,
        end: { pos: vec3_exports.clone(targetPosition), pitch: targetPitch, yaw: targetYaw },
        begin: { pos: vec3_exports.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
      });
    } else {
      this.position = targetPosition;
      if (rotation) {
        this.orientation.decomposeRotation(rotation);
      }
      this.changed = true;
    }
  }
  zoomTo(boundingSphere, flyTime = 1e3) {
    const { orientation, position, fov } = this;
    if (flyTime) {
      const dist4 = Math.max(boundingSphere.radius / Math.tan(common_exports.toRadian(fov) / 2), boundingSphere.radius);
      const targetPosition = vec3_exports.create();
      vec3_exports.add(targetPosition, vec3_exports.transformQuat(targetPosition, vec3_exports.fromValues(0, 0, dist4), orientation.rotation), boundingSphere.center);
      this.setFlyTo({
        totalFlightTime: flyTime,
        end: { pos: vec3_exports.clone(targetPosition), pitch: orientation.pitch, yaw: orientation.yaw + 0.05 },
        begin: { pos: vec3_exports.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
      });
    } else {
      const dist4 = boundingSphere.radius / Math.tan(common_exports.toRadian(fov) / 2);
      this.position = vec3_exports.add(vec3_exports.create(), vec3_exports.transformQuat(vec3_exports.create(), vec3_exports.fromValues(0, 0, dist4), orientation.rotation), boundingSphere.center);
      this.changed = true;
    }
  }
  modifiers() {
    const { params, recordedMoveBegin, position, fov } = this;
    const { proportionalCameraSpeed } = params;
    let scale7 = 20;
    if (proportionalCameraSpeed && recordedMoveBegin) {
      scale7 = vec3_exports.dist(position, recordedMoveBegin) * Math.tan(Math.PI / 180 * fov / 2) * 2;
      const mouseWheelModifier = this.input.hasShift ? 0 : clamp(scale7 / 3, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
      const mousePanModifier = clamp(scale7, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
      const touchMovementModifier = clamp(scale7, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
      const pinchModifier = clamp(scale7, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
      return {
        mouseWheelModifier,
        mousePanModifier,
        touchMovementModifier,
        pinchModifier,
        scale: 20
      };
    }
    return {
      mouseWheelModifier: this.input.hasShift ? 0 : scale7,
      mousePanModifier: scale7,
      touchMovementModifier: scale7,
      pinchModifier: scale7,
      scale: scale7
    };
  }
  getTransformations() {
    const { axes } = this;
    const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_lmb_move_y + axes.touch_1_move_y;
    const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_lmb_move_x + axes.touch_1_move_x;
    const pivotX = -axes.mouse_rmb_move_y + -axes.touch_3_move_y;
    const pivotY = -axes.mouse_rmb_move_x + -axes.touch_3_move_x;
    const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);
    const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale: scale7 } = this.modifiers();
    const tx = axes.keyboard_ad * scale7 - axes.mouse_mmb_move_x * mousePanModifier - axes.touch_2_move_x * touchMovementModifier;
    const ty = axes.keyboard_qe * scale7 - axes.mouse_mmb_move_y * mousePanModifier - axes.touch_2_move_y * touchMovementModifier;
    const tz = axes.keyboard_ws * scale7 + axes.mouse_wheel * mouseWheelModifier + axes.touch_pinch2 * pinchModifier;
    const rx = shouldPivot ? pivotX : rotX;
    const ry = shouldPivot ? pivotY : rotY;
    return { tx, ty, tz, rx, ry, shouldPivot };
  }
  update() {
    const { multiplier, orientation, params, height, pivot, zoomPos, currentFlyTo } = this;
    if (currentFlyTo) {
      this.position = vec3_exports.clone(currentFlyTo.pos);
      orientation.pitch = currentFlyTo.pitch;
      orientation.yaw = currentFlyTo.yaw;
      this.changed = true;
      return;
    }
    this.lastUpdate = performance.now();
    let { tx, ty, tz, rx, ry, shouldPivot } = this.getTransformations();
    if (!this.mouseOrTouchMoving) {
      this.mouseOrTouchMoving = tx > 0.1 || ty > 0.1 || rx > 0.1 || ry > 0.1;
    }
    orientation.roll = 0;
    const [zoomX, zoomY] = zoomPos;
    if (rx || ry) {
      const rotationalVelocity = (shouldPivot ? 180 : this.fov) * params.rotationalVelocity / height;
      orientation.pitch += rx * rotationalVelocity;
      orientation.yaw += ry * rotationalVelocity;
      if (pivot && shouldPivot && pivot.active) {
        const { center, offset, distance: distance4 } = pivot;
        const pos = vec3_exports.fromValues(0, 0, distance4);
        vec3_exports.add(pos, pos, offset);
        vec3_exports.transformQuat(pos, pos, orientation.rotation);
        this.position = vec3_exports.add(vec3_exports.create(), center, pos);
      }
      this.changed = true;
    }
    if (tx || ty || tz) {
      if (tz != 0) {
        tx += zoomX * tz * 0.6;
        ty += -zoomY * tz * 0.6;
      }
      const linearVelocity = multiplier * params.linearVelocity / height;
      const worldPosDelta = vec3_exports.transformQuat(vec3_exports.create(), vec3_exports.fromValues(tx * linearVelocity, -ty * linearVelocity, tz * linearVelocity), orientation.rotation);
      this.position = vec3_exports.add(vec3_exports.create(), this.position, worldPosDelta);
      if (pivot && pivot.active) {
        this.setPivot(pivot.center, pivot.active);
      }
      this.changed = true;
    }
  }
  stateChanges(state) {
    const changes = {};
    const { position, orientation, pivot, fov } = this;
    if (!state || !vec3_exports.exactEquals(state.position, position)) {
      changes.position = position;
    }
    if (!state || !quat_exports.exactEquals(state.rotation, orientation.rotation)) {
      changes.rotation = orientation.rotation;
    }
    if (!state || pivot && state.pivot && vec3_exports.exactEquals(state.pivot, pivot?.center)) {
      changes.pivot = pivot?.center;
    }
    if (!state || state.fov !== fov) {
      changes.fov = fov;
    }
    if (!state) {
      changes.kind = "pinhole";
    }
    return changes;
  }
  async mouseButtonChanged(event) {
    const { pickInterface, pivotButton } = this;
    if (pickInterface) {
      const changes = event.buttons;
      if (changes & pivotButton) {
        const sample = await pickInterface.pick(event.offsetX, event.offsetY);
        if (sample) {
          this.setPivot(sample.position, true);
        } else {
          this.resetPivot(true);
        }
      } else {
        this.resetPivot(false);
      }
    }
  }
  async touchChanged(event) {
    const { pointerTable, pickInterface, pivotFingers } = this;
    if (pointerTable.length == pivotFingers && pickInterface) {
      const x = pointerTable.length > 1 ? Math.round((pointerTable[0].x + pointerTable[1].x) / 2) : pointerTable[0].x;
      const y = pointerTable.length > 1 ? Math.round((pointerTable[0].y + pointerTable[1].y) / 2) : pointerTable[0].y;
      const sample = await pickInterface.pick(x, y);
      if (sample) {
        this.setPivot(sample.position, true);
      } else {
        this.resetPivot(true);
      }
    } else {
      this.resetPivot(false);
    }
  }
  get moving() {
    return this.input.isAnyGestureKeyPressed() || this.input.isScrolling() || this.mouseOrTouchMoving;
  }
  async moveEnd(event) {
    this.mouseOrTouchMoving = false;
  }
  async moveBegin(event) {
    const { pointerTable, pickInterface, resetPickDelay } = this;
    const deltaTime = this.lastUpdate - this.lastUpdatedMoveBegin;
    if (pickInterface == void 0 || deltaTime < this.params.pickDelay || this.inMoveBegin) {
      return;
    }
    this.inMoveBegin = true;
    const setPickPosition = async (x, y) => {
      const sample = await pickInterface.pick(x, y, { async: false });
      if (sample) {
        this.recordedMoveBegin = sample.position;
        this.lastUpdatedMoveBegin = performance.now();
      } else if (resetPickDelay < deltaTime) {
        this.recordedMoveBegin = void 0;
        this.lastUpdatedMoveBegin = performance.now();
      }
    };
    if (isTouchEvent(event)) {
      if (pointerTable.length > 1) {
        await setPickPosition(Math.round((pointerTable[0].x + pointerTable[1].x) / 2), Math.round((pointerTable[0].y + pointerTable[1].y) / 2));
      }
    } else {
      await setPickPosition(event.offsetX, event.offsetY);
    }
    this.inMoveBegin = false;
  }
  resetPivot(active) {
    const { pivot } = this;
    if (pivot) {
      this.setPivot(pivot.center, active);
    }
  }
  setPivot(center, active) {
    const { position, orientation } = this;
    const distance4 = vec3_exports.distance(center, position);
    const offset = vec3_exports.fromValues(0, 0, distance4);
    vec3_exports.transformQuat(offset, offset, orientation.rotation);
    vec3_exports.add(offset, center, offset);
    vec3_exports.sub(offset, position, offset);
    const invRot = quat_exports.invert(quat_exports.create(), orientation.rotation);
    vec3_exports.transformQuat(offset, offset, invRot);
    this.pivot = { center, offset, distance: distance4, active };
  }
};
var FlightController = _FlightController;
__publicField(FlightController, "defaultParams", {
  position: [0, 0, 0],
  pitch: -30,
  yaw: 30,
  linearVelocity: 1,
  rotationalVelocity: 1,
  autoZoomSpeed: false,
  flightTime: 1,
  fieldOfView: 60,
  pickDelay: 200,
  proportionalCameraSpeed: { min: 0.2, max: 1e3 }
});
function isTouchEvent(event) {
  return "TouchEvent" in globalThis && event instanceof TouchEvent;
}
var CadMiddlePanController = class extends FlightController {
  constructor(pickInterface, input, params) {
    super(pickInterface, input);
    this.pickInterface = pickInterface;
    this.pivotButton = 1 /* left */;
    this.pivotFingers = 1;
  }
  kind = "cadMiddlePan";
  getTransformations() {
    const { axes } = this;
    const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_rmb_move_y + axes.touch_3_move_y;
    const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_rmb_move_x + axes.touch_3_move_x;
    const pivotX = -axes.mouse_lmb_move_y + -axes.touch_1_move_y;
    const pivotY = -axes.mouse_lmb_move_x + -axes.touch_1_move_x;
    const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);
    const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale: scale7 } = this.modifiers();
    const tx = axes.keyboard_ad * scale7 - axes.mouse_mmb_move_x * mousePanModifier - axes.touch_2_move_x * touchMovementModifier;
    const ty = axes.keyboard_qe * scale7 - axes.mouse_mmb_move_y * mousePanModifier - axes.touch_2_move_y * touchMovementModifier;
    const tz = axes.keyboard_ws * scale7 + axes.mouse_wheel * mouseWheelModifier + axes.touch_pinch2 * pinchModifier;
    const rx = shouldPivot ? pivotX : rotX;
    const ry = shouldPivot ? pivotY : rotY;
    return { tx, ty, tz, rx, ry, shouldPivot };
  }
};
var CadRightPanController = class extends FlightController {
  constructor(pickInterface, input, params) {
    super(pickInterface, input);
    this.pickInterface = pickInterface;
    this.pivotButton = 1 /* left */;
    this.pivotFingers = 1;
  }
  kind = "cadRightPan";
  getTransformations() {
    const { axes } = this;
    const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_mmb_move_y + axes.touch_3_move_y;
    const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_mmb_move_x + axes.touch_3_move_x;
    const pivotX = -axes.mouse_lmb_move_y + -axes.touch_1_move_y;
    const pivotY = -axes.mouse_lmb_move_x + -axes.touch_1_move_x;
    const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);
    const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale: scale7 } = this.modifiers();
    const tx = axes.keyboard_ad * scale7 - axes.mouse_rmb_move_x * mousePanModifier - axes.touch_2_move_x * touchMovementModifier;
    const ty = axes.keyboard_qe * scale7 - axes.mouse_rmb_move_y * mousePanModifier - axes.touch_2_move_y * touchMovementModifier;
    const tz = axes.keyboard_ws * scale7 + axes.mouse_wheel * mouseWheelModifier + axes.touch_pinch2 * pinchModifier;
    const rx = shouldPivot ? pivotX : rotX;
    const ry = shouldPivot ? pivotY : rotY;
    return { tx, ty, tz, rx, ry, shouldPivot };
  }
};
var SpecialFlightController = class extends FlightController {
  constructor(pickInterface, input, params) {
    super(pickInterface, input);
    this.pickInterface = pickInterface;
    this.pivotButton = 4 /* middle */;
    this.pivotFingers = 1;
  }
  kind = "special";
  getTransformations() {
    const { axes } = this;
    const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_rmb_move_y + axes.touch_3_move_y;
    const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_rmb_move_x + axes.touch_3_move_x;
    const pivotX = -axes.mouse_mmb_move_y + -axes.touch_1_move_y;
    const pivotY = -axes.mouse_mmb_move_x + -axes.touch_1_move_x;
    const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);
    const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale: scale7 } = this.modifiers();
    const tx = axes.keyboard_ad * scale7 - axes.mouse_lmb_move_x * mousePanModifier - axes.touch_2_move_x * touchMovementModifier;
    const ty = axes.keyboard_qe * scale7 - axes.mouse_lmb_move_y * mousePanModifier - axes.touch_2_move_y * touchMovementModifier;
    const tz = axes.keyboard_ws * scale7 + axes.mouse_wheel * mouseWheelModifier + axes.touch_pinch2 * pinchModifier;
    const rx = shouldPivot ? pivotX : rotX;
    const ry = shouldPivot ? pivotY : rotY;
    return { tx, ty, tz, rx, ry, shouldPivot };
  }
};

// controller/panorama.ts
var _PanoramaController = class extends BaseController {
  kind = "panorama";
  projection = "pinhole";
  changed = false;
  params;
  position = vec3_exports.create();
  orientation = new PitchRollYawOrientation();
  fov;
  constructor(input, params) {
    super(input);
    this.params = { ..._PanoramaController.defaultParams, ...params };
    const { orientation } = this;
    const { pitch, yaw, fieldOfView } = this.params;
    orientation.pitch = pitch;
    orientation.yaw = yaw;
    this.fov = fieldOfView;
  }
  serialize() {
    const { kind, position, orientation, fov } = this;
    const { rotation } = orientation;
    this.changed = false;
    return { kind, position, rotation, fovDegrees: fov };
  }
  updateParams(params) {
    this.params = mergeRecursive(this.params, params);
  }
  init(params) {
    const { kind, position, rotation, fovDegrees } = params;
    console.assert(kind == this.kind);
    if (position) {
      this.position = position;
    }
    if (rotation) {
      this.orientation.decomposeRotation(rotation);
      this.orientation.roll = 0;
    }
    if (fovDegrees != void 0) {
      this.fov = fovDegrees;
    }
    this.changed = false;
    this.input.callbacks = this;
    this.input.usePointerLock = true;
    this.attach();
  }
  autoFit(center, radius) {
    const { orientation } = this;
    const maxDistance = 1e3;
    const distance4 = Math.min(maxDistance, radius / Math.tan(common_exports.toRadian(this.fov) / 2));
    const dir = vec3_exports.fromValues(0, 0, distance4);
    vec3_exports.transformQuat(dir, dir, orientation.rotation);
    this.position = vec3_exports.add(vec3_exports.create(), center, dir);
  }
  moveTo(targetPosition, flyTime = 1e3, rotation) {
    const { orientation, position } = this;
    if (flyTime) {
      let targetPitch = orientation.pitch;
      let targetYaw = orientation.yaw;
      if (rotation) {
        const { pitch, yaw } = decomposeRotation(rotation);
        targetPitch = pitch / Math.PI * 180;
        targetYaw = yaw / Math.PI * 180;
      }
      this.setFlyTo({
        totalFlightTime: flyTime,
        end: { pos: vec3_exports.clone(targetPosition), pitch: targetPitch, yaw: targetYaw },
        begin: { pos: vec3_exports.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
      });
    } else {
      this.position = targetPosition;
      if (rotation) {
        this.orientation.decomposeRotation(rotation);
      }
      this.changed = true;
    }
  }
  update() {
    const { axes, orientation, params, height, fov, currentFlyTo } = this;
    if (currentFlyTo) {
      this.position = vec3_exports.clone(currentFlyTo.pos);
      orientation.pitch = currentFlyTo.pitch;
      orientation.yaw = currentFlyTo.yaw;
      this.changed = true;
      return;
    }
    const tz = axes.keyboard_ws + axes.mouse_wheel + axes.touch_pinch2;
    const rx = -axes.keyboard_arrow_up_down / 5 - axes.mouse_lmb_move_y + axes.touch_1_move_y;
    const ry = -axes.keyboard_arrow_left_right / 5 - axes.mouse_lmb_move_x + axes.touch_1_move_x;
    orientation.roll = 0;
    if (rx || ry) {
      const rotationalVelocity = this.fov * params.rotationalVelocity / height;
      orientation.pitch += rx * rotationalVelocity;
      orientation.yaw += ry * rotationalVelocity;
      this.changed = true;
    }
    if (tz) {
      const dz = 1 + tz / height;
      this.fov = Math.max(Math.min(60, fov * dz), 0.1);
      this.changed = true;
    }
  }
  stateChanges(state) {
    const changes = {};
    const { position, orientation, fov } = this;
    if (!state || state.position !== position) {
      changes.position = position;
    }
    if (!state || state.rotation !== orientation.rotation) {
      changes.rotation = orientation.rotation;
    }
    if (!state || state.fov !== fov) {
      changes.fov = fov;
    }
    if (!state) {
      changes.kind = "pinhole";
    }
    return changes;
  }
};
var PanoramaController = _PanoramaController;
__publicField(PanoramaController, "defaultParams", {
  position: [0, 0, 0],
  pitch: -30,
  yaw: 30,
  rotationalVelocity: 1,
  fieldOfView: 60
});

// flip.ts
var transforms = {
  GLToCAD: flipFuncs(flipGLtoCadVec, flipGLtoCadQuat),
  CADToGL: flipFuncs(flipCADToGLVec, flipCADToGLQuat)
};
function flipState(changes, transform) {
  flipRecursive(changes, transforms[transform]);
}
function flipFuncs(swapVecFunc, swapQuatFunc) {
  const state = {
    camera: {
      position: swapVecFunc,
      rotation: swapQuatFunc,
      pivot: swapVecFunc
    },
    grid: {
      origin: swapVecFunc,
      axisX: swapVecFunc,
      axisY: swapVecFunc
    },
    cube: {
      position: swapVecFunc
    },
    clipping: {
      planes: flipArray(swapVecFunc)
    },
    outlines: {
      plane: swapVecFunc
    },
    scene: {
      config: {
        center: swapVecFunc,
        offset: swapVecFunc,
        boundingSphere: {
          center: swapVecFunc
        },
        aabb: {
          min: swapVecFunc,
          max: swapVecFunc
        }
      }
    },
    dynamic: {
      objects: flipDynaicObjects(swapVecFunc, swapQuatFunc)
    }
  };
  return state;
}
function flipCADToGLVec(v) {
  const clone7 = [...v];
  const tmp = clone7[1];
  clone7[1] = clone7[2];
  clone7[2] = -tmp;
  return clone7;
}
function flipGLtoCadVec(v) {
  const clone7 = [...v];
  const tmp = clone7[1];
  clone7[1] = -clone7[2];
  clone7[2] = tmp;
  return clone7;
}
function flipCADToGLQuat(b) {
  let ax = -0.7071067811865475, aw = 0.7071067811865475;
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return quat_exports.fromValues(
    ax * bw + aw * bx,
    aw * by + -ax * bz,
    aw * bz + ax * by,
    aw * bw - ax * bx
  );
}
function flipGLtoCadQuat(b) {
  let ax = 0.7071067811865475, aw = 0.7071067811865475;
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return quat_exports.fromValues(
    ax * bw + aw * bx,
    aw * by + -ax * bz,
    aw * bz + ax * by,
    aw * bw - ax * bx
  );
}
function flipDynaicObjects(swapVecFunc, swapQuatFunc) {
  return function(ar) {
    const flippedObjects = [];
    for (const obj of ar) {
      const flippedInstances = [];
      for (const inst of obj.instances) {
        flippedInstances.push({
          position: swapVecFunc(inst.position),
          rotation: inst.rotation ? swapQuatFunc(inst.rotation) : void 0
        });
      }
      flippedObjects.push({ mesh: obj.mesh, instances: flippedInstances, baseObjectId: obj.baseObjectId });
    }
    return flippedObjects;
  };
}
function flipArray(swapFunc) {
  return function(ar) {
    const flippedPlanes = [];
    for (const plane of ar) {
      flippedPlanes.push({ color: plane.color, normalOffset: swapFunc(plane.normalOffset) });
    }
    return flippedPlanes;
  };
}
function flipRecursive(state, funcs) {
  for (const key in state) {
    const func = funcs ? funcs[key] : void 0;
    const value = state[key];
    if (func && value) {
      if (typeof func == "function") {
        state[key] = func(value);
      } else {
        flipRecursive(value, func);
      }
    }
  }
}

// view.ts
var View = class {
  constructor(canvas, deviceProfile) {
    this.canvas = canvas;
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
      cadMiddlePan: new CadMiddlePanController(this, input),
      cadRightPan: new CadRightPanController(this, input),
      special: new SpecialFlightController(this, input)
    };
    this.activeController = this.controllers["flight"];
    this.activeController.attach();
    const resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    resizeObserver.observe(canvas);
  }
  scriptUrl = document.currentScript?.src ?? import.meta.url;
  alternateUrl = new URL("https://blobs.novorender.com/").toString();
  // sas key, sans "?"
  renderContext;
  _deviceProfile;
  _setDeviceProfile;
  renderStateGL;
  renderStateCad;
  prevRenderStateCad;
  stateChanges;
  screenshot = null;
  //* @internal */
  controllers;
  //* @internal */
  activeController;
  //* @internal */
  clippingPlanes = [];
  _statistics = void 0;
  // dynamic resolution scaling
  resolutionModifier = 1;
  drsHighInterval = 50;
  drsLowInterval = 100;
  lastQualityAdjustTime = 0;
  resolutionTier = 2;
  currentDetailBias = 1;
  dispose() {
    this.renderContext?.dispose();
    this.renderContext = void 0;
  }
  updateChanges(changes) {
    this.prevRenderStateCad = this.renderStateCad;
    this.renderStateCad = mergeRecursive(this.renderStateCad, changes);
    flipState(changes, "CADToGL");
    this.renderStateGL = modifyRenderState(this.renderStateGL, changes);
  }
  createRenderState(state) {
    const clone7 = structuredClone(state);
    flipState(clone7, "GLToCAD");
    return clone7;
  }
  async getScreenshot() {
    this.screenshot = void 0;
    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    while (this.screenshot === void 0) {
      await delay(50);
    }
    return this.screenshot;
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
  get deviceProfile() {
    return this._deviceProfile;
  }
  set deviceProfile(value) {
    this._deviceProfile = value;
    this._setDeviceProfile?.(value);
  }
  setRenderContext = (context) => {
    this.renderContext = context;
    this.useDeviceProfile(this._deviceProfile);
  };
  useDeviceProfile(deviceProfile) {
    this.resolutionModifier = deviceProfile.renderResolution;
    this.drsHighInterval = 1e3 / deviceProfile.framerateTarget * 1.2;
    this.drsLowInterval = 1e3 / deviceProfile.framerateTarget * 0.9;
  }
  resize() {
    const scale7 = devicePixelRatio * this.resolutionModifier;
    let { width, height } = this.canvas.getBoundingClientRect();
    width = Math.round(width * scale7);
    height = Math.round(height * scale7);
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
  async availableEnvironments(indexUrl) {
    let environments = [];
    const url = new URL(indexUrl ?? "/assets/env/index.json", this.scriptUrl);
    const response = await fetch(url.toString());
    if (response.ok) {
      const json = await response.json();
      environments = json.map((name) => {
        return { name, url: new URL(name, url).toString() + "/", thumnbnailURL: new URL(`thumbnails/${name}.png`, url).toString() };
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
  async loadSceneFromURL(url) {
    const scene = await downloadScene(url.toString());
    const stateChanges = { scene };
    flipState(stateChanges, "GLToCAD");
    this.modifyRenderState(stateChanges);
    return scene.config;
  }
  async pick(x, y, options) {
    const context = this.renderContext;
    if (context) {
      const samples = await context.pick(x, y, options);
      if (samples.length) {
        let isEdge = false;
        const centerSample = samples.reduce((a, b) => {
          if (!isEdge && vec3_exports.dot(a.normal, b.normal) < 0.8) {
            isEdge = true;
          }
          return a.depth < b.depth ? a : b;
        });
        const { viewWorldMatrixNormal } = context.getViewMatrices();
        const invNormalMatrix = mat3_exports.invert(mat3_exports.create(), viewWorldMatrixNormal);
        const flippedSample = {
          ...centerSample,
          position: vec3_exports.fromValues(centerSample.position[0], -centerSample.position[2], centerSample.position[1]),
          normal: vec3_exports.fromValues(centerSample.normal[0], -centerSample.normal[2], centerSample.normal[1]),
          isEdge: samples.length > 1 ? isEdge : void 0,
          normalVS: vec3_exports.transformMat3(vec3_exports.create(), centerSample.normal, invNormalMatrix)
        };
        return flippedSample;
      }
    }
    return void 0;
  }
  async switchCameraController(kind, initState, options) {
    const autoInit = options?.autoInit ?? false;
    function isControllerKind(kind2, controllers2) {
      return kind2 in controllers2;
    }
    if (!isControllerKind(kind, this.controllers))
      throw new Error(`Unknown controller kind: ${kind}!`);
    const { controllers, renderContext } = this;
    let { activeController } = this;
    let distance4;
    if (autoInit && renderContext && renderContext.prevState) {
      renderContext.renderPickBuffers();
      const pick = (await renderContext.buffers.pickBuffers()).pick;
      const depths = await renderContext.getLinearDepths(pick);
      distance4 = Number.MAX_VALUE;
      for (const depth of depths) {
        distance4 = Math.min(distance4, depth);
      }
    }
    const prevState = activeController.serialize(
      true
      /* include derived properties as well */
    );
    activeController = this.activeController = controllers[kind];
    const { position, rotation, pivot, fovDegrees, fovMeters } = prevState;
    activeController.init({ kind, position: initState?.position ?? position, rotation: initState?.rotation ?? rotation, pivot, distance: distance4, fovDegrees, fovMeters: initState?.fov ?? fovMeters });
    const changes = activeController.stateChanges();
    this.modifyRenderState({ camera: changes });
  }
  /** @internal */
  dynamicResolutionScaling(frameIntervals) {
    const samples = 9;
    if (frameIntervals.length == samples) {
      const { deviceProfile } = this;
      const highFrameInterval = this.drsHighInterval;
      const lowFrameInterval = this.drsLowInterval;
      const sortedIntervals = [...frameIntervals];
      sortedIntervals.sort();
      const medianInterval = sortedIntervals[Math.floor(samples / 2)];
      frameIntervals.splice(0, 1);
      const cooldown = 3e3;
      const now = performance.now();
      if (now > this.lastQualityAdjustTime + cooldown) {
        const resolutionTiers = [0.4, 0.6, 1];
        if (medianInterval > highFrameInterval) {
          if (this.resolutionTier != 0) {
            this.resolutionModifier = deviceProfile.renderResolution * resolutionTiers[--this.resolutionTier];
            this.resize();
          }
          this.lastQualityAdjustTime = now;
          return;
        } else if (medianInterval < lowFrameInterval) {
          if (this.resolutionTier != 2) {
            this.resolutionModifier = deviceProfile.renderResolution * resolutionTiers[++this.resolutionTier];
            this.lastQualityAdjustTime = now;
            this.resize();
          }
          return;
        }
      }
    }
  }
  async run() {
    let prevState;
    let pickRenderState;
    let prevRenderTime = performance.now();
    let wasCameraMoving = false;
    let idleFrameTime = 0;
    let wasIdle = false;
    const frameIntervals = [];
    for (; ; ) {
      const { renderContext, activeController, deviceProfile } = this;
      const renderTime = await RenderContext.nextFrame(renderContext);
      const frameTime = renderTime - prevRenderTime;
      const cameraChanges = activeController.renderStateChanges(this.renderStateCad.camera, renderTime - prevRenderTime);
      if (cameraChanges) {
        this.modifyRenderState(cameraChanges);
      }
      const isIdleFrame = idleFrameTime > 500;
      if (renderContext && !renderContext.isContextLost()) {
        renderContext.poll();
        renderContext.isIdleFrame = isIdleFrame;
        if (isIdleFrame) {
          if (!wasIdle) {
            this.resolutionModifier = Math.min(1, deviceProfile.renderResolution * 2);
            this.resize();
            this.modifyRenderState({ quality: { detail: 1 } });
            this.currentDetailBias = 1;
            wasIdle = true;
            if (pickRenderState && renderContext.isRendering()) {
              renderContext.renderPickBuffers();
              pickRenderState = void 0;
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
          this.stateChanges = void 0;
        }
        const { renderStateGL, screenshot } = this;
        if (prevState !== renderStateGL || renderContext.changed || screenshot === void 0) {
          prevState = renderStateGL;
          this.render?.(isIdleFrame);
          const statsPromise = renderContext.render(renderStateGL);
          if (screenshot === void 0) {
            this.screenshot = this.canvas.toDataURL();
          }
          statsPromise.then((stats) => {
            this._statistics = { render: stats, view: { resolution: this.resolutionModifier, detailBias: deviceProfile.detailBias * this.currentDetailBias, fps: stats.frameInterval ? 1e3 / stats.frameInterval : void 0 } };
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
  modifyRenderState(changes) {
    this.stateChanges = mergeRecursive(this.stateChanges, changes);
  }
};

// serviceWorker/helper.ts
var ServiceWorkerHelper = class {
  constructor(binaryAssetRegex, cache, root) {
    this.binaryAssetRegex = binaryAssetRegex;
    this.cache = cache;
    this.root = root;
  }
  _port;
  _reads = new PromiseBag();
  handleConnectMessage(message) {
    const { data } = message;
    switch (data.kind) {
      case "connect": {
        const { port } = data;
        this._port = port;
        port.onmessage = this.handleIOMessage.bind(this);
        console.log("sw connected!");
        break;
      }
    }
  }
  handleIOMessage(message) {
    const { data } = message;
    switch (data.kind) {
      case "read": {
        const { id, buffer, error } = data;
        this._reads.resolve(id, buffer ?? new Error(error));
        break;
      }
    }
  }
  isAsset(url) {
    return this.binaryAssetRegex.test(new URL(url).pathname);
  }
  getDirAndFile(url) {
    const m = this.binaryAssetRegex.exec(url.pathname);
    if (!m)
      throw new Error(`Invalid URL pathname: ${url.pathname}`);
    const [_, dir, file] = m;
    return { dir, file };
  }
  async fetch(request2) {
    const url = new URL(request2.url);
    const { dir, file } = this.getDirAndFile(url);
    const body = await this.readFile(dir, file);
    if (body) {
      return new Response(body, { status: 200, headers: { "Content-Type": "application/octet-stream" } });
    } else {
    }
    console.log(`fetch ${url}`);
    return await fetch(request2);
  }
  async readFile(dir, filename) {
    try {
      if (this.root) {
        const folder = await this.root.getDirectoryHandle(dir, { create: false });
        const fileHandle = await folder.getFileHandle(filename, { create: false });
        const file = await fileHandle.getFile();
        return file.stream();
      } else {
        const { _port, _reads } = this;
        if (_port) {
          const id = _reads.newId();
          const msg = { kind: "read", id, dir, file: filename };
          _port?.postMessage(msg);
          return await _reads.create(id);
        }
      }
    } catch (ex) {
    }
  }
};

// serviceWorker/promiseBag.ts
var PromiseBag = class {
  promises = /* @__PURE__ */ new Map();
  currentId = 0;
  newId() {
    const id = this.currentId++;
    this.currentId &= 65535;
    return id;
  }
  create(id) {
    return new Promise((resolve, reject) => {
      this.promises.set(id, { resolve, reject });
    });
  }
  resolve(id, result) {
    const { promises } = this;
    const pendingPromise = promises.get(id);
    if (pendingPromise) {
      promises.delete(id);
      const { resolve, reject } = pendingPromise;
      if (!isError(result)) {
        resolve(result);
      } else {
        reject(result);
      }
    }
  }
};
function isError(result) {
  return result && typeof result == "object" && result instanceof Error;
}

// index.ts
var packageVersion = "0.1.10";
common_exports.setMatrixArrayType(Array);
export {
  BaseController,
  Benchmark,
  CadMiddlePanController,
  CadRightPanController,
  ClippingId,
  ClippingMode,
  ControllerInput,
  CoordSpace,
  CubeId,
  FillrateProfiler,
  FlightController,
  MouseButtons,
  OrbitController,
  OrthoController,
  PanoramaController,
  PointrateProfiler,
  PromiseBag,
  RenderContext,
  ServiceWorkerHelper,
  SpecialFlightController,
  TonemappingMode,
  View,
  computeRotation,
  createColorSetHighlight,
  createDefaultModules,
  createHSLATransformHighlight,
  createNeutralHighlight,
  createRGBATransformHighlight,
  createRandomInstances,
  createTestCube,
  createTestSphere,
  createTransparentHighlight,
  defaultRenderState,
  downloadScene,
  getDeviceProfile,
  initCore3D,
  loadGLTF,
  mergeRecursive,
  modifyRenderState,
  packageVersion,
  rotationFromDirection
};
//# sourceMappingURL=index.js.map
