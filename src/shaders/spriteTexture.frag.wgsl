@group(1) @binding(0) var Sampler: sampler;
@group(1) @binding(1) var Texture: texture_2d<f32>;
@group(1) @binding(2) var<uniform> uvOffset : vec4<f32>;

@fragment
fn main(@location(0) fragUV: vec2<f32>,
        @location(1) fragPosition: vec4<f32>) -> @location(0) vec4<f32> {
  // only show specific uv area of the big texture
  var uv = fragUV * vec2<f32>(uvOffset[2], uvOffset[3]) + vec2<f32>(uvOffset[0], uvOffset[1]);
  return textureSample(Texture, Sampler, uv) * fragPosition;
}
