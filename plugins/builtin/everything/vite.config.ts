import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        Config: resolve(__dirname, 'src/Config.vue')
      },
      formats: ['cjs'],
      fileName: (format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: ['electron', 'path', 'fs', 'child_process'],
      output: {
        exports: 'default'
      }
    }
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, '../../main')
    }
  }
})