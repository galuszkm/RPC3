// vitest.config.ts

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // You can configure various Vitest options here:
    globals: true,            // If you want 'describe', 'it', etc. globally
    environment: 'node',      // If you want to test Node-based code (e.g. fs)
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
