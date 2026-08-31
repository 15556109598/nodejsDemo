import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 向所有 scss 注入全局设计 token（design-tokens.scss 自身除外，避免循环引入）
        additionalData: (source: string, filename: string) => {
          if (filename.includes('design-tokens.scss')) return source
          return `@import "@/styles/design-tokens.scss";\n${source}`
        },
      },
    },
  },
})
