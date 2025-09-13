// 金句数据结构和管理模块
// 数据结构定义

const QUOTE_CATEGORIES = {
  education: 'education',
  wisdom: 'wisdom', 
  inspiration: 'inspiration',
  learning: 'learning'
};

// 教育金句数据库
const educationQuotes = [
  {
    id: "001",
    text: "教育不是注满一桶水，而是点燃一把火。",
    author: "威廉·巴特勒·叶芝",
    category: QUOTE_CATEGORIES.education,
    tags: ["inspiration", "teaching", "fire"],
    source: "教育哲学"
  },
  {
    id: "002",
    text: "我听见了就忘记了，我看见了就记住了，我做了就理解了。",
    author: "蒙台梭利",
    category: QUOTE_CATEGORIES.learning,
    tags: ["experience", "understanding", "practice"],
    source: "蒙台梭利教育法"
  },
  {
    id: "003",
    text: "教育的根是苦的，但其果实是甜的。",
    author: "亚里士多德",
    category: QUOTE_CATEGORIES.wisdom,
    tags: ["effort", "reward", "perseverance"],
    source: "古希腊哲学"
  },
  {
    id: "004",
    text: "教学的艺术不在于传授本领，而在于激励、唤醒和鼓舞。",
    author: "第斯多惠",
    category: QUOTE_CATEGORIES.education,
    tags: ["art", "inspire", "awaken"],
    source: "教育学原理"
  },
  {
    id: "005",
    text: "儿童不是需要被填满的容器，而是需要被点燃的火焰。",
    author: "普鲁塔克",
    category: QUOTE_CATEGORIES.education,
    tags: ["children", "inspiration", "potential"],
    source: "古希腊教育思想"
  },
  {
    id: "006",
    text: "教育的目的应当是向人传送生命的气息。",
    author: "泰戈尔",
    category: QUOTE_CATEGORIES.education,
    tags: ["purpose", "life", "vitality"],
    source: "教育思想"
  },
  {
    id: "007",
    text: "教育的最高目标不是知识而是行动。",
    author: "赫伯特·斯宾塞",
    category: QUOTE_CATEGORIES.education,
    tags: ["action", "knowledge", "practice"],
    source: "教育论"
  },
  {
    id: "008",
    text: "只有受过一种合适的教育之后，人才能成为一个人。",
    author: "夸美纽斯",
    category: QUOTE_CATEGORIES.education,
    tags: ["humanity", "development", "growth"],
    source: "大教学论"
  },
  {
    id: "009",
    text: "如果我们按照自己的方式教导孩子走路、说话，那么每个孩子都会失败。",
    author: "约翰·霍尔特",
    category: QUOTE_CATEGORIES.education,
    tags: ["individuality", "teaching", "failure"],
    source: "教育改革思想"
  },
  {
    id: "010",
    text: "教育不是准备生活，教育就是生活本身。",
    author: "约翰·杜威",
    category: QUOTE_CATEGORIES.education,
    tags: ["life", "experience", "pragmatism"],
    source: "实用主义教育"
  },
  {
    id: "011",
    text: "最好的老师是那些告诉你哪里寻找，却不告诉你找到什么的人。",
    author: "亚历山大·诺克斯",
    category: QUOTE_CATEGORIES.education,
    tags: ["teacher", "guidance", "discovery"],
    source: "教育方法论"
  },
  {
    id: "012",
    text: "告诉我的，我会忘记；教给我的，我可能记住；让我参与，我才能学会。",
    author: "本杰明·富兰克林",
    category: QUOTE_CATEGORIES.learning,
    tags: ["participation", "experience", "memory"],
    source: "实践教育"
  },
  {
    id: "013",
    text: "每个孩子都是艺术家，问题是如何在长大后仍然保持艺术家的身份。",
    author: "毕加索",
    category: QUOTE_CATEGORIES.inspiration,
    tags: ["creativity", "children", "art"],
    source: "艺术教育"
  },
  {
    id: "014",
    text: "教育的主要目的应该是培养能够做新事情的人，而不仅仅是重复前人所做的事情。",
    author: "让·皮亚杰",
    category: QUOTE_CATEGORIES.education,
    tags: ["innovation", "creativity", "development"],
    source: "认知发展理论"
  },
  {
    id: "015",
    text: "教育是让一个人能够分辨谁在胡说八道的能力。",
    author: "埃德蒙·伯克",
    category: QUOTE_CATEGORIES.wisdom,
    tags: ["critical thinking", "judgment", "wisdom"],
    source: "政治哲学"
  },
  {
    id: "016",
    text: "教育的最高形式不是给你答案，而是教你如何提问。",
    author: "无名氏",
    category: QUOTE_CATEGORIES.education,
    tags: ["questioning", "thinking", "inquiry"],
    source: "教育格言"
  },
  {
    id: "017",
    text: "学习是为了开茅塞，除鄙见，得新知，增学问，养性灵。",
    author: "林语堂",
    category: QUOTE_CATEGORIES.learning,
    tags: ["enlightenment", "knowledge", "wisdom"],
    source: "中国现代教育思想"
  },
  {
    id: "018",
    text: "要散布阳光到别人心里，先得自己心里有阳光。",
    author: "罗曼·罗兰",
    category: QUOTE_CATEGORIES.inspiration,
    tags: ["positivity", "influence", "inner light"],
    source: "人生哲学"
  },
  {
    id: "019",
    text: "人性最深层的需求就是渴望别人的欣赏。",
    author: "威廉·杰姆斯",
    category: QUOTE_CATEGORIES.wisdom,
    tags: ["appreciation", "human nature", "psychology"],
    source: "心理学原理"
  },
  {
    id: "020",
    text: "捧着一颗心来，不带半根草去。",
    author: "陶行知",
    category: QUOTE_CATEGORIES.education,
    tags: ["dedication", "selflessness", "teaching"],
    source: "中国教育思想"
  },
  {
    id: "021",
    text: "教育是一个逐步发现自己无知的过程。",
    author: "杜兰特",
    category: QUOTE_CATEGORIES.wisdom,
    tags: ["humility", "discovery", "learning"],
    source: "哲学思考"
  },
  {
    id: "022",
    text: "教育是一棵树摇动另一棵树，一朵云推动另一朵云，一个灵魂唤醒另一个灵魂。",
    author: "卡尔·雅斯贝尔斯",
    category: QUOTE_CATEGORIES.education,
    tags: ["influence", "soul", "awakening"],
    source: "存在主义教育哲学"
  }
];

// 导出数据
if (typeof module !== 'undefined' && module.exports) {
  // Node.js 环境
  module.exports = {
    QUOTE_CATEGORIES,
    educationQuotes
  };
} else {
  // 浏览器环境
  window.QuotesData = {
    QUOTE_CATEGORIES,
    educationQuotes
  };
}