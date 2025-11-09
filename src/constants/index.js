/**
 * 应用程序常量配置
 * 统一管理魔法数字、字符串等常量
 */

// 本地存储键名
export const STORAGE_KEYS = {
  FAVORITES: 'favorites',
  SHOWN_QUOTE_IDS: 'shownQuoteIds',
};

// 动画时长 (毫秒)
export const ANIMATION_DURATION = {
  TRANSITION: 300,
  LOADING: 100,
};

// 金句卡片配置
export const CARD_CONFIG = {
  WIDTH: 540,
  HEIGHT: 960,
  PADDING: 60,
  DPR: window.devicePixelRatio || 1,
  FONT_SIZE: {
    QUOTE: 36,
    AUTHOR: 24,
    BRAND: 18,
  },
  LINE_HEIGHT: 60,
};

// 颜色配置
export const COLORS = {
  GRADIENT: {
    START: '#f8fafc',
    MID: '#f1f5f9',
    END: '#e2e8f0',
  },
  TOP_BAR: {
    START: '#3b82f6',
    MID: '#1d4ed8',
    END: '#1e40af',
  },
  TEXT: {
    PRIMARY: '#144a74',
    SECONDARY: '#134857',
    TERTIARY: 'rgba(100, 116, 139, 0.6)',
  },
};

// 导航链接配置
export const NAV_LINKS = [
  { path: '/', label: '初见之页', key: 'home' },
  { path: '/works', label: '些许尝试', key: 'works' },
  { path: '/quotes', label: '一点想法', key: 'quotes' },
];

// 页面标题
export const PAGE_TITLES = {
  HOME: '上节好课',
  WORKS: '些许尝试',
  QUOTES: '一点想法',
};

// 默认值
export const DEFAULTS = {
  RANDOM_QUOTE_COUNT: 1,
  MEDAL_RANKS: {
    GOLD: 5,
    SILVER: 15,
    BRONZE: 30,
  },
};

