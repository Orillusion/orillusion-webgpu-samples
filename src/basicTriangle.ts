import triangleVertWGSL from './shaders/triangle.vert.wgsl?raw'
import redFragWGSL from './shaders/red.frag.wgsl?raw'
import {getShader} from './util/helper'

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if (!canvas)
        throw new Error('No Canvas')
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
        // powerPreference: 'low-power'
    })
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    if (!device)
        throw new Error('No Device Found')
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    const size = [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
    ]
    context.configure({
        // json specific format when key and value are the same
        device, format, size
    })
    return {device, context, format, size}
}
// create a simple pipiline
async function initPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
    const descriptor: GPURenderPipelineDescriptor = {
        vertex: {
            module: device.createShaderModule({
                code: getShader(triangleVertWGSL)
            }),
            entryPoint: 'main'
        },
        fragment: {
            module: device.createShaderModule({
                code: getShader(redFragWGSL)
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
    }
    return await device.createRenderPipelineAsync(descriptor)
}
// create & submit device commands
function draw(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline) {
    const commandEncoder = device.createCommandEncoder()
    const view = context.getCurrentTexture().createView()
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: view,
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear', // clear/load
                storeOp: 'store', // store/discard
                // before 18.02.2022
                loadValue: { r: 0, g: 0, b: 0, a: 1.0 }
            }
        ]
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(pipeline)
    // 3 vertex form a triangle
    passEncoder.draw(3, 1, 0, 0)
    // endPass is deprecated after 18.02.2022
    passEncoder.end ? passEncoder.end() : passEncoder.endPass()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

async function run(){
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const {device, context, format} = await initWebGPU(canvas)
    const pipeline = await initPipeline(device, format)
    // start draw
    draw(device, context, pipeline)
}
run()