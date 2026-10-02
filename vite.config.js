import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const FRONTEND_ALLOWED_HOSTS = [
  'goofly-v2-frontend.onrender.com',
  'www.goofly.com.br',
  'goofly.com.br',
  '.onrender.com',
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_DEV_API_PROXY || 'http://localhost:3000'

  const devProxy = {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
      secure: true,
    },
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      allowedHosts: FRONTEND_ALLOWED_HOSTS,
      proxy: devProxy,
    },
    preview: {
      port: Number(process.env.PORT) || 4173,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: FRONTEND_ALLOWED_HOSTS,
      // Sem proxy em preview/produção — API usa URL absoluta do gateway.
    },
    build: {
      rollupOptions: {
        output: {
          // Vite 8 / Rolldown: manualChunks deve ser Function (objeto não é suportado).
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/') || id.endsWith('/react')) {
              return 'vendor'
            }
            if (id.includes('axios')) {
              return 'axios'
            }
            if (id.includes('@sentry')) {
              return 'sentry'
            }
          },
        },
      },
    },
  }
})
