import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const serverUrl = process.env.VITE_SERVER_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: serverUrl,
        changeOrigin: true,
      },
      '/socket.io': {
        target: serverUrl,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
