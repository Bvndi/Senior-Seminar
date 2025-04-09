import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Your Express server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') // Remove '/api' prefix
      }
    }
  }
});