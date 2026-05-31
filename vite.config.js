import { defineConfig } from 'vite';

// Minimal Vite config. Root holds index.html; /public is served as-is.
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
