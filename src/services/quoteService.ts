import { educationQuotes, getQuotesByCategory, getQuotesByTag, getRandomQuotes } from '../data/quotes.js';

export interface Quote {
  id: string;
  text: string;
  author: string;
  category: string;
  tags?: string[];
}

/**
 * 加载金句数据 - 使用内联数据，避免HTTP请求
 * @returns {Promise<Array>} 返回金句数据数组
 */
export const loadQuotesData = async (): Promise<Quote[]> => {
  // 直接返回内联数据，无需HTTP请求
  return Promise.resolve(educationQuotes);
};

/**
 * 同步获取金句数据
 * @returns {Array} 返回金句数据数组
 */
export const getQuotesData = (): Quote[] => {
  return educationQuotes;
};

/**
 * 默认金句数据
 */
export const defaultQuotes: Quote[] = educationQuotes;

// 导出辅助函数
export { getQuotesByCategory, getQuotesByTag, getRandomQuotes };