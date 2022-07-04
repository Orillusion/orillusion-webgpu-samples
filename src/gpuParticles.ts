import basicInstanced from './shaders/basic.instanced.vert.wgsl?raw'
import positionFrag from './shaders/position.frag.wgsl?raw'
import positionCompute from './shaders/compute.position.wgsl?raw'
import * as box from './util/box'
import { getModelViewMatrix, getProjectionMatrix } from './util/math'

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
    })
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice({
        requiredLimits: {
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
        }
    })
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat()
    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
    const size = {width: canvas.width, height: canvas.height}
    context.configure({
        device, format,
        // prevent chrome warning after v102
        alphaMode: 'opaque'
    })
    return {device, context, format, size}
}

// create pipiline & buffers
async function initPipeline(device: GPUDevice, format: GPUTextureFormat, size:{width:number, height:number}) {
    const renderPipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: basicInstanced,
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 8 * 4, // 3 position 2 uv,
                attributes: [
                    {
                        // position
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3',
                    },
                    {
                        // normal
                        shaderLocation: 1,
                        offset: 3 * 4,
                        format: 'float32x3',
                    },
                    {
                        // uv
                        shaderLocation: 2,
                        offset: 6 * 4,
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
    // create depthTexture for renderPass
    const depthTexture = device.createTexture({
        size, format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    const depthView = depthTexture.createView()
    // create a compute pipeline
    const computePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: positionCompute
            }),
            entryPoint: 'main'
        }
    })

    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        label: 'GPUBuffer store vertex',
        size: box.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(vertexBuffer, 0, box.vertex)
    const indexBuffer = device.createBuffer({
        label: 'GPUBuffer store index',
        size: box.index.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(indexBuffer, 0, box.index)
    
    const modelBuffer = device.createBuffer({
        label: 'GPUBuffer store MAX model matrix',
        size: 4 * 4 * 4 * MAX, // mat4x4 x float32 x MAX
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    const projectionBuffer = device.createBuffer({
        label: 'GPUBuffer store camera projection',
        size: 4 * 4 * 4, // mat4x4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    const mvpBuffer = device.createBuffer({
        label: 'GPUBuffer store MAX MVP',
        size: 4 * 4 * 4 * MAX, // mat4x4 x float32 x MAX
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    const velocityBuffer = device.createBuffer({
        label: 'GPUBuffer store MAX velocity',
        size: 4 * 4 * MAX, // 4 position x float32 x MAX
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    const inputBuffer = device.createBuffer({
        label: 'GPUBuffer store input vars',
        size: 7 * 4, // float32 * 7
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })


    // create a bindGroup for renderPass
    const renderGroup = device.createBindGroup({
        label: 'Group for renderPass',
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: mvpBuffer
                }
            }
        ]
    })
    // create bindGroup for computePass
    const computeGroup = device.createBindGroup({
        label: 'Group for computePass',
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: velocityBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: modelBuffer
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: projectionBuffer
                }
            },
            {
                binding: 4,
                resource: {
                    buffer: mvpBuffer
                }
            }
        ]
    })
    // return all vars
    return {
        renderPipeline, computePipeline,
        vertexBuffer, indexBuffer, 
        modelBuffer, projectionBuffer, inputBuffer, velocityBuffer,
        renderGroup, computeGroup,
        depthTexture, depthView
    }
}

// create & submit device commands
function draw(
    device: GPUDevice, 
    context: GPUCanvasContext,
    pipelineObj: {
        renderPipeline: GPURenderPipeline,
        computePipeline: GPUComputePipeline,
        vertexBuffer: GPUBuffer,
        indexBuffer: GPUBuffer,
        renderGroup: GPUBindGroup,
        computeGroup: GPUBindGroup,
        depthView: GPUTextureView
    }
) {
    const commandEncoder = device.createCommandEncoder()
    const computePass = commandEncoder.beginComputePass()
    computePass.setPipeline(pipelineObj.computePipeline)
    computePass.setBindGroup(0, pipelineObj.computeGroup)
    computePass.dispatchWorkgroups(Math.ceil(NUM / 128))
    computePass.end()

    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }
        ],
        depthStencilAttachment: {
            view: pipelineObj.depthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        }
    })
    passEncoder.setPipeline(pipelineObj.renderPipeline)
    passEncoder.setVertexBuffer(0, pipelineObj.vertexBuffer)
    passEncoder.setIndexBuffer(pipelineObj.indexBuffer, 'uint16')
    passEncoder.setBindGroup(0, pipelineObj.renderGroup)
    passEncoder.drawIndexed(box.indexCount, NUM)
    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])
}

// total objects
let NUM = 150000, MAX = 300000
async function run(){
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    
    const {device, context, format, size} = await initWebGPU(canvas)
    const pipelineObj = await initPipeline(device, format, size)
    // create data
    const inputArray = new Float32Array([NUM, -500, 500, -250, 250, -500, 500]) // count, xmin/max, ymin/max, zmin/max
    const modelArray = new Float32Array(MAX * 4 * 4)
    const velocityArray = new Float32Array(MAX * 4)
    for(let i = 0; i < MAX; i++){
        const x = Math.random() * 1000 - 500
        const y = Math.random() * 500 - 250
        const z = Math.random() * 1000 - 500
        const modelMatrix = getModelViewMatrix({x,y,z},{x:0,y:0,z:0},{x:2,y:2,z:2})
        modelArray.set(modelMatrix, i * 4 * 4)

        velocityArray[i * 4 + 0] = Math.random() - 0.5 // x
        velocityArray[i * 4 + 1] = Math.random() - 0.5 // y
        velocityArray[i * 4 + 2] = Math.random() - 0.5 // z
        velocityArray[i * 4 + 3] = 1 // w
    }
    device.queue.writeBuffer(pipelineObj.velocityBuffer, 0, velocityArray)
    device.queue.writeBuffer(pipelineObj.modelBuffer, 0, modelArray)
    device.queue.writeBuffer(pipelineObj.inputBuffer, 0, inputArray)
    
    // auto rotated camera
    const camera = {x:0, y: 50, z: 1000}
    let aspect = size.width / size.height
    // start loop
    function frame(){
        const time = performance.now() / 5000
        camera.x = 1000 * Math.sin(time)
        camera.z = 1000 * Math.cos(time)
        const projectionMatrix = getProjectionMatrix(aspect, 60 / 180 * Math.PI, 0.1, 10000, camera)
        device.queue.writeBuffer(pipelineObj.projectionBuffer, 0, projectionMatrix)
        draw(device, context, pipelineObj)
        requestAnimationFrame(frame)
    }
    frame()

    // re-configure context on resize
    window.addEventListener('resize', ()=>{
        size.width = canvas.width = canvas.clientWidth * devicePixelRatio
        size.height = canvas.height = canvas.clientHeight * devicePixelRatio
        // don't need to recall context.configure() after v104
        // re-create depth texture
        pipelineObj.depthTexture.destroy()
        pipelineObj.depthTexture = device.createTexture({
            size, format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        pipelineObj.depthView = pipelineObj.depthTexture.createView()
        // update aspect
        aspect = size.width/ size.height
    })

    const range = document.querySelector('input') as HTMLInputElement
    range.max = MAX.toString()
    range.value = NUM.toString()
    range.addEventListener('input', (e:Event)=>{
        NUM = +(e.target as HTMLInputElement).value
        const span = document.querySelector('#num') as HTMLSpanElement
        span.innerHTML = NUM.toString()
        inputArray[0] = NUM
        device.queue.writeBuffer(pipelineObj.inputBuffer, 0, inputArray)
    })
}
run()