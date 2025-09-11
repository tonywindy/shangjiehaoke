import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        works: resolve(__dirname, 'works.html'),
        contact: resolve(__dirname, 'contact.html'),
        climb: resolve(__dirname, 'climb.html'),
        zhouchang: resolve(__dirname, 'zhouchang.html'),
        shuxueyouxi: resolve(__dirname, 'shuxueyouxi.html'),
        mubiaoqiang: resolve(__dirname, 'mubiaoqiang.html'),
      },
    },
  },
});