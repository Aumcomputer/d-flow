import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host:true,
    port: 3000,
    proxy: {
      '/api': 'http://10.10.90.53:4000',
    },
  },
})
