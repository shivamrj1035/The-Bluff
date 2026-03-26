import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite-plugin-pwa can be added later when needed
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
})
