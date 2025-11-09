import { useState, useEffect, useCallback } from 'react';
import { loadQuotesData } from '../services/quoteService';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS, ANIMATION_DURATION } from '../constants';

/**
 * 备用金句数据
 */
const BACKUP_QUOTES = [
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

/**
 * 自定义 Hook: 管理金句相关的所有状态和逻辑
 * @returns {Object} 返回金句相关的状态和操作函数
 */
export const useQuotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.FAVORITES, []);
  const [shownQuoteIds, setShownQuoteIds] = useLocalStorage(STORAGE_KEYS.SHOWN_QUOTE_IDS, []);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  /**
   * 初始化数据并设置第一条金句
   */
  const initializeQuote = useCallback((quotesData, firstQuote) => {
    setQuotes(quotesData);
    setCurrentQuote(firstQuote);
    
    // 将首次展示的金句添加到已展示列表
    if (firstQuote && !shownQuoteIds.includes(firstQuote.id)) {
      setShownQuoteIds(prev => [...prev, firstQuote.id]);
    }
  }, [shownQuoteIds, setShownQuoteIds]);

  /**
   * 初始化加载金句数据
   */
  useEffect(() => {
    const loadQuotes = async () => {
      try {
        const quotesData = await loadQuotesData();
        const firstQuote = quotesData[0] || BACKUP_QUOTES[0];
        initializeQuote(quotesData, firstQuote);
      } catch (error) {
        console.error('加载金句失败，使用备用数据:', error);
        const firstQuote = BACKUP_QUOTES[0];
        initializeQuote(BACKUP_QUOTES, firstQuote);
      }
    };

    loadQuotes();
  }, []); // 只在组件挂载时执行一次

  /**
   * 显示新金句的动画效果
   */
  const displayQuote = useCallback((quote) => {
    if (!quote) return;
    
    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentQuote(quote);
      setIsTransitioning(false);
    }, ANIMATION_DURATION.TRANSITION);
  }, []);

  /**
   * 获取随机金句 - 优先展示未展示过的金句
   */
  const getRandomQuote = useCallback(() => {
    if (quotes.length === 0) return;
    
    setIsLoading(true);
    
    setTimeout(() => {
      // 排除当前正在展示的金句
      const availableQuotes = quotes.filter(q => q.id !== currentQuote?.id);
      
      // 优先从未展示过的金句中选择
      const unshownQuotes = availableQuotes.filter(q => !shownQuoteIds.includes(q.id));
      
      let newQuote;
      if (unshownQuotes.length > 0) {
        // 有未展示的金句，从中随机选择
        const randomIndex = Math.floor(Math.random() * unshownQuotes.length);
        newQuote = unshownQuotes[randomIndex];
      } else {
        // 所有金句都已展示过，重置记录并从所有可用金句中选择
        console.log('所有金句已展示完毕，重新开始循环');
        setShownQuoteIds([]);
        const randomIndex = Math.floor(Math.random() * availableQuotes.length);
        newQuote = availableQuotes[randomIndex] || quotes[0];
      }
      
      // 将新选择的金句ID添加到已展示列表
      if (newQuote && !shownQuoteIds.includes(newQuote.id)) {
        setShownQuoteIds(prev => [...prev, newQuote.id]);
      }
      
      displayQuote(newQuote);
      setIsLoading(false);
    }, ANIMATION_DURATION.LOADING);
  }, [quotes, currentQuote, shownQuoteIds, displayQuote, setShownQuoteIds]);

  /**
   * 切换收藏状态
   */
  const toggleFavorite = useCallback(() => {
    if (!currentQuote) return;
    
    const isFavorited = favorites.some(fav => fav.id === currentQuote.id);
    
    if (isFavorited) {
      setFavorites(favorites.filter(fav => fav.id !== currentQuote.id));
    } else {
      setFavorites([...favorites, currentQuote]);
    }
  }, [currentQuote, favorites, setFavorites]);

  /**
   * 检查当前金句是否已收藏
   */
  const isFavorited = currentQuote && favorites.some(fav => fav.id === currentQuote.id);

  return {
    currentQuote,
    quotes,
    favorites,
    isLoading,
    isTransitioning,
    isFavorited,
    getRandomQuote,
    toggleFavorite,
  };
};

