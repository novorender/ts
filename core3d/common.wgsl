struct CameraUniforms {
    clipViewMatrix: mat4x4<f32>,
    viewClipMatrix: mat4x4<f32>,
    localViewMatrix: mat4x4<f32>,
    viewLocalMatrix: mat4x4<f32>,
    localViewMatrixNormal: mat3x3<f32>,
    viewLocalMatrixNormal: mat3x3<f32>,
    viewSize: vec2f,
    near: f32, // near clipping plane distance
}