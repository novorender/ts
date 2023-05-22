pub export fn float16(v: f32) u16 {
    return @bitCast(u16, @floatCast(f16, v));
}

pub export fn float32(v: u16) f32 {
    return @floatCast(f32, @bitCast(f16, v));
}
