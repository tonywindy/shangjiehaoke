# Logo 修改指南

本指南将详细介绍如何修改网站中的 Logo，包括文字 Logo 和图片 Logo 两种方式。

## 🎯 Logo 位置

Logo 位于网站的中央位置，包含以下元素：
- 主要 Logo（文字或图片）
- 副标题
- 装饰元素
- 导航栏品牌名称

## 📝 方法一：修改文字 Logo

### 1. 修改主要文字

在 `src/App.jsx` 文件中找到以下代码：

```jsx
<h1 className="logo-text">YOUR LOGO</h1>
<div className="logo-subtitle">创意无限 · 科技未来</div>
```

**修改步骤：**
- 将 `YOUR LOGO` 替换为你的品牌名称
- 将 `创意无限 · 科技未来` 替换为你的副标题或标语

**示例：**
```jsx
<h1 className="logo-text">科技创新</h1>
<div className="logo-subtitle">引领未来 · 创造价值</div>
```

### 2. 修改导航栏品牌名称

在同一文件中找到：
```jsx
<span className="brand-text">BRAND</span>
```

将 `BRAND` 替换为你的品牌名称。

## 🖼️ 方法二：使用图片 Logo

### 1. 准备图片文件

**推荐格式：**
- PNG（支持透明背景）
- SVG（矢量图，最佳选择）
- JPG（如果不需要透明背景）

**推荐尺寸：**
- 宽度：200-400px
- 高度：100-200px
- 比例：2:1 或 3:2

### 2. 添加图片文件

将你的 Logo 图片文件放置在 `public/` 目录下，例如：
- `public/logo.png`
- `public/logo.svg`
- `public/my-brand-logo.png`

### 3. 修改代码

在 `src/App.jsx` 中，注释掉文字 Logo 部分，启用图片 Logo：

**注释文字 Logo：**
```jsx
{/* 
<div className="logo">
  <h1 className="logo-text">YOUR LOGO</h1>
  <div className="logo-subtitle">创意无限 · 科技未来</div>
</div>
*/}
```

**启用图片 Logo：**
```jsx
<img 
  src="/logo.png" 
  alt="Your Brand Logo" 
  className="logo-image"
/>
```

## 🎨 方法三：组合使用

你也可以同时使用图片和文字：

```jsx
<div className="logo">
  <img 
    src="/logo.png" 
    alt="Brand Logo" 
    className="logo-image"
    style={{marginBottom: '1rem'}}
  />
  <h1 className="logo-text">品牌名称</h1>
  <div className="logo-subtitle">品牌标语</div>
</div>
```

## 🎯 自定义样式

### 修改文字颜色和效果

在 `src/App.css` 中找到 `.logo-text` 样式，可以修改：

```css
.logo-text {
  /* 修改渐变颜色 */
  background: linear-gradient(135deg, #your-color1, #your-color2, #your-color3);
  
  /* 修改字体大小 */
  font-size: clamp(3rem, 8vw, 6rem);
  
  /* 修改字体粗细 */
  font-weight: 900;
}
```

### 修改副标题样式

```css
.logo-subtitle {
  /* 修改颜色 */
  color: rgba(255, 255, 255, 0.8);
  
  /* 修改字体大小 */
  font-size: clamp(1rem, 2.5vw, 1.5rem);
}
```

### 修改图片 Logo 样式

```css
.logo-image {
  /* 修改最大宽度 */
  max-width: 300px;
  
  /* 修改最大高度 */
  max-height: 200px;
  
  /* 修改滤镜效果 */
  filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.5));
}
```

## 🔧 高级自定义

### 1. 添加动画效果

为 Logo 添加自定义动画：

```css
.logo-text {
  animation: customAnimation 3s ease-in-out infinite;
}

@keyframes customAnimation {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
```

### 2. 响应式调整

针对不同屏幕尺寸调整 Logo：

```css
@media (max-width: 768px) {
  .logo-text {
    font-size: clamp(2rem, 10vw, 4rem);
  }
  
  .logo-image {
    max-width: 200px;
    max-height: 120px;
  }
}
```

## 📋 快速修改清单

- [ ] 确定使用文字 Logo 还是图片 Logo
- [ ] 准备 Logo 素材（文字内容或图片文件）
- [ ] 修改 `src/App.jsx` 中的 Logo 内容
- [ ] 修改导航栏品牌名称
- [ ] 调整 CSS 样式（可选）
- [ ] 测试不同屏幕尺寸的显示效果
- [ ] 保存并查看预览效果

## 💡 设计建议

1. **保持简洁**：Logo 应该简洁明了，易于识别
2. **考虑可读性**：确保在视频背景上文字清晰可见
3. **品牌一致性**：Logo 风格应与整体网站风格保持一致
4. **响应式设计**：确保 Logo 在各种设备上都能正常显示
5. **加载性能**：如果使用图片，优化文件大小以提高加载速度

## 🚀 测试建议

修改完成后，建议测试以下场景：
- 桌面端浏览器
- 移动端浏览器
- 不同的视频背景
- 网络较慢的情况下的加载效果

---

如果遇到任何问题，请检查浏览器控制台是否有错误信息，或参考项目的其他文档。