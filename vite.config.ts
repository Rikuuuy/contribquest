import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const root = import.meta.dirname;

// Copies the read-only prototype and .nojekyll into dist so the deployed
// site keeps serving /contribquest/prototype/ next to the new build.
function copyPrototype(): Plugin {
  return {
    name: 'copy-prototype',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(root, 'dist');
      cpSync(resolve(root, 'prototype'), resolve(outDir, 'prototype'), { recursive: true });
      const nojekyll = resolve(root, '.nojekyll');
      if (existsSync(nojekyll)) {
        cpSync(nojekyll, resolve(outDir, '.nojekyll'));
      }
    },
  };
}

export default defineConfig({
  base: '/contribquest/',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      // Two pages: the root keeps redirecting players to the prototype until the cutover,
      // and the TypeScript build is served at /contribquest/next/.
      input: {
        main: resolve(root, 'index.html'),
        next: resolve(root, 'next/index.html'),
      },
      // `three` goes into its own lazily loaded chunk (`dist/assets/three-[hash].js`, budget 180 KB gzip).
      // Vite 8 bundles with Rolldown, where `manualChunks` is deprecated.
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  plugins: [copyPrototype()],
});
