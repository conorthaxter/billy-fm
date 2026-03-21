import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app:  resolve(__dirname, 'app/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy /auth and /api to the worker in dev so cookies work on same origin
      '/auth': 'http://localhost:8787',
      '/api':  'http://localhost:8787',
    },
  },
});
