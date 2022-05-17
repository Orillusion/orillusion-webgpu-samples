@group(1) @binding(0) var<uniform> pointLight : array<vec4<f32>, 2>;
@group(1) @binding(1) var<uniform> directionLight : array<vec4<f32>, 2>;

@stage(fragment)
fn main(
    @location(0) fragPosition : vec3<f32>,
    @location(1) fragNormal: vec3<f32>,
    @location(2) fragUV: vec2<f32>,
    @location(3) fragColor: vec4<f32>
) -> @location(0) vec4<f32> {
    var color = fragColor.rgb;    
    var lightFactor: f32 = 0.0;

    // Point Light
    var pointPosition = pointLight[0].xyz;
    var pointIntensity: f32 = pointLight[1][0];
    var pointRadius: f32 = pointLight[1][1];
    var L = pointPosition - fragPosition;
    var distance = length(L);
    if(distance < pointRadius){
        var lambertFactor: f32 = max(dot(normalize(L), fragNormal), 0.0);
        var distanceFactor: f32 = pow(1.0 - distance / pointRadius, 2.0);
        lightFactor += lambertFactor * distanceFactor * pointIntensity;
    }

    // Directional Light
    var directionPosition = directionLight[0].xyz;
    var directionIntensity: f32 = directionLight[1][0];
    var lambertFactor: f32 = max(dot(normalize(directionPosition), fragNormal), 0.0);
    lightFactor += lambertFactor * directionIntensity;

    return vec4<f32>(color * min(lightFactor, 1.0), 1.0);
}