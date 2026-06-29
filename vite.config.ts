import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react(), tailwindcss()],
    envDir: '.',
    envPrefix: 'VITE_',
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
  }
})
