import React from 'react';
import Navbar from '../components/Navbar';
import { TEACHING_TOOL_PAGES } from '../data/works-data';
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
            <h1 className="hero-title">灵感积木</h1>
            <p className="hero-subtitle">在互动中看见思考生长的样子</p>
          </div>

          <div className="works-grid">
            {TEACHING_TOOL_PAGES.map((work) => (
              <a href={work.path} className="work-item" key={work.id}>
                <div className="work-image-container">
                  <img src={work.cover} alt={work.title} loading="lazy" />
                </div>
                <div className="work-info">
                  <div className="work-copy">
                    <h3>{work.title}</h3>
                    <div className="work-tags" aria-label={`${work.title}标签`}>
                      {work.tags.map((tag) => (
                        <span className="work-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorksPage;
