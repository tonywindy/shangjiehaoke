import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

function copyStaticGameScripts() {
  return {
    name: 'copy-static-game-scripts',
    closeBundle() {
      mkdirSync(resolve(__dirname, 'dist/caiqi'), { recursive: true });
      copyFileSync(
        resolve(__dirname, 'caiqi/script.js'),
        resolve(__dirname, 'dist/caiqi/script.js')
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticGameScripts()],
  base: '/',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        contact: resolve(__dirname, 'contact.html'),
        works: resolve(__dirname, 'works.html'),
        chufa: resolve(__dirname, 'chufa/index.html'),
        caiqi: resolve(__dirname, 'caiqi/index.html'),
        miwen: resolve(__dirname, 'miwen/index.html'),
        climb: resolve(__dirname, 'climb.html'),
        zhouchang: resolve(__dirname, 'zhouchang.html'),
        shuxueyouxi: resolve(__dirname, 'shuxueyouxi.html'),
        mubiaoqiang: resolve(__dirname, 'mubiaoqiang.html'),
        danweihuansuan: resolve(__dirname, 'danweihuansuan.html'),
        renshixiaoshu: resolve(__dirname, 'renshixiaoshu.html'),
        santitg: resolve(__dirname, 'santitg.html'),
        shudui: resolve(__dirname, 'shudui.html'),
        zuoweibiao: resolve(__dirname, 'zuoweibiao.html'),
        recite: resolve(__dirname, 'recite/index.html'),
        yingbi: resolve(__dirname, 'yingbi.html'),
        shizhen: resolve(__dirname, 'shizhen.html'),
        lucheng: resolve(__dirname, 'lucheng/index.html'),
        duichen: resolve(__dirname, 'duichen.html'),
        zhouchangpingyi: resolve(__dirname, 'zhouchangpingyi.html'),
      },
    },
  },
});
