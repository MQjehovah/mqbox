import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    electron([
      {
        entry: resolve(__dirname, 'src/main/index.ts'),
        vite: { 
          build: { 
            outDir: resolve(__dirname, 'dist-electron/main'),
            sourcemap: true
          } 
        }
      },
      {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        vite: { 
          build: { 
            outDir: resolve(__dirname, 'dist-electron/preload'),
            sourcemap: true
          } 
        }
      }
    ])
  ],
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  root: resolve(__dirname, 'src/renderer'),
  build: { 
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})