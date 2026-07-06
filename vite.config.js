import { defineConfig } from 'vite';

// Relative base so the built site works under any subpath
// (e.g. apps.charliekrug.com/metawipe) without a rewrite.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
