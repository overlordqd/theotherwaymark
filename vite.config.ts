import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the build works on GitHub Pages under /<repo>/ and on any static host.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        showreel: resolve(__dirname, 'showreel/index.html')
      }
    }
  }
});
