# 如何添加您自己的视频背景

## 📹 视频文件准备

### 1. 视频格式要求
- **推荐格式**: MP4 (H.264编码)
- **备用格式**: WebM (VP9编码)
- **分辨率**: 建议1920x1080或更高
- **比例**: 16:9 (推荐)
- **文件大小**: 建议小于50MB以确保快速加载

### 2. 视频内容建议
- 时长: 10-30秒的循环视频效果最佳
- 内容: 选择与您品牌相关的视觉内容
- 亮度: 避免过亮的视频，以确保文字清晰可读
- 动作: 缓慢、平滑的动作效果更佳

## 🔧 添加视频的步骤

### 方法一：替换现有文件
1. 将您的视频文件重命名为 `your-video.mp4`
2. 将文件放置在 `public/` 文件夹中
3. 如果有WebM格式，也重命名为 `your-video.webm` 并放置在同一位置

### 方法二：修改代码中的文件名
1. 将您的视频文件放置在 `public/` 文件夹中
2. 打开 `src/App.jsx` 文件
3. 找到以下代码行：
   ```jsx
   <source src="/your-video.mp4" type="video/mp4" />
   <source src="/your-video.webm" type="video/webm" />
   ```
4. 将 `your-video.mp4` 和 `your-video.webm` 替换为您的实际文件名

## 📁 文件结构示例
```
public/
├── vite.svg
├── your-video.mp4     ← 您的主视频文件
├── your-video.webm    ← 您的备用视频文件（可选）
└── your-logo.png      ← 您的Logo文件（如果使用图片Logo）
```

## 🎨 自定义Logo

### 使用文字Logo（当前设置）
在 `src/App.jsx` 中修改以下内容：
```jsx
<h1 className="logo-text">YOUR LOGO</h1>
<div className="logo-subtitle">创意无限 · 科技未来</div>
```

### 使用图片Logo
1. 将Logo图片放置在 `public/` 文件夹中
2. 在 `src/App.jsx` 中取消注释并修改以下代码：
```jsx
<img 
  src="/your-logo.png" 
  alt="Your Logo" 
  className="logo-image"
/>
```
3. 注释掉文字Logo部分

## ⚡ 性能优化建议

### 视频优化
- 使用视频压缩工具减小文件大小
- 考虑使用CDN托管大型视频文件
- 为移动设备提供较小尺寸的视频版本

### 加载优化
- 添加视频预加载：`<video preload="metadata">`
- 考虑添加加载动画或占位图
- 为慢速网络提供静态图片备选方案

## 🔧 高级自定义

### 添加多个视频源
```jsx
<video autoPlay muted loop playsInline className="background-video">
  <source src="/video-desktop.mp4" type="video/mp4" media="(min-width: 768px)" />
  <source src="/video-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
  <source src="/video-desktop.webm" type="video/webm" media="(min-width: 768px)" />
</video>
```

### 添加视频控制
如果需要用户控制视频播放：
```jsx
<video 
  controls 
  autoPlay 
  muted 
  loop 
  playsInline 
  className="background-video"
>
```

## 🎯 测试建议

1. **不同设备测试**: 在桌面、平板、手机上测试
2. **不同浏览器测试**: Chrome、Firefox、Safari、Edge
3. **网络条件测试**: 在不同网速下测试加载效果
4. **可访问性测试**: 确保在禁用视频时网站仍可正常使用

## 🚨 注意事项

- 确保您拥有视频的使用权限
- 考虑添加静音控制选项以提升用户体验
- 某些移动浏览器可能不支持自动播放
- 大文件可能影响网站加载速度

## 📞 需要帮助？

如果您在添加视频时遇到问题，请检查：
1. 文件路径是否正确
2. 文件格式是否支持
3. 浏览器控制台是否有错误信息
4. 网络连接是否正常