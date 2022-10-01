@group(1) @binding(0) var Sampler: sampler;
@group(1) @binding(1) var Texture: texture_external;

@fragment
fn main(@location(0) fragUV: vec2<f32>,
        @location(1) fragPosition: vec4<f32>) -> @location(0) vec4<f32> {
  return textureSampleBaseClampToEdge(Texture, Sampler, fragUV) * fragPosition;
}
