@stage(vertex)
fn main(@location(0) position : vec4<f32>) -> @builtin(position) vec4<f32> {
    return position;
}