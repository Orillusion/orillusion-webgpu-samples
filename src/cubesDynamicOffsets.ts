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
    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        label: 'GPUBuffer store vertex',
        size: cube.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(vertexBuffer, 0, cube.vertex)
    // create a (256 + 4 * 16) matrix
    const buffer = device.createBuffer({
        label: 'GPUBuffer store 2 4*4 matrix',
        size: 256 + 4 * 16, // 2 matrix with 256-byte aligned
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // create group layout for dynamicOffset
    const dynamicBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: 'uniform',
                    hasDynamicOffset: true,
                    minBindingSize: 0
                }
            }
        ]
    })

    // create pipline layout for dynamicOffset
    const dynamicPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [dynamicBindGroupLayout]
    });
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        layout: dynamicPipelineLayout,
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

    // create a uniform group with dynamicOffsets
    const group = device.createBindGroup({
        layout: dynamicBindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: buffer,
                    offset: 0,
                    size: 4 * 16
                }
            }
        ]
    })
    // return all vars
    return {pipeline, vertexBuffer, buffer, group}
}

// create a rotation matrix
function getMvpMatrix(
    aspect: number,
    positioin: {x:number, y:number, z:number},
    rotation: {x:number, y:number, z:number}
){
    // create a perspective Matrix
    const projectionMatrix = mat4.create()
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0)
    // create modelView Matrix
    const viewMatrix = mat4.create()
    // translate position
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(positioin.x, positioin.y, positioin.z))
    // rotate
    mat4.rotate(viewMatrix, viewMatrix, 1, vec3.fromValues(rotation.x, rotation.y, rotation.z))
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
        pipeline: GPURenderPipeline,
        vertexBuffer: GPUBuffer,
        buffer: GPUBuffer,
        group: GPUBindGroup
    }
) {
    // start encoder
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
    // set vertex
    passEncoder.setVertexBuffer(0, piplineObj.vertexBuffer)
    {
        // draw first cube with dynamicOffset 0
        passEncoder.setBindGroup(0, piplineObj.group, [0])
        passEncoder.draw(cube.vertexCount)
        // draw second cube with dynamicOffset 256
        passEncoder.setBindGroup(0, piplineObj.group, [256])
        passEncoder.draw(cube.vertexCount)
    }
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
        // first, update two transform matrixs
        const aspect = size.width/ size.height
        const now = Date.now() / 1000
        {
            // first cube
            const position1 = {x:2, y:0, z: -7}
            const rotation1 = {x: Math.sin(now), y: Math.cos(now), z:0}
            const mvpMatrix1 = getMvpMatrix(aspect, position1, rotation1)
            device.queue.writeBuffer(
                piplineObj.buffer,
                0,
                mvpMatrix1.buffer
            )
        }
        {
            // second cube
            const position2 = {x:-2, y:0, z: -7}
            const rotation2 = {x: Math.cos(now), y: Math.sin(now), z:0}
            const mvpMatrix2 = getMvpMatrix(aspect, position2, rotation2)
            device.queue.writeBuffer(
                piplineObj.buffer,
                256,
                mvpMatrix2.buffer
            )
        }
        // then draw
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