@group(0) @binding(1) var Sampler: sampler;
@group(0) @binding(2) var Texture: texture_2d<f32>;

@stage(fragment)
fn main(@location(0) fragUV: vec2<f32>,
        @location(1) fragPosition: vec4<f32>) -> @location(0) vec4<f32> {
  return textureSample(Texture, Sampler, fragUV) * fragPosition;
}
