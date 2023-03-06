// vite.config.js
import { defineConfig } from 'vite'
import dns from 'dns'
dns.setDefaultResultOrder('verbatim')

const devToken = 'Aotk4lKyJjKvozg4JQVI4jGolGC06ZvTfZvwadeZiFeSA0v7WAcM4B5aheEG632PcQTxLQDazEEFfF1k5Sr7agIAAABJeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJmZWF0dXJlIjoiV2ViR1BVIiwiZXhwaXJ5IjoxNjkxNzExOTk5fQ=='

module.exports = defineConfig({
    server:{
        host: 'localhost',
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