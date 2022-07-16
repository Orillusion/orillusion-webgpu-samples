import {mat4} from 'gl-matrix'
import computeTransform from './shaders/compute.transform.wgsl?raw'

async function initWebGPU(){
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
    return device
}
async function initPipeline(device: GPUDevice, modelMatrix:Float32Array, projection:Float32Array){
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
    // papare gpu buffers
    // hold nx4x4 modelView matrix buffer
    const modelBuffer = device.createBuffer({
        size: modelMatrix.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    console.time('writeBuffer')
    device.queue.writeBuffer(modelBuffer, 0, modelMatrix)
    console.timeEnd('writeBuffer')
    // hold a 4x4 projection buffer
    const projectionBuffer = device.createBuffer({
        size: projection.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(projectionBuffer, 0, projection)
    // create a n*4x4 matrix buffer to hold result
    const mvpBuffer = device.createBuffer({
        size: modelMatrix.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })
    // indicate the size of total matrix
    const countBuffer = device.createBuffer({
        size: 4, // just one uint32 number
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(countBuffer, 0, new Uint32Array([NUM]))
    
    // create a bindGroup to hold 4 buffers
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
    // small delay for rendering UI
    await new Promise(res=>setTimeout(res))
    // papare data
    const fakeMatrix = mat4.create()
    const modelMatrix = new Float32Array(NUM * 4 * 4) // hold gpu matrix
    const matrixArray = [] // hold cpu matrix
    const projection = fakeMatrix as Float32Array// fake projection matrix
    for(let i = 0; i < NUM; i++){
        matrixArray.push(fakeMatrix)
        modelMatrix.set(fakeMatrix, i * 4 * 4)
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
    const {pipeline, bindGroup, mvpBuffer} = await initPipeline(device, modelMatrix, projection)
    // papare a read buffer to map mvp back to js
    const readBuffer = device.createBuffer({
        size: modelMatrix.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })
    // run test x300
    const commandEncoder = device.createCommandEncoder()
    for(let i = 0; i < 300; i++){
        const computePass = commandEncoder.beginComputePass()
        computePass.setPipeline(pipeline)
        computePass.setBindGroup(0, bindGroup)
        computePass.dispatchWorkgroups(Math.ceil(NUM / 128))
        computePass.end()
    }
    // copy mvpBuffer will be done after all computePasses
    commandEncoder.copyBufferToBuffer(mvpBuffer, 0, readBuffer, 0, modelMatrix.byteLength)
    device.queue.submit([commandEncoder.finish()])
    // compute time by mapAsync
    console.time('gpu multiply x300')
    start = performance.now()
    // map readBuffer from GPU to CPU/JS
    await readBuffer.mapAsync(GPUMapMode.READ)
    gpu.innerHTML = ((performance.now() - start) / 300).toFixed(2)
    console.timeEnd('gpu multiply x300')
    // transfor buffer to JS object
    const copyArrayBuffer = readBuffer.getMappedRange()
    const result = new Float32Array(copyArrayBuffer)
    console.log(result)
    // unmap GPU buffer and release CPU/JS buffer
    readBuffer.unmap()
    // reset UI
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