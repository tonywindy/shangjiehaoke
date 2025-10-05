import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { loadQuotesData, getQuotesData } from '../services/quoteService';
import { generateQuoteCard, downloadCard } from '../utils/cardGenerator';
import './QuotesPage.css';

const QuotesPage = () => {
  const [currentQuote, setCurrentQuote] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 备用金句数据
  const backupQuotes = [
    {
      id: "001",
      text: "教育的本质不是传授知识，而是点燃火焰。",
      author: "威廉·巴特勒·叶芝",
      category: "education"
    },
    {
      id: "002", 
      text: "学而时习之，不亦说乎？",
      author: "孔子",
      category: "learning"
    },
    {
      id: "003",
      text: "知识就是力量。",
      author: "培根", 
      category: "wisdom"
    },
    {
      id: "004",
      text: "教育就是当一个人把在学校所学全部忘光之后剩下的东西。",
      author: "爱因斯坦",
      category: "education"
    },
    {
      id: "005",
      text: "学习的敌人是自己的满足，要认真学习一点东西，必须从不自满开始。",
      author: "毛泽东",
      category: "learning"
    }
  ];

  // 初始化数据
  useEffect(() => {
    const loadQuotes = async () => {
      try {
        // 使用内联数据服务，避免HTTP请求
        const quotesData = await loadQuotesData();
        setQuotes(quotesData);
        setCurrentQuote(quotesData[0] || backupQuotes[0]);
      } catch (error) {
        console.error('加载金句失败，使用备用数据:', error);
        setQuotes(backupQuotes);
        setCurrentQuote(backupQuotes[0]);
      }
    };

    loadQuotes();

    // 从localStorage加载收藏
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // 保存收藏到localStorage
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  // 显示新金句的动画效果
  const displayQuote = (quote) => {
    if (!quote) return;
    
    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentQuote(quote);
      setIsTransitioning(false);
    }, 300);
  };

  // 获取随机金句
  const getRandomQuote = () => {
    if (quotes.length === 0) return;
    
    setIsLoading(true);
    
    setTimeout(() => {
      const availableQuotes = quotes.filter(q => q.id !== currentQuote?.id);
      const randomIndex = Math.floor(Math.random() * availableQuotes.length);
      const newQuote = availableQuotes[randomIndex] || quotes[0];
      
      displayQuote(newQuote);
      setIsLoading(false);
    }, 100);
  };

  // 切换收藏状态
  const toggleFavorite = () => {
    if (!currentQuote) return;
    
    const isFavorited = favorites.some(fav => fav.id === currentQuote.id);
    
    if (isFavorited) {
      setFavorites(favorites.filter(fav => fav.id !== currentQuote.id));
    } else {
      setFavorites([...favorites, currentQuote]);
    }
  };

  // 下载金句卡片
  const downloadQuote = async () => {
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

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.target.matches('input, textarea, button')) {
        e.preventDefault();
        getRandomQuote();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [quotes, currentQuote]);

  const isFavorited = currentQuote && favorites.some(fav => fav.id === currentQuote.id);

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
            aria-label="收藏当前金句"
          >
            {isFavorited ? '已收藏' : '收藏'}
          </button>
          
          <button 
            className="btn"
            onClick={downloadQuote}
            aria-label="下载金句卡片"
          >
            下载
          </button>
        </div>
      </main>
    </div>
  );
};

export default QuotesPage;