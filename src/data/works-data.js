/**
 * 页面与作品统一数据源
 * - 站点页：继续由 React 页面承载
 * - 教学工具页：短期保留为独立静态页面
 */

export const PAGE_TYPES = {
  SITE: 'site',
  TOOL: 'tool',
};

export const SITE_PAGES = [
  {
    id: 'home',
    title: '初见之页',
    description: '网站首页，承载品牌介绍与整体导航。',
    path: '/',
    pageType: PAGE_TYPES.SITE,
    tags: ['React', '站点页'],
  },
  {
    id: 'works',
    title: '些许尝试',
    description: '作品总览页，统一展示所有教学工具与实验作品。',
    path: '/works.html',
    pageType: PAGE_TYPES.SITE,
    tags: ['React', '作品列表'],
  },
  {
    id: 'quotes',
    title: '一点想法',
    description: '金句与思考页，负责内容展示、收藏与下载。',
    path: '/contact',
    pageType: PAGE_TYPES.SITE,
    tags: ['React', '内容页'],
  },
];

export const WORKS_DATA = [
  {
    id: 'zhouchangpingyi',
    title: '平移变换与周长变化',
    cover: '/images/zhouchangpingyi.png',
    path: '/zhouchangpingyi.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['图形几何', '动画演示'],
    featured: true,
  },
  {
    id: 'shuxueyouxi',
    title: '一人一世界数学情境答题游戏',
    cover: '/images/shijie.jpeg',
    path: '/shuxueyouxi.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['AI故事', '数学游戏'],
    featured: true,
  },
  {
    id: 'santitg',
    title: '三题通关精准计算训练营',
    cover: '/images/santtg.png',
    path: '/santitg.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['计算训练', '闯关'],
    featured: true,
  },
  {
    id: 'climb',
    title: '两位数乘法登山挑战游戏',
    cover: '/images/dengshan.jpeg',
    path: '/climb.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['乘法', '游戏化'],
  },
  {
    id: 'zhouchang',
    title: '周长的探索之旅',
    cover: '/images/zhouchang.jpeg',
    path: '/zhouchang.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['周长', '可视化'],
  },
  {
    id: 'danweihuansuan',
    title: '长度单位换算交互式学习工具',
    cover: '/images/danweihuansuan.png',
    path: '/danweihuansuan.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['单位换算', '练习工具'],
  },
  {
    id: 'renshixiaoshu',
    title: '认识小数：元角分大探险',
    cover: '/images/renshixiaoshu.png',
    path: '/renshixiaoshu.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['小数', '情境学习'],
  },
  {
    id: 'recite',
    title: '背诵冒险记',
    cover: '/images/beisong-background.jpg',
    path: '/recite/index.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['背诵', '冒险'],
  },
  {
    id: 'shudui',
    title: '数对四子棋游戏',
    cover: '/images/shudui.png',
    path: '/shudui.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['数对', '对战'],
  },
  {
    id: 'zuoweibiao',
    title: '班级座位表管理系统',
    cover: '/images/zuoweibiao.png',
    path: '/zuoweibiao.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['班级管理', '实用工具'],
  },
  {
    id: 'yingbi',
    title: '抛硬币频率分析模拟器',
    cover: '/images/yingbifengmian.png',
    path: '/yingbi.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['概率', '模拟实验'],
  },
  {
    id: 'shizhen',
    title: '时钟夹角工具',
    cover: '/images/shizhong1.png',
    path: '/shizhen.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['时钟', '几何'],
  },
  {
    id: 'lucheng',
    title: '完美停车（路程问题）',
    cover: '/images/lucheng.png',
    path: '/lucheng/index.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['路程问题', '互动练习'],
  },
  {
    id: 'duichen',
    title: '轴对称探索画板',
    cover: '/images/duicheng.png',
    path: '/duichen.html',
    pageType: PAGE_TYPES.TOOL,
    tags: ['轴对称', '画板'],
  },
];

export const TEACHING_TOOL_PAGES = WORKS_DATA.filter(
  (work) => work.pageType === PAGE_TYPES.TOOL
);

export const FEATURED_WORKS = WORKS_DATA.filter((work) => work.featured);
