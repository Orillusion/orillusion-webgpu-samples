import shadowVertex from './shaders/shadow.vertex.wgsl?raw'
import shadowFrag from './shaders/shadow.frag.wgsl?raw'
import shadowDepth from './shaders/shadowDepth.wgsl?raw'
import * as sphere from './util/sphere'
import * as box from './util/box'
import { getModelViewMatrix, getProjectionMatrix } from './util/math'
import { mat4, vec3 } from 'gl-matrix'


// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if (!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
    const size = { width: canvas.width, height: canvas.height }
    context.configure({
        device, format,
        // prevent chrome warning after v102
        alphaMode: 'opaque'
    })
    return { device, context, format, size }
}

// create pipiline & buffers
async function initPipeline(device: GPUDevice, format: GPUTextureFormat, size: { width: number, height: number }) {
    const vertexBuffers: Iterable<GPUVertexBufferLayout> = [{
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
    const primitive = {
        topology: 'triangle-list',
        cullMode: 'back'
    }
    const depthStencil = {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float',
    }
    const shadowPipeline = await device.createRenderPipelineAsync({
        label: 'Shadow Pipline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: shadowDepth,
            }),
            entryPoint: 'main',
            buffers: vertexBuffers
        },
        primitive, depthStencil
    } as GPURenderPipelineDescriptor)
    // create a depthTexture for shadow
    const shadowDepthTexture = device.createTexture({
        size: [2048, 2048],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float'
    });
    const renderPipeline = await device.createRenderPipelineAsync({
        label: 'Render Pipline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: shadowVertex,
            }),
            entryPoint: 'main',
            buffers: vertexBuffers
        },
        fragment: {
            module: device.createShaderModule({
                code: shadowFrag,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive, depthStencil
    } as GPURenderPipelineDescriptor)
    // create depthTexture for renderPass
    const renderDepthTexture = device.createTexture({
        size, format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
    // create depthTextureView
    const shadowDepthView = shadowDepthTexture.createView()
    const renderDepthView = renderDepthTexture.createView()
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
    const cameraProjectionBuffer = device.createBuffer({
        label: 'GPUBuffer for camera projection',
        size: 4 * 4 * 4, // 4 x 4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a 4x4 uniform buffer to store projection
    const lightProjectionBuffer = device.createBuffer({
        label: 'GPUBuffer for light projection',
        size: 4 * 4 * 4, // 4 x 4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a 4x4xNUM STORAGE buffer to store color
    const colorBuffer = device.createBuffer({
        label: 'GPUBuffer store n*4 color',
        size: 4 * 4 * NUM, // 4 x float32 x NUM
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    // create a uniform buffer to store dirLight
    const lightBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 4 * 4, // 4 x float32: position vec4
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // create a uniform group for Matrix
    const vsGroup = device.createBindGroup({
        label: 'Group for renderPass',
        layout: renderPipeline.getBindGroupLayout(0),
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
                    buffer: cameraProjectionBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: lightProjectionBuffer
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: colorBuffer
                }
            }
        ]
    })
    const fsGroup = device.createBindGroup({
        label: 'Group for fragment',
        layout: renderPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: lightBuffer
                }
            },
            {
                binding: 1,
                resource: shadowDepthView
            },
            {
                binding: 2,
                resource: device.createSampler({
                    compare: 'less',
                })
            }
        ]
    })
    const shadowGroup = device.createBindGroup({
        label: 'Group for shadowPass',
        layout: shadowPipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: {
                buffer: modelViewBuffer
            }
        }, {
            binding: 1,
            resource: {
                buffer: lightProjectionBuffer
            }
        }]
    })
    // return all vars
    return {
        renderPipeline, shadowPipeline, boxBuffer, sphereBuffer,
        modelViewBuffer, cameraProjectionBuffer, lightProjectionBuffer, colorBuffer, lightBuffer,
        vsGroup, fsGroup, shadowGroup,
        renderDepthTexture, renderDepthView, shadowDepthTexture, shadowDepthView
    }
}

// create & submit device commands
function draw(
    device: GPUDevice,
    context: GPUCanvasContext,
    pipelineObj: {
        renderPipeline: GPURenderPipeline,
        shadowPipeline: GPURenderPipeline,
        boxBuffer: { vertex: GPUBuffer, index: GPUBuffer },
        sphereBuffer: { vertex: GPUBuffer, index: GPUBuffer },
        vsGroup: GPUBindGroup,
        shadowGroup: GPUBindGroup,
        fsGroup: GPUBindGroup,
        renderDepthView: GPUTextureView,
        shadowDepthView: GPUTextureView
    },
) {
    const commandEncoder = device.createCommandEncoder()
    // start shadowPass
    {
        const shadowPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: pipelineObj.shadowDepthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        }
        const shadowPass = commandEncoder.beginRenderPass(shadowPassDescriptor)
        shadowPass.setPipeline(pipelineObj.shadowPipeline)
        shadowPass.setBindGroup(0, pipelineObj.shadowGroup)
        // set box vertex
        shadowPass.setVertexBuffer(0, pipelineObj.boxBuffer.vertex)
        shadowPass.setIndexBuffer(pipelineObj.boxBuffer.index, 'uint16')
        shadowPass.drawIndexed(box.indexCount, 2, 0, 0, 0)
        // set sphere vertex
        shadowPass.setVertexBuffer(0, pipelineObj.sphereBuffer.vertex)
        shadowPass.setIndexBuffer(pipelineObj.sphereBuffer.index, 'uint16')
        shadowPass.drawIndexed(sphere.indexCount, NUM - 2, 0, 0, NUM / 2)
        shadowPass.end()
    }
    // start renderPass
    {
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
                view: pipelineObj.renderDepthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        }
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor)
        renderPass.setPipeline(pipelineObj.renderPipeline)
        renderPass.setBindGroup(0, pipelineObj.vsGroup)
        renderPass.setBindGroup(1, pipelineObj.fsGroup)
        // set box vertex
        renderPass.setVertexBuffer(0, pipelineObj.boxBuffer.vertex)
        renderPass.setIndexBuffer(pipelineObj.boxBuffer.index, 'uint16')
        renderPass.drawIndexed(box.indexCount, 2, 0, 0, 0)
        // set sphere vertex
        renderPass.setVertexBuffer(0, pipelineObj.sphereBuffer.vertex)
        renderPass.setIndexBuffer(pipelineObj.sphereBuffer.index, 'uint16')
        renderPass.drawIndexed(sphere.indexCount, NUM - 2, 0, 0, NUM / 2)
        renderPass.end()
    }
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

