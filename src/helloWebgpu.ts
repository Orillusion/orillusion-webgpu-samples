async function initWebGPU() {
    try{
        if(!navigator.gpu)
            throw new Error('Not support WebGPU')
        const adapter = await navigator.gpu.requestAdapter()
        if(!adapter)
            throw new Error('No adapter found')
        const device = await adapter.requestDevice()
        // console.log(device)
        document.body.innerHTML = '<h1>Hello WebGPU</h1>'
        let i:keyof GPUSupportedLimits
        for(i in device.limits)
            document.body.innerHTML += `<p>${i}:${device.limits[i]}</p>`
    }catch(error:any){
        document.body.innerHTML = `<h1>${error.message}</h1>`
    }
}

initWebGPU()