import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { templateCompilerOptions } from '@tresjs/core'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // templateCompilerOptions teaches the Vue compiler that <TresXxx> tags are
    // custom elements handled by the TresJS renderer (not missing components).
    vue({ ...templateCompilerOptions }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