// total objects
const NUM = 30
async function run() {
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')

    const { device, context, format, size } = await initWebGPU(canvas)
    const pipelineObj = await initPipeline(device, format, size)
    // create objects
    const scene: any[] = []
    const modelViewMatrix = new Float32Array(NUM * 4 * 4)
    const colorBuffer = new Float32Array(NUM * 4)
    // add a center box
    {
        const position = { x: 0, y: 0, z: -20 }
        const rotation = { x: 0, y: Math.PI / 4, z: 0 }
        const scale = { x: 2, y: 20, z: 2 }
        const modelView = getModelViewMatrix(position, rotation, scale)
        modelViewMatrix.set(modelView, 0 * 4 * 4)
        // random color for each object
        colorBuffer.set([0.5, 0.5, 0.5, 1], 0 * 4)
        scene.push({ position, rotation, scale })
    }
    // add a floor
    {
        const position = { x: 0, y: -10, z: -20 }
        const rotation = { x: 0, y: 0, z: 0 }
        const scale = { x: 50, y: 0.5, z: 40 }
        const modelView = getModelViewMatrix(position, rotation, scale)
        modelViewMatrix.set(modelView, 1 * 4 * 4)
        // random color for each object
        colorBuffer.set([1, 1, 1, 1], 1 * 4)
        scene.push({ position, rotation, scale })
    }
    // add spheres
    for (let i = 2; i < NUM; i++) {
        // craete simple object
        const or = Math.random() > 0.5 ? 1 : -1
        const position = { x: (1 + Math.random() * 12) * or, y: - 8 + Math.random() * 15, z: -20 + (1 + Math.random() * 12) * or }
        const rotation = { x: Math.random(), y: Math.random(), z: Math.random() }
        const s = Math.max(0.5, Math.random())
        const scale = { x: s, y: s, z: s }
        const modelView = getModelViewMatrix(position, rotation, scale)
        modelViewMatrix.set(modelView, i * 4 * 4)
        // random color for each object
        colorBuffer.set([Math.random(), Math.random(), Math.random(), 1], i * 4)
        scene.push({ position, rotation, scale, y: position.y, v: Math.max(0.09, Math.random() / 10) * or })
    }
    // write matrix & colors
    device.queue.writeBuffer(pipelineObj.colorBuffer, 0, colorBuffer)

    // dir light, 4 position
    const lightViewMatrix = mat4.create()
    const lightProjectionMatrix = mat4.create()
    const lightPosition = vec3.fromValues(0, 100, 0)
    const up = vec3.fromValues(0, 1, 0)
    const origin = vec3.fromValues(0, 0, 0)
    // start loop
    function frame() {
        // update lights position
        const now = performance.now()
        lightPosition[0] = Math.sin(now / 1500) * 50
        lightPosition[2] = Math.cos(now / 1500) * 50
        // update lvp matrix
        mat4.lookAt(
            lightViewMatrix,
            lightPosition,
            origin, up
        )
        mat4.ortho(lightProjectionMatrix, -40, 40, -40, 40, -50, 200)
        mat4.multiply(lightProjectionMatrix, lightProjectionMatrix, lightViewMatrix)
        device.queue.writeBuffer(pipelineObj.lightProjectionBuffer, 0, lightProjectionMatrix as Float32Array)
        device.queue.writeBuffer(pipelineObj.lightBuffer, 0, lightPosition as Float32Array)
        // update obj position
        for (let i = 2; i < NUM; i++) {
            const obj = scene[i]
            obj.position.y += obj.v
            if (obj.position.y < -9 || obj.position.y > 9)
                obj.v *= -1
            const modelView = getModelViewMatrix(obj.position, obj.rotation, obj.scale)
            modelViewMatrix.set(modelView, i * 4 * 4)
        }
        device.queue.writeBuffer(pipelineObj.modelViewBuffer, 0, modelViewMatrix)

        // start draw
        draw(device, context, pipelineObj)
        requestAnimationFrame(frame)
    }
    frame()

    function updateCamera() {
        const aspect = size.width / size.height
        const projectionMatrix = getProjectionMatrix(aspect, 60 / 180 * Math.PI, 0.1, 1000, { x: 0, y: 10, z: 20 })
        device.queue.writeBuffer(pipelineObj.cameraProjectionBuffer, 0, projectionMatrix)
    }
    updateCamera()
    // re-configure context on resize
    window.addEventListener('resize', () => {
        size.width = canvas.width = canvas.clientWidth * devicePixelRatio
        size.height = canvas.height = canvas.clientHeight * devicePixelRatio
        // don't need to recall context.configure() after v104
        // re-create depth texture
        pipelineObj.renderDepthTexture.destroy()
        pipelineObj.renderDepthTexture = device.createTexture({
            size, format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        pipelineObj.renderDepthView = pipelineObj.renderDepthTexture.createView()
        // update aspect
        updateCamera()
    })
}
run()