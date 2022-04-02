import { mat4, vec3 } from 'gl-matrix'
import basicVert from './shaders/basic.vert.wgsl?raw'
import positionFrag from './shaders/position.frag.wgsl?raw'
import * as cube from './util/cube'

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    const size = {
        width: canvas.clientWidth * devicePixelRatio,
        height: canvas.clientHeight * devicePixelRatio,
    }
    context.configure({
        device, format, size,
        // prevent chrome warning after v102
        compositingAlphaMode: 'opaque'
    })
    return {device, context, format, size}
}

// create pipiline & buffers
async function initPipeline(device: GPUDevice, format: GPUTextureFormat) {
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        vertex: {
            module: device.createShaderModule({
                code: basicVert,
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 5 * 4, // 3 position 2 uv,
                attributes: [
                    {
                        // position
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3',
                    },
                    {
                        // uv
                        shaderLocation: 1,
                        offset: 3 * 4,
                        format: 'float32x2',
                    }
                ]
            }]
        },
        fragment: {
            module: device.createShaderModule({
                code: positionFrag,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: 'triangle-list',
            // Culling backfaces pointing away from the camera
            cullMode: 'back'
        },
        // Enable depth testing since we have z-level positions
        // Fragment closest to the camera is rendered in front
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        }
    } as GPURenderPipelineDescriptor)
    
    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        label: 'GPUBuffer store vertex',
        size: cube.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(vertexBuffer, 0, cube.vertex)

    // create matrix buffer
    const matrixBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 4 * 4 * 4, // 4 x 4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    
    // create a uniform group for Matrix
    const uniformGroup = device.createBindGroup({
        label: 'Uniform Group with Matrix',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: matrixBuffer
                }
            }
        ]
    })
    // return all vars
    return {pipeline, vertexBuffer, matrixBuffer, uniformGroup}
}

// create a rotation matrix
function getMvpMatrix(width:number, height: number){
    // create a perspective Matrix
    const aspect = width / height
    const projectionMatrix = mat4.create()
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0)
    // create modelView Matrix
    const viewMatrix = mat4.create()
    // set position so that we can see in view
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -4))
    // rotate based on time
    const now = Date.now() / 1000
    mat4.rotate(viewMatrix, viewMatrix, 1, vec3.fromValues(Math.sin(now), Math.cos(now), 0))
    // create mvp matrix
    const modelViewProjectionMatrix = mat4.create()
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix)
    // return matrix as Float32Array
    return modelViewProjectionMatrix as Float32Array
}

// create & submit device commands
function draw(
    device: GPUDevice, 
    context: GPUCanvasContext,
    size: {width:number, height: number},
    piplineObj: {
        pipeline: GPURenderPipeline;
        vertexBuffer: GPUBuffer;
        matrixBuffer: GPUBuffer;
        uniformGroup: GPUBindGroup;
    }
) {
    // first, update transform matrix
    const mvpMatrix = getMvpMatrix(size.width, size.height)
    device.queue.writeBuffer(
        piplineObj.matrixBuffer,
        0,
        mvpMatrix.buffer,
        mvpMatrix.byteOffset,
        mvpMatrix.byteLength
    )
    // then start draw
    const commandEncoder = device.createCommandEncoder()
    const colorView = context.getCurrentTexture().createView()
    const depthView = device.createTexture({
        size, format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    }).createView()
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: colorView,
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
                // before v101
                loadValue: { r: 0, g: 0, b: 0, a: 1.0 }
            }
        ],
        depthStencilAttachment: {
            view: depthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        }
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(piplineObj.pipeline)
    // set uniformGroup
    passEncoder.setBindGroup(0, piplineObj.uniformGroup)
    // set vertex
    passEncoder.setVertexBuffer(0, piplineObj.vertexBuffer)
    // draw vertex count of cube
    passEncoder.draw(cube.vertexCount, 1, 0, 0)
    // endPass is deprecated after v101
    passEncoder.end ? passEncoder.end() : passEncoder.endPass()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

async function run(){
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    const {device, context, format, size} = await initWebGPU(canvas)
    const piplineObj = await initPipeline(device, format)
    
    // start loop
    function frame(){
        draw(device, context, size, piplineObj)
        requestAnimationFrame(frame)
    }
    frame()

    // re-configure context on resize
    window.addEventListener('resize', ()=>{
        size.width = canvas.clientWidth * devicePixelRatio
        size.height = canvas.clientHeight * devicePixelRatio
        context.configure({
            device, format, size,
            compositingAlphaMode: 'opaque'
        })
    })
}
run()