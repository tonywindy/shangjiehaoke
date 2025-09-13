# 文章模板使用指南

## 📋 模板概述

这是一个专为"上节好课"网站设计的文章展示模板，包含完整的布局结构：
- 导航栏（与现有网站保持一致）
- 文章内容区域（支持Markdown渲染）
- 侧边栏（目录、相关文章、分享等功能）
- 页脚（网站信息和链接）

## 🔧 使用方法

### 1. 模板变量替换

在 `article-template.html` 中，需要替换以下变量：

#### 文章基本信息
- `{{ARTICLE_TITLE}}` - 文章标题
- `{{ARTICLE_SUBTITLE}}` - 文章副标题/摘要
- `{{ARTICLE_DESCRIPTION}}` - 文章描述（用于SEO）
- `{{ARTICLE_KEYWORDS}}` - 文章关键词（用于SEO）
- `{{ARTICLE_DATE}}` - 发布日期（格式：2024年1月15日）
- `{{ARTICLE_CATEGORY}}` - 文章分类标签
- `{{READING_TIME}}` - 预计阅读时间（分钟）

#### 文章内容
- `{{MARKDOWN_CONTENT}}` - Markdown转换后的HTML内容
- `{{ARTICLE_TAGS}}` - 文章标签列表
- `{{TABLE_OF_CONTENTS}}` - 文章目录（自动生成）
- `{{RELATED_ARTICLES}}` - 相关文章列表

#### 统计数据
- `{{VIEW_COUNT}}` - 阅读量
- `{{LIKE_COUNT}}` - 点赞数
- `{{COMMENT_COUNT}}` - 评论数

### 2. 创建新文章页面

1. 复制 `article-template.html` 并重命名（如：`article-ai-education.html`）
2. 替换所有模板变量
3. 将Markdown内容转换为HTML并插入到 `{{MARKDOWN_CONTENT}}` 位置

## 📝 Markdown格式要求

为了确保UI设计统一，你的Markdown文件需要包含以下信息：

### 文件头部元数据（Front Matter）
```yaml
---
title: "文章标题"
subtitle: "文章副标题或摘要"
date: "2024-01-15"
category: "技术分享"
tags: ["AI", "教育", "JavaScript", "前端开发"]
reading_time: 8
description: "文章的SEO描述，用于搜索引擎优化"
keywords: "AI教育,游戏化学习,前端开发"
author: "作者名称"
---
```

### 正文结构要求

#### 1. 标题层级
- 使用 `#` 到 `####` 四级标题
- `#` 用于章节大标题
- `##` 用于主要小节
- `###` 用于子小节
- `####` 用于细分内容

#### 2. 段落和格式
- 段落之间保留空行
- 使用**粗体**强调重要内容
- 使用*斜体*表示引用或特殊术语
- 使用`行内代码`标记技术术语

#### 3. 列表格式
```markdown
- 无序列表项1
- 无序列表项2
  - 子列表项
  - 子列表项

1. 有序列表项1
2. 有序列表项2
```

#### 4. 引用格式
```markdown
> 这是一段重要的引用文字，会显示为特殊的引用样式。
> 支持多行引用。
```

#### 5. 代码块
```markdown
\`\`\`javascript
// JavaScript代码示例
function createGame() {
  console.log("创建游戏");
}
\`\`\`
```

#### 6. 图片插入
```markdown
![图片描述](./images/article-image.jpg)
```
- 图片建议放在 `public/images/` 目录下
- 图片描述会显示为alt文本
- 支持常见格式：jpg, png, gif, webp

## 🎨 样式说明

### 颜色主题
- 主色调：`#667eea` (蓝紫色)
- 辅助色：`#764ba2` (深紫色)
- 文字色：`#2d3748` (深灰)
- 链接色：`#667eea`

### 字体规范
- 标题：Inter, SF Pro Display
- 正文：Inter, 系统默认
- 代码：Fira Code, Monaco, Consolas

### 响应式设计
- 桌面端：文章 + 侧边栏布局
- 平板端：单列布局，侧边栏移至顶部
- 手机端：优化的单列布局

## 🔗 示例文章结构

```markdown
---
title: "如何用AI技术改变传统教育"
subtitle: "探索人工智能在教育领域的创新应用与实践"
date: "2024-01-15"
category: "AI教育"
tags: ["人工智能", "教育创新", "技术应用", "未来教育"]
reading_time: 6
description: "本文探讨人工智能技术如何改变传统教育模式，提升学习效果"
keywords: "AI教育,人工智能,教育技术,在线学习"
---

# 引言

在这个数字化时代，人工智能正在重塑各行各业，教育领域也不例外...

## AI在教育中的应用

### 个性化学习
人工智能可以根据每个学生的学习特点...

### 智能评估
通过AI技术，我们可以实现更准确的学习评估...

## 技术实现案例

以下是一个简单的AI学习推荐算法：

\`\`\`javascript
function recommendContent(studentProfile, contentLibrary) {
  // AI推荐逻辑
  return filteredContent;
}
\`\`\`

## 未来展望

> 技术是路径，好课是目的地。AI技术的发展为教育带来了无限可能。

## 总结

通过本文的探讨，我们看到了AI技术在教育领域的巨大潜力...
```

## 📁 文件组织建议

```
project/
├── articles/
│   ├── ai-education.html          # 生成的文章页面
│   ├── frontend-guide.html        # 生成的文章页面
│   └── ...
├── markdown/
│   ├── ai-education.md           # 原始Markdown文件
│   ├── frontend-guide.md         # 原始Markdown文件
│   └── ...
├── public/
│   ├── images/
│   │   ├── ai-education/         # 文章专用图片文件夹
│   │   └── frontend-guide/
│   └── ...
└── article-template.html         # 基础模板
```

## 🚀 快速开始

1. 准备你的Markdown文件（按照上述格式）
2. 将Markdown转换为HTML
3. 使用模板生成最终的文章页面
4. 将文章页面放入项目根目录
5. 在主导航或文章列表中添加链接

## ⚡ 自动化建议

可以考虑使用以下工具自动化文章生成过程：
- `marked.js` - Markdown转HTML
- `front-matter` - 解析文件头部元数据
- 自定义Node.js脚本自动生成文章页面

## 🔄 更新维护

当你需要更新文章时：
1. 修改对应的Markdown文件
2. 重新生成HTML页面
3. 替换原文件即可

这样可以保持内容和展示的分离，便于维护和更新。