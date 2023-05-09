import"./modulepreload-polyfill-3cfb730f.js";import{b as v}from"./basic.instanced.vert-cbfe75ff.js";import{p as M}from"./position.frag-8baafb48.js";import{v as B,i as y,a as G}from"./box-6fbc9715.js";import{g as U,a as b}from"./math-7b9ebb83.js";import"./mat4-5036aab8.js";const z=`@group(0) @binding(0) var<storage, read> input: array<f32, 7>;
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
}`;async function S(e){if(!navigator.gpu)throw new Error("Not Support WebGPU");const n=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!n)throw new Error("No Adapter Found");const a=await n.requestDevice({requiredLimits:{maxStorageBufferBindingSize:n.limits.maxStorageBufferBindingSize}}),i=e.getContext("webgpu"),r=navigator.gpu.getPreferredCanvasFormat(),t=window.devicePixelRatio||1;e.width=e.clientWidth*t,e.height=e.clientHeight*t;const u={width:e.width,height:e.height};return i.configure({device:a,format:r,alphaMode:"opaque"}),{device:a,context:i,format:r,size:u}}async function T(e,n,a){const i=await e.createRenderPipelineAsync({label:"Basic Pipline",layout:"auto",vertex:{module:e.createShaderModule({code:v}),entryPoint:"main",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:e.createShaderModule({code:M}),entryPoint:"main",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{depthWriteEnabled:!0,depthCompare:"less",format:"depth24plus"}}),r=e.createTexture({size:a,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),t=r.createView(),u=await e.createComputePipelineAsync({layout:"auto",compute:{module:e.createShaderModule({code:z}),entryPoint:"main"}}),g=e.createBuffer({label:"GPUBuffer store vertex",size:B.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(g,0,B);const s=e.createBuffer({label:"GPUBuffer store index",size:y.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(s,0,y);const p=e.createBuffer({label:"GPUBuffer store MAX model matrix",size:4*4*4*d,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),m=e.createBuffer({label:"GPUBuffer store camera projection",size:4*4*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),x=e.createBuffer({label:"GPUBuffer store MAX MVP",size:4*4*4*d,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),l=e.createBuffer({label:"GPUBuffer store MAX velocity",size:4*4*d,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),o=e.createBuffer({label:"GPUBuffer store input vars",size:7*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),f=e.createBindGroup({label:"Group for renderPass",layout:i.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}}]}),h=e.createBindGroup({label:"Group for computePass",layout:u.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:l}},{binding:2,resource:{buffer:p}},{binding:3,resource:{buffer:m}},{binding:4,resource:{buffer:x}}]});return{renderPipeline:i,computePipeline:u,vertexBuffer:g,indexBuffer:s,modelBuffer:p,projectionBuffer:m,inputBuffer:o,velocityBuffer:l,renderGroup:f,computeGroup:h,depthTexture:r,depthView:t}}function A(e,n,a){const i=e.createCommandEncoder(),r=i.beginComputePass();r.setPipeline(a.computePipeline),r.setBindGroup(0,a.computeGroup),r.dispatchWorkgroups(Math.ceil(c/128)),r.end();const t=i.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:a.depthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});t.setPipeline(a.renderPipeline),t.setVertexBuffer(0,a.vertexBuffer),t.setIndexBuffer(a.indexBuffer,"uint16"),t.setBindGroup(0,a.renderGroup),t.drawIndexed(G,c),t.end(),e.queue.submit([i.finish()])}let c=15e4,d=3e5;async function E(){const e=document.querySelector("canvas");if(!e)throw new Error("No Canvas");const{device:n,context:a,format:i,size:r}=await S(e),t=await T(n,i,r),u=new Float32Array([c,-500,500,-250,250,-500,500]),g=new Float32Array(d*4*4),s=new Float32Array(d*4);for(let o=0;o<d;o++){const f=Math.random()*1e3-500,h=Math.random()*500-250,P=Math.random()*1e3-500,w=U({x:f,y:h,z:P},{x:0,y:0,z:0},{x:2,y:2,z:2});g.set(w,o*4*4),s[o*4+0]=Math.random()-.5,s[o*4+1]=Math.random()-.5,s[o*4+2]=Math.random()-.5,s[o*4+3]=1}n.queue.writeBuffer(t.velocityBuffer,0,s),n.queue.writeBuffer(t.modelBuffer,0,g),n.queue.writeBuffer(t.inputBuffer,0,u);const p={x:0,y:50,z:1e3};let m=r.width/r.height;function x(){const o=performance.now()/5e3;p.x=1e3*Math.sin(o),p.z=1e3*Math.cos(o);const f=b(m,60/180*Math.PI,.1,1e4,p);n.queue.writeBuffer(t.projectionBuffer,0,f),A(n,a,t),requestAnimationFrame(x)}x(),window.addEventListener("resize",()=>{r.width=e.width=e.clientWidth*devicePixelRatio,r.height=e.height=e.clientHeight*devicePixelRatio,t.depthTexture.destroy(),t.depthTexture=n.createTexture({size:r,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),t.depthView=t.depthTexture.createView(),m=r.width/r.height});const l=document.querySelector("input");l.max=d.toString(),l.value=c.toString(),l.addEventListener("input",o=>{c=+o.target.value;const f=document.querySelector("#num");f.innerHTML=c.toString(),u[0]=c,n.queue.writeBuffer(t.inputBuffer,0,u)})}E();
