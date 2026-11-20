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
  },
  plugins: [copyPrototype()],
});
