const std = @import("std");

// const page_size = 65536; // in bytes

pub fn build(b: *std.build.Builder) void {
    const mode = b.standardReleaseOptions();
    const target = b.standardTargetOptions(.{});

    const exe = b.addExecutable("test-exe", "src/test.zig");
    exe.setTarget(target);
    exe.setBuildMode(mode);
    exe.install();

    const lib = b.addSharedLibrary("_float16", "src/float16.zig", .unversioned);
    lib.setTarget(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
        .abi = .musl,
    });
    lib.setBuildMode(.ReleaseSmall);
    // lib.import_memory = true; // import linear memory from the environment
    // lib.initial_memory = 1024 * page_size; // initial size of the linear memory (1 page = 64kB)
    // lib.max_memory = 1024 * page_size; // maximum size of the linear memory
    // lib.global_base = 6560; // offset in linear memory to place global data
    lib.setOutputDir(".");
    lib.install();

    const run_cmd = exe.run();
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const wasm_step = b.step("wasm", "Compiles zig to wasm.");
    wasm_step.dependOn(&lib.step);

    const run_step = b.step("run", "Run main");
    run_step.dependOn(&run_cmd.step);

    const tests = b.addTest("src/test.zig");
    tests.setTarget(target);
    tests.setBuildMode(mode);

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&tests.step);
}
