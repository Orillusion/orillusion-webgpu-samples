// vite.config.js
import { defineConfig } from 'vite'
import dns from 'dns'
dns.setDefaultResultOrder('verbatim')

const devToken = 'AlsgHBaJPdlZ24pkroBSkRHFeYGm+p7QxSiR0reBTV2f60MRKX1GxaJzJHIljZNapPCIuz7+mIGQ2xQFKEaUTgYAAABJeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJmZWF0dXJlIjoiV2ViR1BVIiwiZXhwaXJ5IjoxNjc1MjA5NTk5fQ=='

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