// QuoteManager 核心逻辑类
// 管理金句展示、随机选择、收藏等功能

class QuoteManager {
  constructor(quotes = []) {
    this.quotes = quotes;
    this.currentIndex = 0;
    this.usedQuotes = new Set();
    this.favorites = this.loadFavorites();
    this.history = [];
    this.maxHistorySize = 10;
    
    // 事件监听器
    this.listeners = {
      'quote-changed': [],
      'favorites-updated': [],
      'error': []
    };
    
    // 预加载队列
    this.preloadQueue = [];
    this.preloadSize = 3;
    
    this.init();
  }
  
  init() {
    if (this.quotes.length > 0) {
      this.preloadNextQuotes();
      this.currentQuote = this.getRandomQuote();
    }
  }
  
  // 事件系统
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }
  
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }
  
  // 获取随机金句（避免重复）
  getRandomQuote() {
    if (this.quotes.length === 0) {
      this.emit('error', { message: '没有可用的金句数据' });
      return null;
    }
    
    // 如果所有金句都用过了，重置已使用列表
    if (this.usedQuotes.size >= this.quotes.length) {
      this.usedQuotes.clear();
      console.log('所有金句已展示完毕，重新开始循环');
    }
    
    // 获取未使用的金句
    const availableQuotes = this.quotes.filter(quote => 
      !this.usedQuotes.has(quote.id)
    );
    
    if (availableQuotes.length === 0) {
      // 这种情况理论上不应该发生，但作为后备方案
      return this.quotes[Math.floor(Math.random() * this.quotes.length)];
    }
    
    // 随机选择一个未使用的金句
    const randomIndex = Math.floor(Math.random() * availableQuotes.length);
    const selectedQuote = availableQuotes[randomIndex];
    
    // 标记为已使用
    this.usedQuotes.add(selectedQuote.id);
    
    // 添加到历史记录
    this.addToHistory(selectedQuote);
    
    return selectedQuote;
  }
  
  // 获取下一个金句
  nextQuote() {
    const newQuote = this.getRandomQuote();
    if (newQuote) {
      this.currentQuote = newQuote;
      this.emit('quote-changed', newQuote);
      this.preloadNextQuotes();
    }
    return newQuote;
  }
  
  // 获取当前金句
  getCurrentQuote() {
    return this.currentQuote;
  }
  
  // 预加载下几条金句
  preloadNextQuotes() {
    this.preloadQueue = [];
    for (let i = 0; i < this.preloadSize; i++) {
      // 这里可以实现预加载逻辑
      // 比如预处理图片、准备动画等
    }
  }
  
  // 添加到历史记录
  addToHistory(quote) {
    this.history.unshift(quote);
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
  }
  
  // 获取历史记录
  getHistory() {
    return [...this.history];
  }
  
  // 收藏功能
  toggleFavorite(quoteId) {
    if (!quoteId) {
      quoteId = this.currentQuote?.id;
    }
    
    if (!quoteId) return false;
    
    const index = this.favorites.indexOf(quoteId);
    if (index > -1) {
      // 取消收藏
      this.favorites.splice(index, 1);
    } else {
      // 添加收藏
      this.favorites.push(quoteId);
    }
    
    this.saveFavorites();
    this.emit('favorites-updated', {
      quoteId,
      isFavorited: this.isFavorited(quoteId),
      favorites: [...this.favorites]
    });
    
    return this.isFavorited(quoteId);
  }
  
  // 检查是否已收藏
  isFavorited(quoteId) {
    if (!quoteId && this.currentQuote) {
      quoteId = this.currentQuote.id;
    }
    return this.favorites.includes(quoteId);
  }
  
  // 获取收藏的金句
  getFavoriteQuotes() {
    return this.quotes.filter(quote => 
      this.favorites.includes(quote.id)
    );
  }
  
  // 获取收藏列表
  getFavorites() {
    return [...this.favorites];
  }
  
  // 按分类筛选金句
  getQuotesByCategory(category) {
    return this.quotes.filter(quote => quote.category === category);
  }
  
  // 按标签搜索金句
  searchQuotesByTag(tag) {
    return this.quotes.filter(quote => 
      quote.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
    );
  }
  
  // 按作者搜索金句
  getQuotesByAuthor(author) {
    return this.quotes.filter(quote => 
      quote.author.toLowerCase().includes(author.toLowerCase())
    );
  }
  
  // 文本搜索
  searchQuotes(searchText) {
    const searchLower = searchText.toLowerCase();
    return this.quotes.filter(quote => 
      quote.text.toLowerCase().includes(searchLower) ||
      quote.author.toLowerCase().includes(searchLower) ||
      quote.source?.toLowerCase().includes(searchLower)
    );
  }
  
  // 获取分享文本
  getShareText(quote = null) {
    if (!quote) quote = this.currentQuote;
    if (!quote) return '';
    
    return `"${quote.text}"

—— ${quote.author}

分享自"上节好课"一点想法页面`;
  }
  
  // 获取分享数据
  getShareData(quote = null) {
    if (!quote) quote = this.currentQuote;
    if (!quote) return null;
    
    return {
      title: `${quote.author}的智慧金句`,
      text: this.getShareText(quote),
      url: window.location.href + `?quote=${quote.id}`
    };
  }
  
  // 复制到剪贴板
  async copyToClipboard(quote = null) {
    const text = this.getShareText(quote);
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      }
    } catch (error) {
      console.error('复制失败:', error);
      this.emit('error', { message: '复制失败，请手动复制' });
      return false;
    }
  }
  
  // 原生分享
  async nativeShare(quote = null) {
    if (!navigator.share) {
      return false;
    }
    
    const shareData = this.getShareData(quote);
    if (!shareData) return false;
    
    try {
      await navigator.share(shareData);
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('分享失败:', error);
        this.emit('error', { message: '分享失败' });
      }
      return false;
    }
  }
  
  // 本地存储管理
  saveFavorites() {
    try {
      localStorage.setItem('quote-favorites', JSON.stringify(this.favorites));
    } catch (error) {
      console.error('保存收藏失败:', error);
    }
  }
  
  loadFavorites() {
    try {
      const saved = localStorage.getItem('quote-favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('加载收藏失败:', error);
      return [];
    }
  }
  
  // 保存用户偏好
  savePreferences(preferences) {
    try {
      localStorage.setItem('quote-preferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('保存偏好失败:', error);
    }
  }
  
  loadPreferences() {
    try {
      const saved = localStorage.getItem('quote-preferences');
      return saved ? JSON.parse(saved) : {
        autoPlay: false,
        animationSpeed: 'normal',
        preferredCategories: []
      };
    } catch (error) {
      console.error('加载偏好失败:', error);
      return {};
    }
  }
  
  // 统计信息
  getStats() {
    const categoryCount = {};
    this.quotes.forEach(quote => {
      categoryCount[quote.category] = (categoryCount[quote.category] || 0) + 1;
    });
    
    return {
      totalQuotes: this.quotes.length,
      favoriteCount: this.favorites.length,
      usedQuotes: this.usedQuotes.size,
      historyCount: this.history.length,
      categoryCount
    };
  }
  
  // 重置状态
  reset() {
    this.usedQuotes.clear();
    this.history = [];
    this.currentQuote = this.getRandomQuote();
    this.emit('quote-changed', this.currentQuote);
  }
  
  // 销毁实例
  destroy() {
    this.listeners = {};
    this.quotes = [];
    this.preloadQueue = [];
    this.currentQuote = null;
  }
}

// 工具函数
const QuoteUtils = {
  // 格式化日期
  formatDate(date) {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    }).format(date);
  },
  
  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  },
  
  // 动画帧
  requestAnimationFrame(callback) {
    return window.requestAnimationFrame || 
           window.webkitRequestAnimationFrame || 
           window.mozRequestAnimationFrame || 
           function(callback) { setTimeout(callback, 16); };
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuoteManager, QuoteUtils };
} else {
  window.QuoteManager = QuoteManager;
  window.QuoteUtils = QuoteUtils;
}