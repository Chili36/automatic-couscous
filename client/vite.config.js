import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5178,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
})