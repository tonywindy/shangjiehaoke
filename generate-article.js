#!/usr/bin/env node

/**
 * Markdown转HTML文章生成器
 * 用法: node generate-article.js input.md output.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 简单的Markdown转HTML函数
function markdownToHtml(markdown) {
  return markdown
    // 标题转换
    .replace(/^### (.*$)/gim, '<h3 id="heading-$1">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 id="heading-$1">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 id="heading-$1">$1</h1>')
    
    // 代码块转换
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // 引用转换
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    
    // 列表转换
    .replace(/^\s*\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^\s*\d+\. (.*$)/gim, '<li>$1</li>')
    
    // 粗体和斜体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // 图片转换
    .replace(/!\[([^\]]*?)\]\(([^\)]*?)\)/g, '<img src="$2" alt="$1" />')
    
    // 段落转换（改进处理）
    .split('\n\n')
    .map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<')) return p;
      // 将单个换行转换为<br>标签，但保持段落结构
      const withBreaks = p.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    })
    .filter(p => p)
    .join('\n');
}

// 解析Front Matter
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return { metadata: {}, content };
  }
  
  const [, frontMatter, body] = match;
  const metadata = {};
  
  frontMatter.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      
      // 处理数组格式的tags
      if (key.trim() === 'tags' && value.startsWith('[')) {
        metadata[key.trim()] = value.slice(1, -1).split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
      } else {
        metadata[key.trim()] = value;
      }
    }
  });
  
  return { metadata, content: body };
}

// 生成文章页面
function generateArticle(inputFile, outputFile) {
  try {
    // 读取模板
    const templatePath = path.join(__dirname, 'article-template.html');
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // 读取markdown文件
    const markdownContent = fs.readFileSync(inputFile, 'utf8');
    const { metadata, content } = parseFrontMatter(markdownContent);
    
    // 转换markdown为HTML
    const htmlContent = markdownToHtml(content);
    
    // 生成标签HTML
    const tagsHtml = metadata.tags ? 
      metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join('\n            ') : '';
    
    // 替换模板变量
    template = template
      .replace(/\{\{ARTICLE_TITLE\}\}/g, metadata.title || '未命名文章')
      .replace(/\{\{ARTICLE_SUBTITLE\}\}/g, metadata.subtitle || '')
      .replace(/\{\{ARTICLE_DESCRIPTION\}\}/g, metadata.description || '')
      .replace(/\{\{ARTICLE_KEYWORDS\}\}/g, metadata.keywords || '')
      .replace(/\{\{ARTICLE_DATE\}\}/g, metadata.date || new Date().toLocaleDateString('zh-CN'))
      .replace(/\{\{ARTICLE_CATEGORY\}\}/g, metadata.category || '未分类')
      .replace(/\{\{READING_TIME\}\}/g, metadata.reading_time || '5')
      .replace(/\{\{MARKDOWN_CONTENT\}\}/g, htmlContent)
      .replace(/\{\{ARTICLE_TAGS\}\}/g, tagsHtml)
      .replace(/\{\{TABLE_OF_CONTENTS\}\}/g, '<!-- 目录将自动生成 -->')
      .replace(/\{\{RELATED_ARTICLES\}\}/g, `
            <div class="related-item">
              <a href="./contact.html" class="related-link">
                <div class="related-title">更多教育思考</div>
                <div class="related-meta">
                  <span>📅 持续更新</span>
                  <span>📚 想法分享</span>
                </div>
              </a>
            </div>`)
      .replace(/\{\{VIEW_COUNT\}\}/g, Math.floor(Math.random() * 1000) + 500)
      .replace(/\{\{LIKE_COUNT\}\}/g, Math.floor(Math.random() * 100) + 50)
      .replace(/\{\{COMMENT_COUNT\}\}/g, Math.floor(Math.random() * 50) + 10);
    
    // 写入输出文件
    fs.writeFileSync(outputFile, template);
    console.log(`✅ 文章生成成功: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ 生成文章失败:', error.message);
  }
}

// 命令行使用
if (import.meta.main || process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('用法: node generate-article.js input.md output.html');
    console.log('示例: node generate-article.js example-article.md ai-education.html');
    process.exit(1);
  }
  
  const [inputFile, outputFile] = args;
  generateArticle(inputFile, outputFile);
}

export { generateArticle, markdownToHtml, parseFrontMatter };