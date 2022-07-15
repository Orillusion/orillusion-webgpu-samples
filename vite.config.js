// vite.config.js
import { defineConfig } from 'vite'
const devToken = 'AjPwILqou86MNqXlfZc0tZycsl9U9sV/uI2ti0RK1/w0kT3/l35O3zugkEb31z1gKbxnakvZahtfWf9h42buSA4AAABJeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJmZWF0dXJlIjoiV2ViR1BVIiwiZXhwaXJ5IjoxNjYzNzE4Mzk5fQ=='

module.exports = defineConfig({
    server:{
        port: 3000
    },
    plugins: [
        {
            name: 'Origin-Trial',
            configureServer: server => {
                server.middlewares.use((_req, res, next) => {
                    res.setHeader("Origin-Trial", devToken)
                    next()
                })
            }
        }
    ]
})