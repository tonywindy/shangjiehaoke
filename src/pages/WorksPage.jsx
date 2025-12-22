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

          <div className="works-grid">
            {/* 作品 1 */}
            <a href="/shuxueyouxi.html" className="work-item">
              <div className="work-image-container">
                <img src="/shijie.jpeg" alt="一人一世界数学情境答题游戏" />
              </div>
              <div className="work-info">
                <h3>一人一世界数学情境答题游戏</h3>
              </div>
            </a>

            {/* 作品 2 */}
            <a href="/santitg.html" className="work-item" onClick={(e) => { e.preventDefault(); window.location.href = '/santitg.html'; }}>
              <div className="work-image-container">
                <img src="/santtg.png" alt="三题通关精准计算训练营" />
              </div>
              <div className="work-info">
                <h3>三题通关精准计算训练营</h3>
              </div>
            </a>

            {/* 作品 3 */}
            <a href="/climb.html" className="work-item">
              <div className="work-image-container">
                <img src="/dengshan.jpeg" alt="两位数乘法登山挑战游戏" />
              </div>
              <div className="work-info">
                <h3>两位数乘法登山挑战游戏</h3>
              </div>
            </a>

            {/* 作品 4 */}
            <a href="/zhouchang.html" className="work-item">
              <div className="work-image-container">
                <img src="/zhouchang.jpeg" alt="周长的探索之旅" />
              </div>
              <div className="work-info">
                <h3>周长的探索之旅</h3>
              </div>
            </a>

            {/* 作品 5 */}
            <a href="/danweihuansuan.html" className="work-item">
              <div className="work-image-container">
                <img src="/danweihuansuan.png" alt="长度单位换算交互式学习工具" />
              </div>
              <div className="work-info">
                <h3>长度单位换算交互式学习工具</h3>
              </div>
            </a>

            {/* 作品 6 */}
            <a href="/renshixiaoshu.html" className="work-item">
              <div className="work-image-container">
                <img src="/renshixiaoshu.png" alt="认识小数：元角分大探险" />
              </div>
              <div className="work-info">
                <h3>认识小数：元角分大探险</h3>
              </div>
            </a>

            {/* 作品 7 */}
            <a href="/recite/index.html" className="work-item">
              <div className="work-image-container">
                <img src="/beisong-background.jpg" alt="背诵冒险记" />
              </div>
              <div className="work-info">
                <h3>背诵冒险记</h3>
              </div>
            </a>

            {/* 作品 8 */}
            <a href="/shudui.html" className="work-item">
              <div className="work-image-container">
                <img src="/shudui.png" alt="数对四子棋游戏" />
              </div>
              <div className="work-info">
                <h3>数对四子棋游戏</h3>
              </div>
            </a>

            {/* 作品 9 */}
            <a href="/zuoweibiao.html" className="work-item">
              <div className="work-image-container">
                <img src="/zuoweibiao.png" alt="班级座位表管理系统" />
              </div>
              <div className="work-info">
                <h3>班级座位表管理系统</h3>
              </div>
            </a>

            {/* 作品 10 */}
            <a href="/yingbi.html" className="work-item">
              <div className="work-image-container">
                <img src="/yingbifengmian.png" alt="抛硬币频率分析模拟器" />
              </div>
              <div className="work-info">
                <h3>抛硬币频率分析模拟器</h3>
              </div>
            </a>

            {/* 作品 11 */}
            <a href="/shizhen.html" className="work-item">
              <div className="work-image-container">
                <img src="/shizhong1.png" alt="时钟夹角工具" />
              </div>
              <div className="work-info">
                <h3>时钟夹角工具</h3>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorksPage;