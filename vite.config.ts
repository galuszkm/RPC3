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
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].js',   // No subfolder for entry files
        chunkFileNames: 'js/[name]-[hash].js',  // No subfolder for chunks
        assetFileNames: ({ name }) => {
          if (/\.(woff2?|eot|ttf|otf)$/.test(name ?? '')) {
            return 'fonts/[name][extname]'
          }
          if (/\.(png|jpe?g|gif|svg|lottie)$/.test(name ?? '')) {
            return 'img/[name][extname]'
          }
          if (/\.css$/.test(name ?? '')) {
            return 'css/[name][extname]' // Ensures CSS goes into 'css/' folder
          }
          if (/\.js$/.test(name ?? '')) {
            return 'js/[name][extname]' // Ensures CSS goes into 'css/' folder
          }
          return '[name][extname]'
        },
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
