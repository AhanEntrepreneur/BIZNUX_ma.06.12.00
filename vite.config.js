import { defineConfig } from 'vite';

// Minimal Vite config. The default root is the project folder, which contains
// index.html. We keep things simple for v1; assets in /public are served as-is.
export default defineConfig({
  base: './',
  server: {
    open: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
