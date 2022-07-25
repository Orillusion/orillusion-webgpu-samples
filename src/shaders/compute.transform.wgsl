@group(0) @binding(0) var<storage, read> modelView: array<mat4x4<f32>>;
@group(0) @binding(1) var<storage, read> projection : mat4x4<f32>;
@group(0) @binding(2) var<storage, read_write> mvp : array<mat4x4<f32>>;
@group(0) @binding(3) var<uniform> count : u32;

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    // Guard against out-of-bounds work group sizes
    let index = global_id.x;
    if (index >= count) {
        return;
    }

    mvp[index] = projection * modelView[index];
}