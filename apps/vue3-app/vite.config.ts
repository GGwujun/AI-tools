import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const fundApiTarget = process.env.FUND_API_PROXY_TARGET || 'http://127.0.0.1:8000'

const fundApiProxy = {
  target: fundApiTarget,
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/fund-api/, ''),
}

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'https://dsx-family.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ymq': {
        target: 'https://dsx-family.site',
        changeOrigin: true,
      },
      '/wtf-api': {
        target: 'https://wtf.dsx-family.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wtf-api/, ''),
      },
      '/fund-api': fundApiProxy,
    },
  },
  preview: {
    host: '0.0.0.0',
    proxy: {
      '/fund-api': fundApiProxy,
    },
  },
})
