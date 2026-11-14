import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 读取package.json版本用于构建期注入
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // 固定开发端口，与Tauri devUrl和CORS白名单保持一致
  server: {
    port: 5173,
    strictPort: true,
  },
})
