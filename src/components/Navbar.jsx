import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ currentPage }) => {
  const [isQRVisible, setIsQRVisible] = useState(false);

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="brand-text">上节好课</Link>
        </div>
        <div className="nav-menu">
          <Link to="/" className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}>初见之页</Link>
          <Link to="/works" className={`nav-link ${currentPage === 'works' ? 'active' : ''}`}>些许尝试</Link>
          <Link to="/quotes" className={`nav-link ${currentPage === 'quotes' ? 'active' : ''}`}>一点想法</Link>
          <div className="feedback-container">
            <a href="#" className="nav-link">意见之箱</a>
            <div className="qr-popup">
              <img src="/erweima.png" alt="公众号二维码" className="qr-code" />
              <p className="qr-text">扫码分享您的想法<br />让我们一起成长</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;