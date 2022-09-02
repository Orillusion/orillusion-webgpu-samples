@group(0) @binding(0) var<storage, read> input: array<f32, 7>;
@group(0) @binding(1) var<storage, read_write> velocity: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> modelView: array<mat4x4<f32>>;
@group(0) @binding(3) var<uniform> projection : mat4x4<f32>;
@group(0) @binding(4) var<storage, read_write> mvp : array<mat4x4<f32>>;

const size = u32(128);
@compute @workgroup_size(size)
fn main(
    @builtin(global_invocation_id) GlobalInvocationID : vec3<u32>
) {
    var index = GlobalInvocationID.x;
    if(index >= u32(input[0])){
        return;
    }
    var xMin = input[1];
    var xMax = input[2];
    var yMin = input[3];
    var yMax = input[4];
    var zMin = input[5];
    var zMax = input[6];
    var pos = modelView[index][3];
    var vel = velocity[index];
    // change x
    pos.x += vel.x;
    if(pos.x < xMin){
        pos.x = xMin;
        vel.x = -vel.x;
    }else if(pos.x > xMax){
        pos.x = xMax;
        vel.x = -vel.x;
    }
    // change y
    pos.y += vel.y;
    if(pos.y < yMin){
        pos.y = yMin;
        vel.y = -vel.y;
    }else if(pos.y > yMax){
        pos.y = yMax;
        vel.y = -vel.y;
    }
    // change z
    pos.z += vel.z;
    if(pos.z < zMin){
        pos.z = zMin;
        vel.z = -vel.z;
    }else if(pos.z > zMax){
        pos.z = zMax;
        vel.z = -vel.z;
    }
    // update velocity
    velocity[index] = vel;
    // update position in modelView matrix
    modelView[index][3] = pos;
    // update mvp
    mvp[index] = projection * modelView[index];
}