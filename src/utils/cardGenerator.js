import { CARD_CONFIG, COLORS } from '../constants';

/**
 * 金句卡片生成器
 * 使用Canvas API生成手机尺寸的简约金句卡片
 */

/**
 * 创建并配置 Canvas 元素
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
const createCanvas = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('无法获取 Canvas 2D 上下文');
  }
  
  // 设置高分辨率
  canvas.width = CARD_CONFIG.WIDTH * CARD_CONFIG.DPR;
  canvas.height = CARD_CONFIG.HEIGHT * CARD_CONFIG.DPR;
  canvas.style.width = CARD_CONFIG.WIDTH + 'px';
  canvas.style.height = CARD_CONFIG.HEIGHT + 'px';
  ctx.scale(CARD_CONFIG.DPR, CARD_CONFIG.DPR);
  
  return { canvas, ctx };
};

/**
 * 绘制背景渐变
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 */
const drawBackground = (ctx) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_CONFIG.HEIGHT);
  gradient.addColorStop(0, COLORS.GRADIENT.START);
  gradient.addColorStop(0.5, COLORS.GRADIENT.MID);
  gradient.addColorStop(1, COLORS.GRADIENT.END);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_CONFIG.WIDTH, CARD_CONFIG.HEIGHT);
};

/**
 * 绘制装饰性背景图案
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 */
const drawBackgroundPattern = (ctx) => {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * CARD_CONFIG.WIDTH,
      Math.random() * CARD_CONFIG.HEIGHT,
      Math.random() * 50 + 10,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
};

/**
 * 绘制顶部装饰条
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 */
const drawTopBar = (ctx) => {
  const topBarGradient = ctx.createLinearGradient(0, 0, CARD_CONFIG.WIDTH, 0);
  topBarGradient.addColorStop(0, COLORS.TOP_BAR.START);
  topBarGradient.addColorStop(0.5, COLORS.TOP_BAR.MID);
  topBarGradient.addColorStop(1, COLORS.TOP_BAR.END);
  ctx.fillStyle = topBarGradient;
  ctx.fillRect(0, 0, CARD_CONFIG.WIDTH, 8);
};

/**
 * 将文本分行
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 * @param {string} text - 要分行的文本
 * @param {number} maxWidth - 最大宽度
 * @returns {string[]} 分行后的文本数组
 */
const wrapText = (ctx, text, maxWidth) => {
  const words = text.split('');
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
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
};

/**
 * 绘制金句文本
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 * @param {string} text - 金句文本
 */
const drawQuoteText = (ctx, text) => {
  const maxWidth = CARD_CONFIG.WIDTH - CARD_CONFIG.PADDING * 2;
  
  ctx.font = `${CARD_CONFIG.FONT_SIZE.QUOTE}px "Noto Serif SC", "Source Han Serif SC", "LXGW WenKai", serif`;
  ctx.fillStyle = COLORS.TEXT.PRIMARY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 文本换行处理
  const lines = wrapText(ctx, text, maxWidth);
  
  // 计算文本起始位置
  const textStartY = CARD_CONFIG.HEIGHT / 2 - (lines.length * CARD_CONFIG.LINE_HEIGHT) / 2;
  
  // 绘制每行文本
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      CARD_CONFIG.WIDTH / 2,
      textStartY + index * CARD_CONFIG.LINE_HEIGHT
    );
  });
};

/**
 * 绘制作者信息
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 * @param {string} author - 作者名字
 */
const drawAuthor = (ctx, author) => {
  const authorY = CARD_CONFIG.HEIGHT - CARD_CONFIG.PADDING - 120;
  
  // 作者分隔线
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CARD_CONFIG.WIDTH / 2 - 60, authorY - 30);
  ctx.lineTo(CARD_CONFIG.WIDTH / 2 + 60, authorY - 30);
  ctx.stroke();
  
  // 作者名字
  ctx.font = `${CARD_CONFIG.FONT_SIZE.AUTHOR}px "Noto Serif SC", "Source Han Serif SC", "LXGW WenKai", serif`;
  ctx.fillStyle = COLORS.TEXT.SECONDARY;
  ctx.textAlign = 'center';
  ctx.fillText(`— ${author}`, CARD_CONFIG.WIDTH / 2, authorY);
};

/**
 * 绘制底部品牌信息
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 */
const drawBrand = (ctx) => {
  ctx.font = `${CARD_CONFIG.FONT_SIZE.BRAND}px "Noto Serif SC", "Source Han Serif SC", "LXGW WenKai", serif`;
  ctx.fillStyle = COLORS.TEXT.TERTIARY;
  ctx.textAlign = 'center';
  ctx.fillText('上节好课', CARD_CONFIG.WIDTH / 2, CARD_CONFIG.HEIGHT - CARD_CONFIG.PADDING + 20);
};

/**
 * 生成金句卡片
 * @param {Object} quote - 金句对象
 * @param {string} quote.text - 金句文本
 * @param {string} quote.author - 作者
 * @returns {Promise<Blob>} 返回图片Blob对象
 * @throws {Error} 当生成失败时抛出错误
 */
export const generateQuoteCard = async (quote) => {
  // 验证输入
  if (!quote || !quote.text || !quote.author) {
    throw new Error('无效的金句数据：缺少必要的字段');
  }
  
  try {
    // 创建 Canvas
    const { canvas, ctx } = createCanvas();
    
    // 绘制背景
    drawBackground(ctx);
    drawBackgroundPattern(ctx);
    drawTopBar(ctx);
    
    // 绘制内容
    drawQuoteText(ctx, quote.text);
    drawAuthor(ctx, quote.author);
    drawBrand(ctx);
    
    // 添加微妙的阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    
    // 转换为Blob
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas 转换为 Blob 失败'));
          }
        }, 'image/png', 1.0);
      } catch (error) {
        reject(new Error(`Canvas 转换失败: ${error.message}`));
      }
    });
  } catch (error) {
    throw new Error(`生成卡片失败: ${error.message}`);
  }
};

/**
 * 下载卡片图片
 * @param {Blob} blob - 图片Blob对象
 * @param {string} filename - 文件名
 * @throws {Error} 当下载失败时抛出错误
 */
export const downloadCard = (blob, filename) => {
  if (!blob) {
    throw new Error('无效的 Blob 对象');
  }
  
  if (!filename) {
    throw new Error('文件名不能为空');
  }
  
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // 添加到 DOM 并触发点击
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(`下载失败: ${error.message}`);
  }
};
