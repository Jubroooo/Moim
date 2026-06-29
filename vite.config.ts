import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

function resolveShareBaseUrl(mode: string): string {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return (
    env.VITE_SHARE_BASE_URL?.replace(/\/$/, '') ||
    'https://moim.vercel.app'
  )
}

export default defineConfig(({ mode }) => {
  const shareBaseUrl = resolveShareBaseUrl(mode)

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'html-share-base-url',
        transformIndexHtml(html) {
          return html.replaceAll('__SHARE_BASE_URL__', shareBaseUrl)
        },
      },
    ],
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
