import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'maps';
          if (id.includes('@tanstack') || id.includes('axios') || id.includes('zustand')) return 'query';
          if (id.includes('framer-motion') || id.includes('recharts') || id.includes('lucide-react')) {
            return 'visuals';
          }
          if (id.includes('react')) return 'react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
  test: {
    exclude: ['node_modules/**', 'dist/**', 'src/tests/e2e/**'],
  },
});
