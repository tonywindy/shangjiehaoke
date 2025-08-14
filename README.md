# 上节好课 (shangjiehaoke)

一个基于 React + Vite 的现代化教育网站项目。

## 项目特色

- 🎥 **视频背景**: 支持自定义背景视频，带加载状态和错误处理
- 🎨 **现代设计**: 渐变色彩、动画效果、响应式布局
- ⚡ **快速开发**: 基于 Vite 构建，支持热重载
- 📱 **移动友好**: 完全响应式设计，适配各种设备

## 技术栈

- **前端框架**: React 19.1.1
- **构建工具**: Vite 7.1.1
- **样式**: CSS3 + 现代动画
- **开发工具**: ESLint + 热重载

## 快速开始

1. 安装依赖:
```bash
npm install
```

2. 启动开发服务器:
```bash
npm run dev
```

3. 构建生产版本:
```bash
npm run build
```

## 项目结构

- `src/App.jsx` - 主应用组件
- `src/App.css` - 主样式文件
- `public/your-video.mp4` - 背景视频文件
- `public/logo1.png` - 网站Logo
- `preview.html` - 项目预览说明页面

## 自定义配置

### 更换背景视频
1. 将视频文件命名为 `your-video.mp4`
2. 放置在 `public/` 文件夹中
3. 建议视频大小控制在10MB以下，使用H.264编码

### 更换Logo
1. 将Logo文件命名为 `logo1.png`
2. 放置在 `public/` 文件夹中
3. 建议尺寸为300x200像素或等比例

## 部署说明

项目支持部署到各种静态网站托管平台，如 GitHub Pages、Vercel、Netlify 等。

## 开发者

项目由 tonywindy 开发维护。
