import React from 'react';
import Navbar from '../components/Navbar';
import { useQuotes } from '../hooks/useQuotes';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { generateQuoteCard, downloadCard } from '../utils/cardGenerator';
import './QuotesPage.css';

/**
 * 金句展示页面组件
 * 展示教育相关的金句，支持换一句、收藏、下载等功能
 */
const QuotesPage = () => {
  const {
    currentQuote,
    isLoading,
    isTransitioning,
    isFavorited,
    getRandomQuote,
    toggleFavorite,
  } = useQuotes();

  /**
   * 下载金句卡片
   */
  const handleDownloadQuote = async () => {
    if (!currentQuote) {
      alert('没有可下载的金句');
      return;
    }

    try {
      // 生成卡片图片
      const cardBlob = await generateQuoteCard(currentQuote);
      
      // 下载卡片
      const filename = `金句卡片_${currentQuote.author}_${Date.now()}.png`;
      downloadCard(cardBlob, filename);
    } catch (error) {
      console.error('生成卡片失败:', error);
      alert('生成卡片失败，请重试');
    }
  };

  // 键盘快捷键 - 按空格键换一句
  useKeyboardShortcut('Space', getRandomQuote, [getRandomQuote]);

  return (
    <div className="quotes-page">
      <Navbar currentPage="quotes" />
      
      {/* 背景装饰 */}
      <div className="background-elements">
        <div className="texture-overlay"></div>
      </div>

      {/* 主内容区 */}
      <main className="quote-container">
        <div className="quote-display">
          <div className="quote-decorations">
            <span className="quote-mark opening">"</span>
            <span className="quote-mark closing">"</span>
          </div>
          
          <blockquote 
            className={`quote-text ${isTransitioning ? 'quote-transition-exit' : 'quote-transition-enter'}`}
            role="main" 
            aria-live="polite"
          >
            {currentQuote ? currentQuote.text : '加载中...'}
          </blockquote>
          
          <footer className="quote-footer">
            <cite className="quote-author">
              {currentQuote ? `— ${currentQuote.author}` : ''}
            </cite>
          </footer>
        </div>
        
        <div className="action-bar" role="toolbar" aria-label="金句操作按钮">
          <button 
            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
            onClick={getRandomQuote}
            disabled={isLoading}
            aria-label="随机获取一句新的金句"
          >
            {isLoading ? '加载中...' : '换一句'}
          </button>
          
          <button 
            className={`btn ${isFavorited ? 'favorited' : ''}`}
            onClick={toggleFavorite}
            aria-label={isFavorited ? '取消收藏' : '收藏当前金句'}
          >
            {isFavorited ? '已收藏' : '收藏'}
          </button>
          
          <button 
            className="btn"
            onClick={handleDownloadQuote}
            aria-label="下载金句卡片"
          >
            下载
          </button>
        </div>
      </main>
    </div>
  );
};

export default React.memo(QuotesPage);
