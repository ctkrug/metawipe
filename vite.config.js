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
    coverage: {
      provider: 'v8',
      // All of src is now under test (main.js via the createApp factory); the
      // only unhit line is the browser boot guard, which needs a real #app root.
      include: ['src/**'],
    },
  },
});
