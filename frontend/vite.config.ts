import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4205,
    allowedHosts: ['srv-dkr-01', 'localhost', '127.0.0.1']
  },
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

