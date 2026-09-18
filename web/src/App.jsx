import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Releases from './pages/Releases.jsx';
import React from 'react';
import { DownloadIcon } from './components/Icons.jsx';

export default function App() {
  const installerUrl = "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.0.0/cainghien_tauri_0.1.0_x64-setup.exe";

  return (
    <div className="landing-root-container">
      {/* Ambient Background Canvas */}
      <div className="ambient-background-canvas" aria-hidden="true">
        <div className="ambient-grid-overlay" />
        <div className="ambient-radial-glow-primary" />
        <div className="ambient-radial-glow-secondary" />
        <div className="ambient-radial-glow-tertiary" />
      </div>

      {/* Top Glassmorphic Navigation */}
      <header className="glass-nav-header">
        <div className="glass-nav-inner">
          <a href="#" className="brand-container">
            <div className="brand-icon-wrapper">
              <img src="/logo.png" alt="Logo" className="svg-icon-standard" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            </div>
            <span className="brand-title-text">
              CaiNghiện <span className="brand-title-highlight">Focus</span>
            </span>
          </a>

          <nav className="navigation-menu">
            <a href="/#features" className="navigation-link-item">Tính Năng</a>
            <a href="/#mindfulness" className="navigation-link-item">Chánh Niệm</a>
            <a href="/#kiosk" className="navigation-link-item">Tĩnh Tâm</a>
            <a href="/#downloads" className="navigation-link-item">Tải Xuống</a>
            <Link to="/releases" className="navigation-link-item">Lịch sử cập nhật</Link>
          </nav>

          <div className="nav-actions-wrapper">
            <a href={installerUrl} download className="nav-download-button">
              <DownloadIcon className="svg-icon-standard" />
              <span className="nav-btn-text-full">Tải cho Windows</span>
              <span className="nav-btn-text-short">Tải về</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Page Layout Container */}
      <main className="page-layout-shell-router" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/releases" element={<Releases />} />
        </Routes>
      </main>

      {/* Glassmorphic Footer */}
      <footer className="site-glass-footer">
        <div className="footer-inner-content">
          <div className="footer-brand-info">
            <div className="brand-icon-wrapper">
              <img src="/logo.png" alt="Logo" className="svg-icon-standard" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            </div>
            <div>
              <span className="footer-brand-title">CaiNghiện Focus Guard</span>
              <p className="footer-copyright-text">
                © 2026 CaiNghiện Team. Xây dựng bằng Rust & Tauri.
              </p>
            </div>
          </div>

          <div className="footer-links-group">
            <a href="/data/update-manifest.json" target="_blank" rel="noopener noreferrer" className="footer-link-item">
              update-manifest.json
            </a>
            <a href="/data/releases.json" target="_blank" rel="noopener noreferrer" className="footer-link-item">
              releases.json
            </a>
            <a 
              href="https://github.com/HairBaconGamming/CaiNghien" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="footer-link-item"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
