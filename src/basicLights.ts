import normal from './shaders/normal.vert.wgsl?raw'
import lambert from './shaders/lambert.frag.wgsl?raw'
import * as sphere from './util/sphere'
import * as box from './util/box'
import { getModelViewMatrix, getProjectionMatrix } from './util/math'

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
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
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: normal,
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
                    },
                ]
            }]
        },
        fragment: {
            module: device.createShaderModule({
                code: lambert,
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
    // create vertex & index buffer
    const boxBuffer = {
        vertex: device.createBuffer({
            label: 'GPUBuffer store vertex',
            size: box.vertex.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        }),
        index: device.createBuffer({
            label: 'GPUBuffer store vertex index',
            size: box.index.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        })
    }
    const sphereBuffer = {
        vertex: device.createBuffer({
            label: 'GPUBuffer store vertex',
            size: sphere.vertex.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        }),
        index: device.createBuffer({
            label: 'GPUBuffer store vertex index',
            size: sphere.index.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        })
    }
    device.queue.writeBuffer(boxBuffer.vertex, 0, box.vertex)
    device.queue.writeBuffer(boxBuffer.index, 0, box.index)
    device.queue.writeBuffer(sphereBuffer.vertex, 0, sphere.vertex)
    device.queue.writeBuffer(sphereBuffer.index, 0, sphere.index)

    // create a 4x4xNUM STORAGE buffer to store matrix
    const modelViewBuffer = device.createBuffer({
        label: 'GPUBuffer store n*4x4 matrix',
        size: 4 * 4 * 4 * NUM, // 4 x 4 x float32 x NUM
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    // create a 4x4 uniform buffer to store projection
    const projectionBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 4 * 4 * 4, // 4 x 4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a 4x4xNUM STORAGE buffer to store color
    const colorBuffer = device.createBuffer({
        label: 'GPUBuffer store n*4 color',
        size: 4 * 4 * NUM, // 4 x float32 x NUM
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    // create a uniform group for Matrix
    const vsGroup = device.createBindGroup({
        label: 'Uniform Group with matrix',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: modelViewBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: projectionBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: colorBuffer
                }
            },
        ]
    })
    // create a uniform buffer to store pointLight
    const ambientBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 1 * 4, // 1 x float32: intensity f32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a uniform buffer to store pointLight
    const pointBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 8 * 4, // 8 x float32: position vec4 + 4 configs
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a uniform buffer to store dirLight
    const directionalBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 8 * 4, // 8 x float32: position vec4 + 4 configs
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a uniform group for light Matrix
    const lightGroup = device.createBindGroup({
        label: 'Uniform Group with matrix',
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: ambientBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: pointBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: directionalBuffer
                }
            }
        ]
    })
    // return all vars
    return {
        pipeline, boxBuffer, sphereBuffer, 
        modelViewBuffer, projectionBuffer, colorBuffer, vsGroup, 
        ambientBuffer, pointBuffer, directionalBuffer, lightGroup, 
        depthTexture, depthView
    }
}

