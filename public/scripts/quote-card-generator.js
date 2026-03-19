// 金句卡片图片生成器
// 用于生成可下载的金句卡片图片

class QuoteCardGenerator {
  constructor(options = {}) {
    this.options = {
      width: 1080,
      height: 1920,
      backgroundColor: '#fefefe',
      textColor: '#2d3748',
      authorColor: '#718096',
      accentColor: '#2c5aa0',
      font: 'Noto Serif SC, serif',
      padding: 120,
      borderRadius: 24,
      ...options
    };
    
    this.canvas = null;
    this.ctx = null;
  }
  
  // 初始化画布
  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.ctx = this.canvas.getContext('2d');
    
    // 启用高DPI支持
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.options.width * dpr;
    this.canvas.height = this.options.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    // 设置画布样式
    this.canvas.style.width = this.options.width + 'px';
    this.canvas.style.height = this.options.height + 'px';
  }
  
  // 文本换行处理
  wrapText(text, maxWidth, lineHeight) {
    const words = text.split('');
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i];
      const metrics = this.ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  // 绘制圆角矩形
  drawRoundedRect(x, y, width, height, radius, fill = true, stroke = false) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    
    if (fill) {
      this.ctx.fill();
    }
    if (stroke) {
      this.ctx.stroke();
    }
  }
  
  // 绘制装饰性引号
  drawQuotationMarks(x, y, width, height) {
    this.ctx.save();
    this.ctx.font = '200px Georgia, serif';
    this.ctx.fillStyle = this.options.accentColor;
    this.ctx.globalAlpha = 0.1;
    
    // 开始引号
    this.ctx.textAlign = 'left';
    this.ctx.fillText('"', x + 40, y + 160);
    
    // 结束引号
    this.ctx.textAlign = 'right';
    this.ctx.fillText('"', x + width - 40, y + height - 40);
    
    this.ctx.restore();
  }
  
  // 绘制背景纹理
  drawBackgroundTexture() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.03;
    this.ctx.fillStyle = this.options.textColor;
    
    const dotSize = 2;
    const spacing = 20;
    
    for (let x = 0; x < this.options.width; x += spacing) {
      for (let y = 0; y < this.options.height; y += spacing) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    this.ctx.restore();
  }
  
  // 绘制品牌标识
  drawBrand(x, y) {
    this.ctx.save();
    this.ctx.font = 'bold 36px ' + this.options.font;
    this.ctx.fillStyle = this.options.accentColor;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('上节好课', x, y);
    
    this.ctx.restore();
  }
  
  // 生成金句卡片
  async generateQuoteCard(quote) {
    return new Promise((resolve, reject) => {
      try {
        this.initCanvas();
        
        // 绘制背景
        this.ctx.fillStyle = this.options.backgroundColor;
        this.drawRoundedRect(0, 0, this.options.width, this.options.height, this.options.borderRadius);
        
        // 绘制背景纹理
        this.drawBackgroundTexture();
        
        // 设置文本渲染属性
        this.ctx.textBaseline = 'top';
        this.ctx.fillStyle = this.options.textColor;
        
        // 计算布局
        const contentWidth = this.options.width - (this.options.padding * 2);
        const centerX = this.options.width / 2;
        
        // 绘制装饰引号
        this.drawQuotationMarks(
          this.options.padding, 
          this.options.padding, 
          contentWidth, 
          this.options.height - (this.options.padding * 2)
        );
        
        // 绘制金句文本
        this.ctx.font = `72px ${this.options.font}`;
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.textAlign = 'center';
        
        const quoteLines = this.wrapText(quote.text, contentWidth - 120, 100);
        const totalQuoteHeight = quoteLines.length * 100;
        const quoteStartY = (this.options.height - totalQuoteHeight) / 2 - 100;
        
        quoteLines.forEach((line, index) => {
          this.ctx.fillText(
            line, 
            centerX, 
            quoteStartY + (index * 100)
          );
        });
        
        // 绘制作者信息
        this.ctx.font = `48px ${this.options.font}`;
        this.ctx.fillStyle = this.options.authorColor;
        this.ctx.fillText(
          `— ${quote.author}`, 
          centerX, 
          quoteStartY + totalQuoteHeight + 80
        );
        
        // 分类标签已移除
        
        // 绘制品牌标识
        this.drawBrand(centerX, this.options.height - 120);
        
        // 转换为图片数据
        const dataUrl = this.canvas.toDataURL('image/png', 0.9);
        resolve(dataUrl);
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // 下载图片
  downloadImage(dataUrl, filename = '金句卡片.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  // 生成并下载金句卡片
  async generateAndDownload(quote) {
    try {
      const dataUrl = await this.generateQuoteCard(quote);
      const filename = `${quote.author}_${quote.text.substring(0, 10)}.png`;
      this.downloadImage(dataUrl, filename);
      return true;
    } catch (error) {
      console.error('生成卡片失败:', error);
      return false;
    }
  }
  
  // 清理资源
  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}

// 工具函数
const ImageUtils = {
  // 检查浏览器支持
  isSupported() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      return !!(canvas && ctx);
    } catch (error) {
      return false;
    }
  },
  
  // 压缩图片
  compressImage(dataUrl, quality = 0.8, format = 'image/jpeg') {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const compressedDataUrl = canvas.toDataURL(format, quality);
        resolve(compressedDataUrl);
      };
      
      img.src = dataUrl;
    });
  },
  
  // 获取图片尺寸
  getImageSize(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = dataUrl;
    });
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuoteCardGenerator, ImageUtils };
} else {
  window.QuoteCardGenerator = QuoteCardGenerator;
  window.ImageUtils = ImageUtils;
}