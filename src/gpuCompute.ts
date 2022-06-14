import {mat4} from 'gl-matrix'
import computeTransform from './shaders/compute.transform.wgsl?raw'

async function initWebGPU(){
    if(!navigator.gpu)
    throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
        // powerPreference: 'low-power'
    })
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice({
        requiredLimits: {
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
        }
    })
    return device
}
async function initPipeline(device: GPUDevice, matrixBuffer:Float32Array, projection:Float32Array){
    const descriptor: GPUComputePipelineDescriptor = {
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: computeTransform
            }),
            entryPoint: 'main'
        }
    }
    const pipeline = await device.createComputePipelineAsync(descriptor)
    // papare gpu buffer
    const modelBuffer = device.createBuffer({
        size: matrixBuffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(modelBuffer, 0, matrixBuffer)
    const projectionBuffer = device.createBuffer({
        size: projection.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(projectionBuffer, 0, projection)
    const mvpBuffer = device.createBuffer({
        size: matrixBuffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })
    const countBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(countBuffer, 0, new Uint32Array([NUM]))
    
    // create a bindGroup to hold three buffers
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: {
                buffer: modelBuffer
            }
        },{
            binding: 1,
            resource: {
                buffer: projectionBuffer
            }
        },{
            binding: 2,
            resource: {
                buffer: mvpBuffer
            }
        },{
            binding: 3,
            resource: {
                buffer: countBuffer
            }
        }]
    })
    return {pipeline, bindGroup, mvpBuffer}
}
async function run(){
    cpu.innerHTML = gpu.innerHTML = '-'
    button.innerHTML = 'Testing ...'
    button.disabled = true
    await new Promise(res=>setTimeout(res))
    // papare data
    const matrixBuffer = new Float32Array(NUM * 4 * 4) // for gpu
    const matrixArray = [] // for cpu
    const projection = mat4.create() as Float32Array// fake projection matrix
    for(let i = 0; i < NUM; i++){
        const fakeMatrix = mat4.create()
        matrixArray.push(fakeMatrix)
        matrixBuffer.set(fakeMatrix, i * 4 * 4)
    }

    // start test cpu time
    console.time('cpu multiply x10')
    let start = performance.now()
    for(let i = 0; i < 10; i++)
        for(let i = 0; i < NUM; i++){
            let m = matrixArray[i]
            mat4.multiply(m, projection, m)
        }
    cpu.innerHTML = ((performance.now() - start) / 10).toFixed(2)
    console.timeEnd('cpu multiply x10')

    // papare gpu
    const device = await initWebGPU()
    const {pipeline, bindGroup, mvpBuffer} = await initPipeline(device, matrixBuffer, projection)
    // run test
    for(let i = 0; i < 100; i++){
        const commandEncoder = device.createCommandEncoder()
        const computePass = commandEncoder.beginComputePass()
        computePass.setPipeline(pipeline)
        computePass.setBindGroup(0, bindGroup)
        computePass.dispatchWorkgroups(Math.ceil(NUM / 128))
        computePass.end()
        device.queue.submit([commandEncoder.finish()])
    }
    // create a read buffer to map mvp back to js
    const readBuffer = device.createBuffer({
        size: matrixBuffer.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })
    // copy and mapAsync will be done after CS pipline
    console.time('gpu multiply x100')
    start = performance.now()
    const commandEncoder = device.createCommandEncoder()
    commandEncoder.copyBufferToBuffer(mvpBuffer, 0, readBuffer, 0, matrixBuffer.byteLength)
    device.queue.submit([commandEncoder.finish()])
    await readBuffer.mapAsync(GPUMapMode.READ)
    gpu.innerHTML = ((performance.now() - start) / 100).toFixed(2)
    console.timeEnd('gpu multiply x100')
    const copyArrayBuffer = readBuffer.getMappedRange()
    const result = new Float32Array(copyArrayBuffer)
    console.log(result)
    readBuffer.unmap()
    button.disabled = false
    button.innerHTML = 'Run'
}

// total count
let NUM = 1000000
let select = document.querySelector('#select') as HTMLSelectElement
let button = document.querySelector('button')  as HTMLButtonElement
let cpu = document.querySelector('#cpu') as HTMLSpanElement
let gpu = document.querySelector('#gpu') as HTMLSpanElement
select.addEventListener('change', (e:any)=>{
    console.log(e.target.value)
    NUM = +e.target.value
    run()
})
button.addEventListener('click', run)