import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Offline by default — see src/test/setup.ts.
    setupFiles: ['src/test/setup.ts'],
  },
})
