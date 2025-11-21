import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['grapesjs', 'grapesjs-blocks-basic']
  },
  ssr: {
    noExternal: ['grapesjs', 'grapesjs-blocks-basic']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  }
});

