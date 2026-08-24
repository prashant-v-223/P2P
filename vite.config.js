import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_URL || `http://127.0.0.1:${env.PORT || 5050}`;

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 4050,
      allowedHosts: [
        'p2p.rayzon.one',
      ],
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target,
          changeOrigin: true,
          secure: false,
        }
      }
    },

    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', '@reduxjs/toolkit', 'react-redux'],
            icons: ['lucide-react'],
            charts: ['recharts']
          }
        }
      }
    }
  };
});