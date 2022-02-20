import triangleVertWGSL from './shaders/triangle.vert.wgsl?raw';
import redFragWGSL from './shaders/red.frag.wgsl?raw';

async function initWebGPU() {
    const adapter = await navigator.gpu.requestAdapter() as GPUAdapter
    if(!adapter)
        //token will be maintained by orillusion frequently
        throw new Error('Webgpu not supported | Token is expired')
    const device = await adapter.requestDevice();
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = context.getPreferredFormat(adapter);
    const devicePixelRatio = window.devicePixelRatio || 1;
    const size = [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
    ];
    context.configure({
        // json specific format when key and value are the same
        device, format, size
    })
    const pipeline = await initPipeline(device, format)
    frame(device, context, pipeline)
}

async function initPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
    const descriptor: GPURenderPipelineDescriptor = {
        vertex: {
            module: device.createShaderModule({
                code: triangleVertWGSL,
            }),
            entryPoint: 'main',
        },
        fragment: {
            module: device.createShaderModule({
                code: redFragWGSL,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format,
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
        }
    }
    return await device.createRenderPipelineAsync(descriptor)
}

function frame(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline) {
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
        // maybe a warning in TS, just ignore it
        colorAttachments: [
            {
                view: textureView,
                loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                storeOp: 'store',
            },
        ],
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.draw(3, 1, 0, 0);
    // endPass is deprecated after 18.02.2022
    passEncoder.end ? passEncoder.end():passEncoder.endPass();
    // webgpu is in async model and all the commands will be run after submit
    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(()=>{
        frame(device, context, pipeline)
    })
}

initWebGPU()

