import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 固定开发端口，与Tauri devUrl和CORS白名单保持一致
  server: {
    port: 5173,
    strictPort: true,
  },
})
