import React from 'react';
import Navbar from '../components/Navbar';
import './WorksPage.css';

/**
 * 作品展示页面组件
 * 展示各种教育相关的项目和工具
 */
const WorksPage = () => {
  return (
    <div className="works-page">
      <Navbar currentPage="works" />

      <div className="container">
        <div className="main-content">
          <div className="hero-section">
            <h1 className="hero-title">些许尝试</h1>
            <p className="hero-subtitle">不保证成功，不追求完美</p>
          </div>

          <div className="works-layout">
            <div className="main-works">
              {/* 主要推荐作品 */}
              <article className="featured-work">
                <div className="featured-image">
                  <img
                    src="/shijie.jpeg"
                    alt="一人一世界数学情境答题游戏"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                  />
                </div>
                <div className="featured-content">
                  <h2 className="featured-title">一人一世界数学情境答题游戏</h2>
                  <p className="featured-description">
                    AI数学冒险故事游戏，通过沉浸式的故事情境让学生在冒险中学习数学。支持多个主题和知识点，每个问题都有独特的故事背景，让数学学习变成一场精彩的冒险之旅。
                  </p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">AI教育</span>
                    <span className="tag">情境学习</span>
                    <span className="tag">数学冒险</span>
                  </div>
                  <a href="/shuxueyouxi.html" className="work-link">
                    开始冒险 →
                  </a>
                </div>
              </article>

              {/* 常规作品列表 */}
              <div className="regular-works">
                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/santtg.png"
                      alt="三题通关精准计算训练营"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>三题通关精准计算训练营</h3>
                  <p>通过"小批量、高要求"的训练方式帮助学生克服粗心问题。每次完成3道题可获得积分，累积积分可让小树苗成长。支持简单、困难、大师三种模式，包含三位数加减法和表内乘法四则运算，配有即时反馈和纠错机制。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">数学训练</span>
                    <span className="tag">精准计算</span>
                    <span className="tag">游戏化学习</span>
                  </div>
                  <a href="/santitg.html" className="work-link" onClick={(e) => { e.preventDefault(); window.location.href = '/santitg.html'; }}>开始训练 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/dengshan.jpeg"
                      alt="两位数乘法登山挑战游戏"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>两位数乘法登山挑战游戏</h3>
                  <p>一个有趣的数学学习游戏，通过登山挑战的形式让学生练习两位数乘法运算。支持单人挑战和双人对战模式，配有可爱的动物角色和生动的动画效果，让数学学习变得更加有趣。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">教育游戏</span>
                    <span className="tag">数学学习</span>
                  </div>
                  <a href="/climb.html" className="work-link">开始游戏 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/zhouchang.jpeg"
                      alt="周长的探索之旅"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>周长的探索之旅</h3>
                  <p>一个互动式的数学学习应用，通过三个精心设计的模块帮助学生直观理解周长概念。包含小蚂蚁演示、绳子变魔术和长方形公式推导，让抽象的数学概念变得生动有趣。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">Canvas API</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">数学教育</span>
                    <span className="tag">交互设计</span>
                  </div>
                  <a href="/zhouchang.html" className="work-link">开始探索 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/danweihuansuan.png"
                      alt="长度单位换算交互式学习工具"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>长度单位换算交互式学习工具</h3>
                  <p>通过拖拽直观理解千米、米、分米、厘米和毫米之间的换算关系。采用楼梯式设计和可拖动数值卡片，让学生在互动中掌握单位换算的规律，支持触控设备，界面美观现代。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">拖拽交互</span>
                    <span className="tag">数学教育</span>
                    <span className="tag">单位换算</span>
                  </div>
                  <a href="/danweihuansuan.html" className="work-link">开始学习 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/renshixiaoshu.png"
                      alt="认识小数：元角分大探险"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>认识小数：元角分大探险</h3>
                  <p>通过拖拽硬币学习小数概念的互动教学工具。学生可以拖拽元、角、分硬币到相应区域，直观理解小数的组成和进位关系，支持语音朗读功能，界面友好，适合触控设备。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">拖拽交互</span>
                    <span className="tag">数学教育</span>
                    <span className="tag">小数认知</span>
                    <span className="tag">语音朗读</span>
                  </div>
                  <a href="/renshixiaoshu.html" className="work-link">开始探险 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/shudui.png"
                      alt="数对四子棋游戏"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>数对四子棋游戏</h3>
                  <p>一款结合围棋元素的策略对战游戏。在9×9的棋盘上，两名玩家轮流下棋，目标是率先连成四子。游戏采用围棋风格的黑白棋子设计，支持触控操作，界面简洁优雅，适合培养学生的逻辑思维和策略规划能力。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">策略游戏</span>
                    <span className="tag">逻辑思维</span>
                    <span className="tag">触控支持</span>
                    <span className="tag">双人对战</span>
                  </div>
                  <a href="/shudui.html" className="work-link">开始对战 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/beisong-background.jpg"
                      alt="背诵冒险记游戏"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>背诵冒险记</h3>
                  <p>一款趣味性的背诵任务管理游戏。学生完成背诵后可从"修炼野外"进入"知识宫殿",前5名获金牌、前15名获银牌、前30名获铜牌。支持批量导入学生名单、多任务管理、易容术更换头像、数据导出等功能,让背诵变成冒险闯关。</p>
                  <div className="work-tags">
                    <span className="tag">JavaScript</span>
                    <span className="tag">HTML5</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">拖拽交互</span>
                    <span className="tag">游戏化学习</span>
                    <span className="tag">任务管理</span>
                    <span className="tag">奖牌系统</span>
                  </div>
                  <a href="/recite/index.html" className="work-link">开始冒险 →</a>
                </div>

                <div className="work-card">
                  <div className="work-image">
                    <img
                      src="/shizhong.png"
                      alt="时钟夹角学习工具"
                      style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                    />
                  </div>
                  <h3>时钟夹角学习工具</h3>
                  <p>一个交互式的时钟夹角学习应用。学生可以通过拖动时针和分针或输入具体时间来观察时钟的夹角变化。支持显示/隐藏角度、随机时间生成，帮助学生直观理解时钟角度的计算方法。</p>
                  <div className="work-tags">
                    <span className="tag">React</span>
                    <span className="tag">JavaScript</span>
                    <span className="tag">CSS3</span>
                    <span className="tag">拖拽交互</span>
                    <span className="tag">数学教育</span>
                    <span className="tag">角度计算</span>
                  </div>
                  <a href="/shizhen" className="work-link">开始学习 →</a>
                </div>
              </div>
            </div>

            {/* 侧边栏 */}
            <aside className="sidebar">
              <div className="sidebar-section">
                <h3 className="sidebar-title">精选文章</h3>
                <ul className="featured-list">
                  <li className="featured-item">
                    <a href="/ai-teaching-tools.html" className="featured-link">
                      AI 助教来了：盘点那些能让教师效率倍增的 AI 工具
                    </a>
                  </li>
                  <li className="featured-item">
                    <a href="#" className="featured-link">如何用AI技术改变传统教育</a>
                  </li>
                  <li className="featured-item">
                    <a href="#" className="featured-link">前端开发的最佳实践指南</a>
                  </li>
                  <li className="featured-item">
                    <a href="#" className="featured-link">构建现代化学习平台的思考</a>
                  </li>
                  <li className="featured-item">
                    <a href="#" className="featured-link">用户体验设计在教育产品中的应用</a>
                  </li>
                  <li className="featured-item">
                    <a href="#" className="featured-link">技术驱动的个性化学习</a>
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <h3 className="sidebar-title">项目统计</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-number">8</span>
                    <span className="stat-label">完成项目</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">8</span>
                    <span className="stat-label">技术栈</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">4</span>
                    <span className="stat-label">获奖项目</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">2k+</span>
                    <span className="stat-label">代码提交</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorksPage;