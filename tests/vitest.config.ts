import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src/renderer/src'),
      '@plugins': resolve(__dirname, '../plugins'),
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/screenshot.ts', 'src/renderer/src/components/ScreenshotPanel.vue'],
      exclude: ['node_modules', 'tests'],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50
      }
    }
  }
})
