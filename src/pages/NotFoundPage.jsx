import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './NotFoundPage.css';

const NotFoundPage = () => (
  <div className="not-found-page">
    <Navbar />
    <main className="not-found-content">
      <span className="not-found-code" aria-hidden="true">404</span>
      <p className="not-found-kicker">这节课走错教室了</p>
      <h1>没有找到这个页面</h1>
      <p>地址可能已经调整，也可能只是少写了一个字符。</p>
      <div className="not-found-actions">
        <Link className="not-found-primary" to="/">返回首页</Link>
        <Link className="not-found-secondary" to="/works">查看教学工具</Link>
      </div>
    </main>
  </div>
);

export default NotFoundPage;
