import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 4050,
    allowedHosts: [
      'p2p.rayzon.one',
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true,
        secure: false,
      }
    }
  },
});