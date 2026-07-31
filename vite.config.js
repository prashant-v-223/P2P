import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetPort = env.PORT || '5001';
  const target = `http://127.0.0.1:${targetPort}`;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        // SSE endpoint needs special handling — no buffering, no timeout
        '/api/events': {
          target,
          changeOrigin: true,
          secure: false,
          ws: false,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Ensure SSE headers pass through without buffering
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            });
          }
        },
        // All other API calls
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          ws: true
        }
      }
    }
  }
})
