import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PORT = 5173;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    proxy: {
      "/getExample": {
        target: `http://localhost:${PORT}`, // Redirect to public file
        changeOrigin: false,
        rewrite: () => "/SignalExample.rsp", // Rewrite URL
      },
    },
  },
})
