// vite.config.js (optional, for StackBlitz local dev server preview)
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
      }
    }
  }
});