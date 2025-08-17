import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const handleVideoLoad = () => {
    setVideoLoaded(true)
    console.log('视频加载成功')
  }

  const handleVideoError = (e) => {
    setVideoError(true)
    console.error('视频加载失败:', e)
  }

  return (
    <>
      <div className="app">
        {/* 视频背景 */}
        <div className="video-background">
          {!videoLoaded && !videoError && (
            <div className="video-loading">
              <div className="loading-spinner"></div>
              <p>视频加载中...</p>
            </div>
          )}
          
          {videoError && (
            <div className="video-fallback">
              <div className="fallback-bg"></div>
            </div>
          )}
          
          <video 
            autoPlay 
            muted 
            loop 
            playsInline
            className="background-video"
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            style={{ opacity: videoLoaded ? 1 : 0 }}
          >
            {/* 你可以替换这个视频源为你自己的视频文件 */}
            <source src="/your-video.mp4" type="video/mp4" />
            {/* 如果浏览器不支持视频，显示备用内容 */}
            Your browser does not support the video tag.
          </video>
          
          {/* 视频遮罩层 */}
          <div className="video-overlay"></div>
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
              src="/logo1.png" 
              alt="上节好课 Logo" 
              className="logo-image"
            />
          </div>
          
          {/* 可选的装饰元素 */}
          <div className="logo-decoration">
            <div className="decoration-line"></div>
            <div className="decoration-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="decoration-line"></div>
          </div>
        </div>

        {/* 导航栏 */}
        <nav className="navbar">
          <div className="nav-container">
            <div className="nav-brand">
              <span className="brand-text">上节好课</span>
            </div>
            <div className="nav-menu">
              <a href="/" className="nav-link">初见之页</a>
              <a href="./works.html" className="nav-link">些许尝试</a>
              <a href="./contact.html" className="nav-link">一点想法</a>
            </div>
          </div>
        </nav>

        {/* 底部信息 */}
        <div className="bottom-info">
          <div className="scroll-indicator">
            <span>向下滚动探索更多</span>
            <div className="scroll-arrow">↓</div>
          </div>
        </div>
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


      </div>
    </>
  )
}

export default App
