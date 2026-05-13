import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const campusId = env.CAMPUS_ID || env.VITE_CAMPUS_ID || '41'

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_CAMPUS_ID': JSON.stringify(campusId)
    },
    server: {
      allowedHosts: ['panbagnat.42nice.fr', 'localhost'],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4173',
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
