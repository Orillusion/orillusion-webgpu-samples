async function initWebGPU() {
    try{
        if(!navigator.gpu)
            throw new Error('Not support WebGPU')
        const adapter = await navigator.gpu.requestAdapter() as GPUAdapter
        const device = await adapter.requestDevice()
        console.log(device)
        document.body.innerHTML = 'Hello WebGPU'
    }catch(error:any){
        document.body.innerHTML = error.message
    }
}

initWebGPU()