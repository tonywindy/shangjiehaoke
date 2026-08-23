import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NAV_LINKS, PAGE_TITLES } from '../constants';
import { withBasePath } from '../utils/basePath.js';
import './Navbar.css';

/**
 * 导航栏组件
 * @param {Object} props - 组件属性
 * @param {'home' | 'works' | 'quotes'} props.currentPage - 当前页面标识符
 * @returns {JSX.Element}
 */
const Navbar = ({ currentPage = 'home' }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const navbarRef = useRef(null);
  const menuId = useId();
  const feedbackId = useId();

  useEffect(() => {
    const closeOverlays = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && navbarRef.current?.contains(event.target)) return;

      setIsMenuOpen(false);
      setIsFeedbackOpen(false);
    };

    document.addEventListener('keydown', closeOverlays);
    document.addEventListener('pointerdown', closeOverlays);

    return () => {
      document.removeEventListener('keydown', closeOverlays);
      document.removeEventListener('pointerdown', closeOverlays);
    };
  }, []);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsFeedbackOpen(false);
  };

  return (
    <nav ref={navbarRef} className="navbar" aria-label="主导航">
      <div className="nav-container">
        <div className="nav-brand">
          <Link 
            to="/" 
            className="brand-text"
            aria-label="返回首页"
          >
            {PAGE_TITLES.HOME}
          </Link>
        </div>

        <button
          type="button"
          className={`nav-toggle ${isMenuOpen ? 'is-open' : ''}`}
          aria-label={isMenuOpen ? '关闭主导航' : '打开主导航'}
          aria-controls={menuId}
          aria-expanded={isMenuOpen}
          onClick={() => {
            setIsMenuOpen((open) => !open);
            setIsFeedbackOpen(false);
          }}
        >
          <span className="nav-toggle-line" aria-hidden="true" />
          <span className="nav-toggle-line" aria-hidden="true" />
          <span className="nav-toggle-line" aria-hidden="true" />
        </button>

        <div id={menuId} className={`nav-menu ${isMenuOpen ? 'is-open' : ''}`}>
          {NAV_LINKS.map((link) => (
            link.path.endsWith('.html') ? (
              <a
                key={link.key}
                href={withBasePath(link.path)}
                className={`nav-link ${currentPage === link.key ? 'active' : ''}`}
                aria-current={currentPage === link.key ? 'page' : undefined}
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.key}
                to={link.path}
                className={`nav-link ${currentPage === link.key ? 'active' : ''}`}
                aria-current={currentPage === link.key ? 'page' : undefined}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            )
          ))}

          <div className="feedback-container">
            <button
              type="button"
              className="nav-link feedback-trigger"
              aria-label="打开意见反馈二维码"
              aria-controls={feedbackId}
              aria-expanded={isFeedbackOpen}
              onClick={() => setIsFeedbackOpen((open) => !open)}
            >
              意见之箱
            </button>
            <div
              id={feedbackId}
              className={`qr-popup ${isFeedbackOpen ? 'is-open' : ''}`}
              role="region"
              aria-label="公众号二维码"
            >
              <img
                src={withBasePath('/images/erweima.png')}
                alt="公众号二维码"
                className="qr-code"
                loading="lazy"
              />
              <p className="qr-text">
                扫码分享您的想法<br />让我们一起成长
              </p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default React.memo(Navbar);
