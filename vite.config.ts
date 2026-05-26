import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0' // 🌸 解決網頁連不上問題：監聽 0.0.0.0 所有網路 IP 位址
  }
})
