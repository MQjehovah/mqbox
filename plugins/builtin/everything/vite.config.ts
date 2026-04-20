import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'EverythingPlugin',
      formats: ['cjs'],
      fileName: 'index'
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