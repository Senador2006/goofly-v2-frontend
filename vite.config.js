import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const RENDER_FRONTEND_HOST = 'goofly-v2-frontend.onrender.com'

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
      allowedHosts: [RENDER_FRONTEND_HOST, '.onrender.com'],
      proxy: devProxy,
    },
    preview: {
      port: Number(process.env.PORT) || 4173,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: [RENDER_FRONTEND_HOST, '.onrender.com'],
      // Sem proxy em preview/produção — API usa URL absoluta do gateway.
    },
  }
})
