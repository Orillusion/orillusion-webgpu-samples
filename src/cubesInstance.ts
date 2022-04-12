import basicInstanced from './shaders/basic.instanced.vert.wgsl?raw'
import positionFrag from './shaders/position.frag.wgsl?raw'
import * as cube from './util/cube'
import { getMvpMatrix } from './util/math'

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
async function initPipeline(device: GPUDevice, format: GPUTextureFormat, NUM:number) {
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        vertex: {
            module: device.createShaderModule({
                code: basicInstanced,
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
    
    // create a 4x4xCount STORAGE buffer to store matrix
    const buffer = device.createBuffer({
        label: 'GPUBuffer store n*4x4 matrix',
        size: 4 * 4 * 4 * NUM, // 4 x 4 x float32 x Object Count
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    // create a uniform group for Matrix
    const group = device.createBindGroup({
        label: 'Uniform Group with matrix',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: buffer
                }
            }
        ]
    })
    // return all vars
    return {pipeline, vertexBuffer, buffer, group, NUM}
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
        group: GPUBindGroup,
        NUM: number
    }
) {
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
        // draw two cubes in one call
        passEncoder.setBindGroup(0, piplineObj.group)
        passEncoder.draw(cube.vertexCount, piplineObj.NUM)
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
    
    const NUM = 10
    const {device, context, format, size} = await initWebGPU(canvas)
    const piplineObj = await initPipeline(device, format, NUM)
    
    // create objects
    const aspect = size.width/ size.height
    const objects:any[] = []
    for(let i = 0; i < NUM; i++)
    {
        // craete simple object
        const position = {x: Math.random() * 20 - 10, y: Math.random() * 20 - 10, z: - 20}
        const rotation = {x: 0, y: 0, z: 0}
        const scale = {x:1, y:1, z:1}
        objects.push({position, rotation, scale})
    }
    // const allMatrix = new Float32Array(NUM * 4 * 4)
    // start loop
    function frame(){
        // update rotation for each object
        for(let i = 0; i < objects.length - 1; i++){
            const obj = objects[i]
            const now = Date.now() / 1000
            obj.rotation.x = Math.sin(now + i)
            obj.rotation.y = Math.cos(now + i)
            const mvpMatrix = getMvpMatrix(aspect, obj.position, obj.rotation, obj.scale)
            // update buffer based on offset
            device.queue.writeBuffer(
                piplineObj.buffer,
                i * 4 * 4 * 4, // offset for each object, no need to 256-byte aligned
                mvpMatrix
            )
            // or save to allMatrix first
            // allMatrix.set(mvpMatrix, i * 4 * 4)
        }
        // the better way is update buffer in one write after loop
        // device.queue.writeBuffer(piplineObj.buffer, 0, allMatrix)

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