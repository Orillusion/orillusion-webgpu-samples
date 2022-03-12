@group(0) @binding(0) var<uniform> color : vec4<f32>;

@stage(fragment)
fn main() -> @location(0) vec4<f32> {
    return color;
}