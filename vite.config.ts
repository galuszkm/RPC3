import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PORT = 5173;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',  // Ensures relative paths in imports
  build: {
    outDir: 'dist',  // Output directory
    assetsDir: '',    // Place assets in the same directory as index.html
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',   // No subfolder for entry files
        chunkFileNames: '[name]-[hash].js',  // No subfolder for chunks
        assetFileNames: '[name]-[hash][extname]',  // No subfolder for assets
      }
    }
  },
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
