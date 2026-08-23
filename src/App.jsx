import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import { FEATURED_WORKS } from './data/works-data'
import { withBasePath } from './utils/basePath.js'
import './App.css'

const heroVideoWebm = withBasePath('/videos/hero-background-v2.webm')
const heroVideoMp4 = withBasePath('/videos/hero-background-v2.mp4')

function App() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const handleVideoLoad = () => {
    setVideoLoaded(true)
  }

  const handleVideoError = () => {
    setVideoError(true)
  }

  return (
    <main id="main-content">
        <div className="app">
        {/* 视频背景 */}
        <div className="video-background">
          <div className="video-fallback" aria-hidden="true">
            <div className="fallback-bg"></div>
          </div>

          {!videoLoaded && !videoError && (
            <div className="video-loading">
              <div className="loading-spinner"></div>
              <p>视频加载中...</p>
            </div>
          )}

          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="background-video"
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            style={{ opacity: videoLoaded ? 1 : 0 }}
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src={heroVideoWebm} type="video/webm" />
            <source src={heroVideoMp4} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

        </div>

        {/* 中央Logo区域 */}
        <div className="logo-container">
          <div className={`logo-wrapper ${isLoaded ? 'loaded' : ''}`}>
            {/* 你可以替换这里的内容为你自己的logo */}
            {/* 文字Logo已注释 */}
            {/* 
            <div className="logo">
              <h1 className="logo-text">上节好课</h1>
              <div className="logo-subtitle">优质教育 · 成就未来</div>
            </div>
            */}
            
            {/* 使用图片logo */}
            <img 
              src={withBasePath('/images/logo1.png')}
              alt="上节好课"
              className="logo-image"
            />
          </div>
        </div>

        {/* 导航栏 */}
        <Navbar currentPage="home" />

        </div>

      {/* 滚动内容区域 */}
      <div className="scroll-content">
        {/* 关于我们板块 */}
        <section className="section about-section">
          <div className="section-container">
            <div className="section-content">
              <h2 className="section-title">关于上节好课</h2>
              <p className="section-subtitle">技术是路径，好课是目的地。</p>
              <div className="about-grid">
                <div className="about-item">
                  <div className="about-icon">🤖</div>
                  <h3>AI+教育</h3>
                  <p>当AI，敲开教室的门。</p>
                </div>
                <div className="about-item">
                  <div className="about-icon">🔍</div>
                  <h3>我的探索</h3>
                  <p>不保证成功、不追求完美、过程比结果更重要</p>
                </div>
                <div className="about-item">
                  <div className="about-icon">💭</div>
                  <h3>一点思考</h3>
                  <p>不止于代码，也关于教育本身的感悟与洞察。</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section featured-works-section">
          <div className="section-container">
            <div className="section-content">
              <h2 className="section-title">继续探索</h2>
              <p className="section-subtitle">从课堂互动到 AI 辅助分析，选择一个工具开始体验。</p>

              <div className="featured-works-grid">
                {FEATURED_WORKS.map((work) => (
                  <a href={work.path} className="featured-work-card" key={work.id}>
                    <div className="featured-work-image">
                      <img src={work.cover} alt={work.title} loading="lazy" />
                    </div>
                    <div className="featured-work-content">
                      <h3>{work.title}</h3>
                      <div className="featured-work-tags" aria-label={`${work.title}标签`}>
                        {work.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>


      </div>
      </main>
  )
}

export default App
