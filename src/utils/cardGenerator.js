/**
 * 金句卡片生成器
 * 使用Canvas API生成手机尺寸的简约金句卡片
 */

/**
 * 生成金句卡片
 * @param {Object} quote - 金句对象
 * @param {string} quote.text - 金句文本
 * @param {string} quote.author - 作者
 * @returns {Promise<Blob>} 返回图片Blob对象
 */
export const generateQuoteCard = async (quote) => {
  // 手机屏幕尺寸 (9:16 比例)
  const cardWidth = 540;
  const cardHeight = 960;
  const padding = 60;
  
  // 创建Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // 设置高分辨率
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cardWidth * dpr;
  canvas.height = cardHeight * dpr;
  canvas.style.width = cardWidth + 'px';
  canvas.style.height = cardHeight + 'px';
  ctx.scale(dpr, dpr);
  
  // 绘制背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, cardHeight);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(0.5, '#f1f5f9');
  gradient.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cardWidth, cardHeight);
  
  // 绘制装饰性背景图案
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * cardWidth,
      Math.random() * cardHeight,
      Math.random() * 50 + 10,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  
  // 绘制顶部装饰条
  const topBarGradient = ctx.createLinearGradient(0, 0, cardWidth, 0);
  topBarGradient.addColorStop(0, '#3b82f6');
  topBarGradient.addColorStop(0.5, '#1d4ed8');
  topBarGradient.addColorStop(1, '#1e40af');
  ctx.fillStyle = topBarGradient;
  ctx.fillRect(0, 0, cardWidth, 8);
  
  // 设置文本样式
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 计算并绘制金句文本
  const maxWidth = cardWidth - padding * 2;
  const lineHeight = 60;
  const fontSize = 36;
  
  ctx.font = `${fontSize}px "Noto Serif SC", "Source Han Serif SC", "LXGW WenKai", serif`;
  ctx.fillStyle = '#144a74';
  
  // 文本换行处理
  const words = quote.text.split('');
  const lines = [];
  let currentLine = '';
  
  for (let word of words) {
    const testLine = currentLine + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  
  // 计算文本起始位置
  const textStartY = cardHeight / 2 - (lines.length * lineHeight) / 2;
  
  // 绘制每行文本
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      cardWidth / 2,
      textStartY + index * lineHeight
    );
  });
  
  // 绘制作者信息
  const authorY = cardHeight - padding - 120;
  
  // 作者分隔线
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardWidth / 2 - 60, authorY - 30);
  ctx.lineTo(cardWidth / 2 + 60, authorY - 30);
  ctx.stroke();
  
  // 作者名字
  ctx.font = `${24}px "Noto Serif SC", "Source Han Serif SC", "LXGW WenKai", serif`;
  ctx.fillStyle = '#134857';
  ctx.fillText(`— ${quote.author}`, cardWidth / 2, authorY);
  
  // 绘制底部品牌信息
  ctx.font = `${18}px "Noto Serif SC", "Source Han Serif SC", "LXGW WenKai", serif`;
  ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
  ctx.fillText('上节好课', cardWidth / 2, cardHeight - padding + 20);
  
  // 添加微妙的阴影效果
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  
  // 转换为Blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png', 1.0);
  });
};

/**
 * 下载卡片图片
 * @param {Blob} blob - 图片Blob对象
 * @param {string} filename - 文件名
 */
export const downloadCard = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};