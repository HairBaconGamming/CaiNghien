import React, { useState, useEffect } from 'react';
import { DownloadIcon, CheckCircleIcon } from '../components/Icons.jsx';

export default function Releases() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/releases.json')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="releases-page-container" style={{ padding: '4rem 2rem', color: '#fff', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="hero-main-heading" style={{ marginBottom: '2rem' }}>
        Lịch sử <span className="gradient-heading-highlight">Cập Nhật</span>
      </h1>
      
      {loading && <p>Đang tải dữ liệu...</p>}
      {error && <p>Lỗi khi tải dữ liệu: {error}</p>}
      
      {data && data.releases && (
        <div className="releases-list" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {data.releases.map((release, idx) => (
            <div key={idx} className="release-main-glass-panel" style={{ padding: '2rem' }}>
              <div className="release-header-row" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                <div className="release-title-block">
                  <span className="release-version-pill">v{release.version}</span>
                  <span className="release-timestamp-text">Phát hành ngày {release.published_at}</span>
                </div>
              </div>
              
              <div className="release-notes-container">
                <h4 className="release-notes-title">Điểm nổi bật:</h4>
                <ul className="release-notes-list">
                  {release.notes.map((note, i) => (
                    <li key={i} className="release-note-item" style={{ marginBottom: '0.5rem' }}>{note}</li>
                  ))}
                </ul>
              </div>

              {release.files && release.files.installer && (
                <div style={{ marginTop: '2rem' }}>
                  <a href={release.files.installer.url} download className="button-primary-download" style={{ display: 'inline-flex' }}>
                    <DownloadIcon className="svg-icon-standard" />
                    <span>Tải v{release.version} ({Math.round(release.files.installer.size_bytes / 1024 / 1024 * 10) / 10} MB)</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
