import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const basePath = process.env.VITE_BASE_PATH || '/';

function copyStaticGameScripts() {
  return {
    name: 'copy-static-game-scripts',
    closeBundle() {
      [
        ['caiqi/script.js', 'dist/caiqi/script.js'],
        ['miwen/script.js', 'dist/miwen/script.js'],
        ['teacher-workspace/access-control.js', 'dist/teacher-workspace/access-control.js'],
      ].forEach(([from, to]) => {
        mkdirSync(resolve(projectRoot, to, '..'), { recursive: true });
        copyFileSync(resolve(projectRoot, from), resolve(projectRoot, to));
      });

      // 静态托管平台会在未知地址返回 404.html，页面内再展示友好的 React 404。
      copyFileSync(
        resolve(projectRoot, 'dist/index.html'),
        resolve(projectRoot, 'dist/404.html'),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticGameScripts()],
  base: basePath,
  publicDir: 'public',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        contact: resolve(projectRoot, 'contact.html'),
        works: resolve(projectRoot, 'works.html'),
        chufa: resolve(projectRoot, 'chufa/index.html'),
        caiqi: resolve(projectRoot, 'caiqi/index.html'),
        miwen: resolve(projectRoot, 'miwen/index.html'),
        climb: resolve(projectRoot, 'climb.html'),
        zhouchang: resolve(projectRoot, 'zhouchang.html'),
        shuxueyouxi: resolve(projectRoot, 'shuxueyouxi.html'),
        mubiaoqiang: resolve(projectRoot, 'mubiaoqiang.html'),
        danweihuansuan: resolve(projectRoot, 'danweihuansuan.html'),
        renshixiaoshu: resolve(projectRoot, 'renshixiaoshu.html'),
        santitg: resolve(projectRoot, 'santitg.html'),
        shudui: resolve(projectRoot, 'shudui.html'),
        zuoweibiao: resolve(projectRoot, 'zuoweibiao.html'),
        recite: resolve(projectRoot, 'recite/index.html'),
        yingbi: resolve(projectRoot, 'yingbi.html'),
        shizhen: resolve(projectRoot, 'shizhen.html'),
        lucheng: resolve(projectRoot, 'lucheng/index.html'),
        duichen: resolve(projectRoot, 'duichen.html'),
        zhouchangpingyi: resolve(projectRoot, 'zhouchangpingyi.html'),
        aiMathAssistant: resolve(projectRoot, 'ai-math-assistant/index.html'),
        teacherWorkspace: resolve(projectRoot, 'teacher-workspace/index.html'),
        teacherWorkspaceAccount: resolve(projectRoot, 'teacher-workspace/account.html'),
        teacherWorkspaceAdmin: resolve(projectRoot, 'teacher-workspace/admin.html'),
        teacherWorkspaceTerms: resolve(projectRoot, 'teacher-workspace/terms.html'),
        teacherWorkspaceProfile: resolve(projectRoot, 'teacher-workspace/profile.html'),
        teacherWorkspaceToday: resolve(projectRoot, 'teacher-workspace/today.html'),
        teacherWorkspaceTasks: resolve(projectRoot, 'teacher-workspace/tasks.html'),
        teacherWorkspaceClass: resolve(projectRoot, 'teacher-workspace/class.html'),
        teacherWorkspaceLearning: resolve(projectRoot, 'teacher-workspace/learning.html'),
        teacherWorkspaceReview: resolve(projectRoot, 'teacher-workspace/review-export.html'),
        teacherWorkspaceV07: resolve(projectRoot, 'teacher-workspace/v07/index.html'),
      },
    },
  },
});
