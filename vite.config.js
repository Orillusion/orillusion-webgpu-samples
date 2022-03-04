// vite.config.js
import { defineConfig } from 'vite'
const devToken = 'Amu7sW/oEH3ZqF6SQcPOYVpF9KYNHShFxN1GzM5DY0QW6NwGnbe2kE/YyeQdkSD+kZWhmRnUwQT85zvOA5WYfgAAAABJeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJmZWF0dXJlIjoiV2ViR1BVIiwiZXhwaXJ5IjoxNjUyODMxOTk5fQ=='

module.exports = defineConfig({
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