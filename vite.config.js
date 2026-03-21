import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /auth and /api to the worker in dev so cookies work on same origin
      '/auth': 'http://localhost:8787',
      '/api':  'http://localhost:8787',
    },
  },
});
