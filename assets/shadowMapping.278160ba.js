import"./modulepreload-polyfill.b7f2da20.js";import{v as G,i as M,a as V}from"./sphere.93ccd640.js";import{v as T,i as C,a as z}from"./box.c678a105.js";import{g as b,f as y,a as E}from"./math.c29ca26c.js";import{c as D,l as R,o as N,m as A}from"./mat4.f7fc816f.js";const F=`@group(0) @binding(0) var<storage> modelViews : array<mat4x4<f32>>;
@group(0) @binding(1) var<uniform> cameraProjection : mat4x4<f32>;
@group(0) @binding(2) var<uniform> lightProjection : mat4x4<f32>;
@group(0) @binding(3) var<storage> colors : array<vec4<f32>>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) fragPosition: vec3<f32>,
    @location(1) fragNormal: vec3<f32>,
    @location(2) fragUV: vec2<f32>,
    @location(3) shadowPos: vec3<f32>,
    @location(4) fragColor: vec4<f32>
};

@stage(vertex)
fn main(
    @builtin(instance_index) index : u32,
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) uv : vec2<f32>
) -> VertexOutput {
    let modelview = modelViews[index];
    let pos = vec4<f32>(position, 1.0);
    let posFromCamera: vec4<f32> = cameraProjection * modelview * pos;

    var output : VertexOutput;
    output.Position = posFromCamera;
    output.fragPosition = (modelview * pos).xyz;
    output.fragNormal =  (modelview * vec4<f32>(normal, 0.0)).xyz;
    output.fragUV = uv;
    output.fragColor = colors[index];

    let posFromLight: vec4<f32> = lightProjection * modelview * pos;
    // Convert shadowPos XY to (0, 1) to fit texture UV
    output.shadowPos = vec3<f32>(posFromLight.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5), posFromLight.z);
    return output;
}
`,_=`@group(1) @binding(0) var<uniform> lightPosition : vec4<f32>;
@group(1) @binding(1) var shadowMap: texture_depth_2d;
@group(1) @binding(2) var shadowSampler: sampler_comparison;

@stage(fragment)
fn main(
    @location(0) fragPosition : vec3<f32>,
    @location(1) fragNormal: vec3<f32>,
    @location(2) fragUV: vec2<f32>,
    @location(3) shadowPos: vec3<f32>,
    @location(4) fragColor: vec4<f32>
) -> @location(0) vec4<f32> {
    let objectColor = fragColor.rgb;
    // Directional Light
    let diffuse: f32 = max(dot(normalize(lightPosition.xyz), fragNormal), 0.0);
    // add shadow factor
    var shadow : f32 = 0.0;
    // apply Percentage-closer filtering (PCF)
    // sample nearest 9 texels to smooth result
    let size = f32(textureDimensions(shadowMap).x);
    for (var y : i32 = -1 ; y <= 1 ; y = y + 1) {
        for (var x : i32 = -1 ; x <= 1 ; x = x + 1) {
            let offset = vec2<f32>(f32(x) / size, f32(y) / size);
            shadow = shadow + textureSampleCompare(
                shadowMap, 
                shadowSampler,
                shadowPos.xy + offset, 
                shadowPos.z - 0.005  // apply a small bias to avoid acne
            );
        }
    }
    shadow = shadow / 9.0;
    // ambient + diffuse * shadow
    let lightFactor = min(0.3 + shadow * diffuse, 1.0);
    return vec4<f32>(objectColor * lightFactor, 1.0);
}`,I=`@group(0) @binding(0) var<storage> modelViews : array<mat4x4<f32>>;
@group(0) @binding(1) var<uniform> lightProjection : mat4x4<f32>;

@stage(vertex)
fn main(
    @builtin(instance_index) index : u32,
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) uv : vec2<f32>,
) -> @builtin(position) vec4<f32> {
    let modelview = modelViews[index];
    let pos = vec4(position, 1.0);
    return lightProjection * modelview * pos;
}
`;async function L(e){if(!navigator.gpu)throw new Error("Not Support WebGPU");const i=await navigator.gpu.requestAdapter();if(!i)throw new Error("No Adapter Found");const o=await i.requestDevice(),f=e.getContext("webgpu"),s=navigator.gpu.getPreferredCanvasFormat?navigator.gpu.getPreferredCanvasFormat():f.getPreferredFormat(i),t=window.devicePixelRatio||1;e.width=e.clientWidth*t,e.height=e.clientHeight*t;const d={width:e.width,height:e.height};return f.configure({device:o,format:s,alphaMode:"opaque"}),{device:o,context:f,format:s,size:d}}async function q(e,i,o){const f=[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}],s={topology:"triangle-list",cullMode:"back"},t={depthWriteEnabled:!0,depthCompare:"less",format:"depth32float"},d=await e.createRenderPipelineAsync({label:"Shadow Pipline",layout:"auto",vertex:{module:e.createShaderModule({code:I}),entryPoint:"main",buffers:f},primitive:s,depthStencil:t}),l=e.createTexture({size:[2048,2048],usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,format:"depth32float"}),h=await e.createRenderPipelineAsync({label:"Render Pipline",layout:"auto",vertex:{module:e.createShaderModule({code:F}),entryPoint:"main",buffers:f},fragment:{module:e.createShaderModule({code:_}),entryPoint:"main",targets:[{format:i}]},primitive:s,depthStencil:t}),x=e.createTexture({size:o,format:"depth32float",usage:GPUTextureUsage.RENDER_ATTACHMENT}),g=l.createView(),p=x.createView(),w={vertex:e.createBuffer({label:"GPUBuffer store vertex",size:T.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),index:e.createBuffer({label:"GPUBuffer store vertex index",size:C.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST})},P={vertex:e.createBuffer({label:"GPUBuffer store vertex",size:G.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),index:e.createBuffer({label:"GPUBuffer store vertex index",size:M.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST})};e.queue.writeBuffer(w.vertex,0,T),e.queue.writeBuffer(w.index,0,C),e.queue.writeBuffer(P.vertex,0,G),e.queue.writeBuffer(P.index,0,M);const m=e.createBuffer({label:"GPUBuffer store n*4x4 matrix",size:4*4*4*c,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),B=e.createBuffer({label:"GPUBuffer for camera projection",size:4*4*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),n=e.createBuffer({label:"GPUBuffer for light projection",size:4*4*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a=e.createBuffer({label:"GPUBuffer store n*4 color",size:4*4*c,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),r=e.createBuffer({label:"GPUBuffer store 4x4 matrix",size:4*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),u=e.createBindGroup({label:"Group for renderPass",layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:B}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:a}}]}),v=e.createBindGroup({label:"Group for fragment",layout:h.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:r}},{binding:1,resource:g},{binding:2,resource:e.createSampler({compare:"less"})}]}),U=e.createBindGroup({label:"Group for shadowPass",layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:n}}]});return{renderPipeline:h,shadowPipeline:d,boxBuffer:w,sphereBuffer:P,modelViewBuffer:m,cameraProjectionBuffer:B,lightProjectionBuffer:n,colorBuffer:a,lightBuffer:r,vsGroup:u,fsGroup:v,shadowGroup:U,renderDepthTexture:x,renderDepthView:p,shadowDepthTexture:l,shadowDepthView:g}}function O(e,i,o){const f=e.createCommandEncoder();{const s={colorAttachments:[],depthStencilAttachment:{view:o.shadowDepthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}},t=f.beginRenderPass(s);t.setPipeline(o.shadowPipeline),t.setBindGroup(0,o.shadowGroup),t.setVertexBuffer(0,o.boxBuffer.vertex),t.setIndexBuffer(o.boxBuffer.index,"uint16"),t.drawIndexed(z,2,0,0,0),t.setVertexBuffer(0,o.sphereBuffer.vertex),t.setIndexBuffer(o.sphereBuffer.index,"uint16"),t.drawIndexed(V,c-2,0,0,c/2),t.end()}{const s={colorAttachments:[{view:i.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:o.renderDepthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}},t=f.beginRenderPass(s);t.setPipeline(o.renderPipeline),t.setBindGroup(0,o.vsGroup),t.setBindGroup(1,o.fsGroup),t.setVertexBuffer(0,o.boxBuffer.vertex),t.setIndexBuffer(o.boxBuffer.index,"uint16"),t.drawIndexed(z,2,0,0,0),t.setVertexBuffer(0,o.sphereBuffer.vertex),t.setIndexBuffer(o.sphereBuffer.index,"uint16"),t.drawIndexed(V,c-2,0,0,c/2),t.end()}e.queue.submit([f.finish()])}const c=30;async function Y(){const e=document.querySelector("canvas");if(!e)throw new Error("No Canvas");const{device:i,context:o,format:f,size:s}=await L(e),t=await q(i,f,s),d=[],l=new Float32Array(c*4*4),h=new Float32Array(c*4);{const n={x:0,y:0,z:-20},a={x:0,y:Math.PI/4,z:0},r={x:2,y:20,z:2},u=b(n,a,r);l.set(u,0*4*4),h.set([.5,.5,.5,1],0*4),d.push({position:n,rotation:a,scale:r})}{const n={x:0,y:-10,z:-20},a={x:0,y:0,z:0},r={x:50,y:.5,z:40},u=b(n,a,r);l.set(u,1*4*4),h.set([1,1,1,1],1*4),d.push({position:n,rotation:a,scale:r})}for(let n=2;n<c;n++){const a=Math.random()>.5?1:-1,r={x:(1+Math.random()*12)*a,y:-8+Math.random()*15,z:-20+(1+Math.random()*12)*a},u={x:Math.random(),y:Math.random(),z:Math.random()},v=Math.max(.5,Math.random()),U={x:v,y:v,z:v},S=b(r,u,U);l.set(S,n*4*4),h.set([Math.random(),Math.random(),Math.random(),1],n*4),d.push({position:r,rotation:u,scale:U,y:r.y,v:Math.max(.09,Math.random()/10)*a})}i.queue.writeBuffer(t.colorBuffer,0,h);const x=D(),g=D(),p=y(0,100,0),w=y(0,1,0),P=y(0,0,0);function m(){const n=performance.now();p[0]=Math.sin(n/1500)*50,p[2]=Math.cos(n/1500)*50,R(x,p,P,w),N(g,-40,40,-40,40,-50,200),A(g,g,x),i.queue.writeBuffer(t.lightProjectionBuffer,0,g),i.queue.writeBuffer(t.lightBuffer,0,p);for(let a=2;a<c;a++){const r=d[a];r.position.y+=r.v,(r.position.y<-9||r.position.y>9)&&(r.v*=-1);const u=b(r.position,r.rotation,r.scale);l.set(u,a*4*4)}i.queue.writeBuffer(t.modelViewBuffer,0,l),O(i,o,t),requestAnimationFrame(m)}m();function B(){const n=s.width/s.height,a=E(n,60/180*Math.PI,.1,1e3,{x:0,y:10,z:20});i.queue.writeBuffer(t.cameraProjectionBuffer,0,a)}B(),window.addEventListener("resize",()=>{s.width=e.width=e.clientWidth*devicePixelRatio,s.height=e.height=e.clientHeight*devicePixelRatio,t.renderDepthTexture.destroy(),t.renderDepthTexture=i.createTexture({size:s,format:"depth32float",usage:GPUTextureUsage.RENDER_ATTACHMENT}),t.renderDepthView=t.renderDepthTexture.createView(),B()})}Y();
