// vite.config.js
import { defineConfig } from 'vite'
import dns from 'dns'
dns.setDefaultResultOrder('verbatim')

module.exports = defineConfig({
    server:{
        host: 'localhost',
        port: 3000
    }
})