// create & submit device commands
function draw(
    device: GPUDevice, 
    context: GPUCanvasContext,
    pipelineObj: {
        pipeline: GPURenderPipeline,
        boxBuffer: {vertex: GPUBuffer, index: GPUBuffer},
        sphereBuffer: {vertex: GPUBuffer, index: GPUBuffer},
        vsGroup: GPUBindGroup,
        lightGroup: GPUBindGroup
        depthView: GPUTextureView
    },
) {
    const commandEncoder = device.createCommandEncoder()
    const renderPassDescriptor: GPURenderPassDescriptor = {
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
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(pipelineObj.pipeline)
    passEncoder.setBindGroup(0, pipelineObj.vsGroup)
    passEncoder.setBindGroup(1, pipelineObj.lightGroup)
    // set box vertex
    passEncoder.setVertexBuffer(0, pipelineObj.boxBuffer.vertex)
    passEncoder.setIndexBuffer(pipelineObj.boxBuffer.index, 'uint16')
    passEncoder.drawIndexed(box.indexCount, NUM / 2, 0, 0, 0)
    // set sphere vertex
    passEncoder.setVertexBuffer(0, pipelineObj.sphereBuffer.vertex)
    passEncoder.setIndexBuffer(pipelineObj.sphereBuffer.index, 'uint16')
    passEncoder.drawIndexed(sphere.indexCount, NUM / 2, 0, 0, NUM / 2)
    passEncoder.end()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

// total objects
const NUM = 500
async function run(){
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    
    const {device, context, format, size} = await initWebGPU(canvas)
    const pipelineObj = await initPipeline(device, format, size)

    // create objects
    const scene:any[] = []
    const modelViewMatrix = new Float32Array(NUM * 4 * 4)
    const colorBuffer = new Float32Array(NUM * 4)
    for(let i = 0; i < NUM; i++){
        // craete simple object
        const position = {x: Math.random() * 40 - 20, y: Math.random() * 40 - 20, z:  - 50 - Math.random() * 50}
        const rotation = {x: Math.random(), y: Math.random(), z: Math.random()}
        const scale = {x:1, y:1, z:1}
        const modelView = getModelViewMatrix(position, rotation, scale)
        modelViewMatrix.set(modelView, i * 4 * 4)
        // random color for each object
        colorBuffer.set([Math.random(), Math.random(), Math.random(), 1], i * 4)
        scene.push({position, rotation, scale})
    }
    // write matrix & colors
    device.queue.writeBuffer(pipelineObj.colorBuffer, 0, colorBuffer)
    device.queue.writeBuffer(pipelineObj.modelViewBuffer, 0, modelViewMatrix)
    
    // ambient light, just 1 float32
    const ambient = new Float32Array([0.1])
    // point light, 2 x vec4: 4 position + 4 configs
    const pointLight = new Float32Array(8)
    pointLight[2] = -50 // z
    pointLight[4] = 1 // intensity
    pointLight[5] = 20 // radius
    // dir light, 2 x vec4: 4 position + 4 configs
    const directionalLight = new Float32Array(8)
    directionalLight[4] = 0.5 // intensity
    
    // start loop
    function frame(){
        // update lights position
        const now = performance.now()
        pointLight[0] = 10 * Math.sin(now / 1000)
        pointLight[1] = 10 * Math.cos(now / 1000)
        pointLight[2] = -60 + 10 * Math.cos(now / 1000)
        directionalLight[0] = Math.sin(now / 1500)
        directionalLight[2] = Math.cos(now / 1500)
        // update lights position & config to GPU
        device.queue.writeBuffer(pipelineObj.ambientBuffer, 0, ambient)
        device.queue.writeBuffer(pipelineObj.pointBuffer, 0, pointLight)
        device.queue.writeBuffer(pipelineObj.directionalBuffer, 0, directionalLight)
        draw(device, context, pipelineObj)
        requestAnimationFrame(frame)
    }
    frame()

    // UI
    document.querySelector('#ambient')?.addEventListener('input', (e:Event) => {
        ambient[0] = +(e.target as HTMLInputElement).value
    })
    document.querySelector('#point')?.addEventListener('input', (e:Event) => {
        pointLight[4] = +(e.target as HTMLInputElement).value
    })
    document.querySelector('#radius')?.addEventListener('input', (e:Event) => {
        pointLight[5] = +(e.target as HTMLInputElement).value
    })
    document.querySelector('#dir')?.addEventListener('input', (e:Event) => {
        directionalLight[4] = +(e.target as HTMLInputElement).value
    })

    function updateCamera(){
        const aspect = size.width / size.height
        const projectionMatrix = getProjectionMatrix(aspect)
        device.queue.writeBuffer(pipelineObj.projectionBuffer, 0, projectionMatrix)
    }
    updateCamera()
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
        updateCamera()
    })
}
run()