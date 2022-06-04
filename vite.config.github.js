const { defineConfig } = require('vite')
const { resolve } = require('path')
const fs = require('fs')

const input = {
    main: resolve(__dirname, 'index.html')
}
const samples = fs.readdirSync(resolve(__dirname, 'samples'))
for(let file of samples){
    if(file.endsWith('.html'))
        input[file.slice(0, -5)] = resolve(__dirname, 'samples/'+ file)
}
module.exports = defineConfig({
    base: '/orillusion-webgpu-samples/',
    build: {
        rollupOptions: {
            input
        }
    }
})