import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/val-workouts': {
        target: 'https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/val-workouts/, '')
      },
      '/api/val-overview': {
        target: 'https://amullinfit--254cc3a4a4cf11f1a9e41607ee4eb77e.web.val.run',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/val-overview/, '')
      },
      '/api/val-gear': {
        target: 'https://amullinfit--de20b782a4cf11f1832e1607ee4eb77e.web.val.run',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/val-gear/, '')
      }
    }
  }
});