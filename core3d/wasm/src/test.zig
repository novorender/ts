const std = @import("std");
const conv = @import("main.zig");
const testing = std.testing;

test "float 16/32 conversions" {
    const val_f32: f32 = 3.141592653589793; // original float32 value
    const val_f16: f16 = @as(f16, val_f32); // cast to float16
    const val_u16: u16 = @bitCast(u16, val_f16); // bitcast to u16
    try testing.expect(conv.float16(val_f32) == val_u16);
    try testing.expect(conv.float32(val_u16) == val_f16);
    try testing.expect(conv.float16(conv.float32(val_u16)) == val_u16);
}
