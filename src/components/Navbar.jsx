import React from 'react';
import { Link } from 'react-router-dom';
import { NAV_LINKS, PAGE_TITLES } from '../constants';
import './Navbar.css';

/**
 * 导航栏组件
 * @param {Object} props - 组件属性
 * @param {'home' | 'works' | 'quotes'} props.currentPage - 当前页面标识符
 * @returns {JSX.Element}
 */
const Navbar = ({ currentPage = 'home' }) => {
  return (
    <nav className="navbar" role="navigation" aria-label="主导航">
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
        
        <div className="nav-menu" role="menubar">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              to={link.path}
              className={`nav-link ${currentPage === link.key ? 'active' : ''}`}
              role="menuitem"
              aria-current={currentPage === link.key ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
          
          <div className="feedback-container">
            <span 
              className="nav-link" 
              role="button"
              tabIndex={0}
              aria-label="意见反馈"
              style={{cursor: 'pointer'}}
            >
              意见之箱
            </span>
            <div className="qr-popup" role="dialog" aria-label="公众号二维码">
              <img 
                src="/erweima.png" 
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
