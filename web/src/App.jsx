import { Routes, Route, Link, NavLink } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Releases from './pages/Releases.jsx';
import React from 'react';
import { DownloadIcon } from './components/Icons.jsx';

export default function App() {
  const defaultInstallerUrl = "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.2.0/cainghien_tauri_1.2.0_x64-setup.exe";
  const [installerUrl, setInstallerUrl] = React.useState(defaultInstallerUrl);

  React.useEffect(() => {
    fetch('/data/releases.json')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const latestRel = data?.releases?.find(r => r.is_latest) || data?.releases?.find(r => r.version === data?.latest?.version) || data?.releases?.[0];
        const latestUrl = latestRel?.files?.installer?.url || data?.latest?.installer || data?.latest?.url;
        if (latestUrl) {
          setInstallerUrl(latestUrl);
        }
      })
      .catch(() => {});
  }, []);

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
          <Link to="/" className="brand-container">
            <div className="brand-icon-wrapper">
              <img src="/logo.png" alt="Logo" className="svg-icon-standard" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            </div>
            <span className="brand-title-text">
              CaiNghiện <span className="brand-title-highlight">Focus</span>
            </span>
          </Link>

          <nav className="navigation-menu">
            <a href="/#features" className="navigation-link-item">Tính Năng</a>
            <a href="/#mindfulness" className="navigation-link-item">Chánh Niệm</a>
            <a href="/#kiosk" className="navigation-link-item">Tĩnh Tâm</a>
            <a href="/#downloads" className="navigation-link-item">Tải Xuống</a>
            <NavLink 
              to="/releases" 
              className={({ isActive }) => `navigation-link-item ${isActive ? 'active' : ''}`}
            >
              Lịch sử cập nhật
            </NavLink>
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
