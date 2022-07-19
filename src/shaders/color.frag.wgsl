@group(0) @binding(0) var<uniform> color : vec4<f32>;

@fragment
fn main() -> @location(0) vec4<f32> {
    return color;
}