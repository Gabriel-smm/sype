import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Talk to FastAPI through the dev server so the app is same-origin.
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.BACKEND_PORT ?? 8000}`, changeOrigin: true },
    },
  },
})
