# 📚 文章展示框架 - 上节好课

## 🎯 项目概述

为"上节好课"网站设计的完整文章展示框架，包含统一的布局设计、样式系统和内容管理工具。支持从Markdown文件快速生成美观的文章页面。

## 📁 文件结构

```
├── article-template.html        # 文章模板（核心文件）
├── article-template-guide.md    # 详细使用指南
├── generate-article.js          # Markdown转HTML生成器
├── example-article.md           # Markdown示例文件
├── ai-education-example.html    # 生成的示例文章
└── README-ARTICLE-FRAMEWORK.md  # 本文件
```

## 🚀 快速开始

### 1. 创建文章
```bash
# 使用生成器从Markdown创建文章
node generate-article.js your-article.md output-article.html
```

### 2. Markdown格式
创建包含Front Matter的Markdown文件：

```markdown
---
title: "文章标题"
subtitle: "副标题"
date: "2024-01-15"
category: "分类"
tags: ["标签1", "标签2"]
reading_time: 5
description: "SEO描述"
keywords: "关键词"
---

# 正文开始

你的内容...
```

### 3. 部署
将生成的HTML文件放入项目根目录，即可通过浏览器访问。

## 🎨 设计特色

### 统一视觉风格
- 与现有网站保持一致的导航栏和页脚
- 渐变色主题：`#667eea` → `#764ba2`
- 现代化卡片式布局

### 响应式设计
- 桌面端：文章+侧边栏双列布局
- 平板端：单列布局，侧边栏置顶
- 手机端：优化的移动体验

### 功能丰富
- 自动生成目录导航
- 文章分享功能
- 相关文章推荐
- 阅读统计显示
- 返回顶部按钮

## 📝 内容规范

### 标题层级
- `#` - 章节大标题
- `##` - 主要小节
- `###` - 子小节  
- `####` - 细分内容

### 内容元素
- **粗体文本** - 重要内容强调
- *斜体文本* - 特殊术语或引用
- `代码片段` - 技术术语标记
- > 引用块 - 重要观点引用

### 代码块示例
```javascript
// 代码示例
function example() {
  console.log("Hello World");
}
```

## 🛠️ 自定义配置

### 修改样式主题
在 `article-template.html` 中调整CSS变量：

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --text-color: #2d3748;
}
```

### 扩展模板变量
在生成器中添加新的替换变量：

```javascript
template = template.replace(/\{\{NEW_VARIABLE\}\}/g, value);
```

## 📊 SEO优化

### 自动优化
- 语义化HTML结构
- Meta标签自动生成
- 结构化数据支持
- 响应式图片处理

### 手动配置
```markdown
---
description: "页面描述，用于搜索引擎"
keywords: "关键词1,关键词2,关键词3"
---
```

## 🔧 工具使用

### 生成器命令
```bash
# 基本用法
node generate-article.js input.md output.html

# 示例
node generate-article.js ai-education.md ai-education.html
```

### 批量生成
可以编写脚本批量处理多个Markdown文件：

```javascript
import { generateArticle } from './generate-article.js';

const articles = ['article1.md', 'article2.md'];
articles.forEach(file => {
  const output = file.replace('.md', '.html');
  generateArticle(file, output);
});
```

## 🎯 最佳实践

### 文章结构
1. 引人入胜的开头
2. 清晰的章节划分
3. 具体的实例说明
4. 简洁的总结

### 内容质量
- 段落长度适中（3-5句）
- 使用项目符号分解复杂信息
- 添加相关的代码示例
- 包含实际应用场景

### 图片使用
```markdown
![图片描述](./public/images/article-name/image.jpg)
```
- 建议图片尺寸：1200x630（适合社交分享）
- 支持格式：JPG, PNG, WebP
- 文件大小控制在500KB以内

## 🚦 版本控制

### 文件组织
```
articles/
├── published/          # 已发布文章
├── drafts/            # 草稿文件
└── images/            # 文章图片
```

### Git工作流
```bash
# 创建文章分支
git checkout -b article/new-topic

# 提交文章
git add .
git commit -m "添加新文章：主题名称"

# 合并到主分支
git checkout main
git merge article/new-topic
```

## 🔄 更新维护

### 模板更新
1. 修改 `article-template.html`
2. 重新生成所有文章
3. 测试确保兼容性

### 内容更新
1. 修改对应的 `.md` 文件
2. 重新运行生成器
3. 替换原有HTML文件

## 📈 性能优化

### 自动优化
- CSS内联减少HTTP请求
- 图片懒加载
- 代码高亮按需加载

### 手动优化建议
- 压缩图片资源
- 使用CDN加速
- 启用浏览器缓存

## 🎨 样式定制

### 主题颜色
```css
/* 主色调 */
--primary: #667eea;
--secondary: #764ba2;

/* 文字颜色 */
--text-primary: #2d3748;
--text-secondary: #4a5568;
--text-muted: #718096;
```

### 字体设置
```css
font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
```

## 🐛 常见问题

### Q: 生成的文章样式不正确？
A: 检查模板文件路径，确保 `article-template.html` 在正确位置。

### Q: Markdown转换有问题？
A: 确认Markdown语法正确，特别是Front Matter格式。

### Q: 图片无法显示？
A: 检查图片路径，确保相对路径正确指向 `public/images/` 目录。

## 📞 技术支持

如有问题，请参考：
1. `article-template-guide.md` - 详细使用指南
2. `example-article.md` - 标准格式示例
3. 项目Issues页面

---

**上节好课团队** | 技术是路径，好课是目的地 🚀