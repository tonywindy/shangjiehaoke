import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import WorksPage from './pages/WorksPage.jsx'
import QuotesPage from './pages/QuotesPage.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/quotes" element={<QuotesPage />} />
        {/* 兼容原有的HTML路径 */}
        <Route path="/works.html" element={<WorksPage />} />
        <Route path="/contact.html" element={<QuotesPage />} />
        <Route path="/index.html" element={<App />} />
      </Routes>
    </Router>
  </React.StrictMode>,
)
