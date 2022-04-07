import positionVert from './shaders/position.vert.wgsl?raw'
import colorFrag from './shaders/color.frag.wgsl?raw'
import * as triangle from './util/triangle'

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

// create a simple pipiline & buffers
async function initPipeline(device: GPUDevice, format: GPUTextureFormat) {
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        vertex: {
            module: device.createShaderModule({
                code: positionVert,
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 3 * 4, // 3 float32,
                attributes: [
                    {
                        // position xyz
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3',
                    }
                ]
            }]
        },
        fragment: {
            module: device.createShaderModule({
                code: colorFrag,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: 'triangle-list' // try point-list, line-list, line-strip, triangle-strip?
        }
    } as GPURenderPipelineDescriptor)
    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        label: 'GPUBuffer store vertex',
        size: triangle.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        //mappedAtCreation: true
    })
    device.queue.writeBuffer(vertexBuffer, 0, triangle.vertex)
    // create color buffer
    const colorBuffer = device.createBuffer({
        label: 'GPUBuffer store rgba color',
        size: 4 * 4, // 4 * float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    })
    // device.queue.writeBuffer(colorBuffer, 0, new Float32Array([1,1,0,1]))
    new Float32Array(colorBuffer.getMappedRange()).set(new Float32Array([1,1,0,1]))
    colorBuffer.unmap()
    
    // create a uniform group for color
    const uniformGroup = device.createBindGroup({
        label: 'Uniform Group with colorBuffer',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: colorBuffer
                }
            }
        ]
    })
    // return all vars
    return {pipeline, vertexBuffer, colorBuffer, uniformGroup}
}

// create & submit device commands
function draw(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline, uniformGroup: GPUBindGroup, vertexBuffer: GPUBuffer) {
    const commandEncoder = device.createCommandEncoder()
    const view = context.getCurrentTexture().createView()
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: view,
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
                // before v101
                loadValue: { r: 0, g: 0, b: 0, a: 1.0 }
            }
        ]
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(pipeline)
    // set uniformGroup
    passEncoder.setBindGroup(0, uniformGroup)
    // set vertex
    passEncoder.setVertexBuffer(0, vertexBuffer)
    // 3 vertex form a triangle
    passEncoder.draw(triangle.vertexCount)
    // endPass is deprecated after v101
    passEncoder.end ? passEncoder.end() : passEncoder.endPass()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

async function run(){
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    const {device, context, format} = await initWebGPU(canvas)
    const {pipeline, uniformGroup, colorBuffer, vertexBuffer} = await initPipeline(device, format)
    
    // start render loop
    function frame(){
        draw(device, context, pipeline, uniformGroup, vertexBuffer)
        requestAnimationFrame(frame)
    }
    frame()

    // update colorBuffer if color changed
    document.querySelector('input[type="color"]')?.addEventListener('input', (e:Event) => {
        // get hex color string
        const color = (e.target as HTMLInputElement).value
        console.log(color)
        // parse hex color into rgb
        const r = +('0x' + color.slice(1, 3)) / 255
        const g = +('0x' + color.slice(3, 5)) / 255
        const b = +('0x' + color.slice(5, 7)) / 255
        // write colorBuffer with new color
        device.queue.writeBuffer(colorBuffer, 0, new Float32Array([r, g, b, 1]))
    })
    // update vertexBuffer
    document.querySelector('input[type="range"]')?.addEventListener('input', (e:Event) => {
        // get input value
        const value = +(e.target as HTMLInputElement).value
        console.log(value)
        // chagne vertex 0/3/6
        triangle.vertex[0] = 0 + value
        triangle.vertex[3] = -0.5 + value
        triangle.vertex[6] = 0.5 + value
        // write vertexBuffer with new vertex
        device.queue.writeBuffer(vertexBuffer, 0, triangle.vertex)
    })
    // re-configure context on resize
    window.addEventListener('resize', ()=>{
        context.configure({
            device, format,
            size: {
                width: canvas.clientWidth * devicePixelRatio,
                height: canvas.clientHeight * devicePixelRatio
            },
            compositingAlphaMode: 'opaque'
        })
    })
}
run()