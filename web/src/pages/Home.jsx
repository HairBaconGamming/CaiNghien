import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  DownloadIcon,
  GithubIcon,
  CheckCircleIcon,
  LockIcon,
  CalendarClockIcon,
  KeyboardIcon,
  SkullIcon,
  MusicIcon,
  CopyIcon,
  CheckIcon,
  SparklesIcon,
  TerminalIcon
} from '../components/Icons.jsx';

const DEFAULT_LATEST = {
  version: "v1.2.0",
  versionRaw: "1.2.0",
  publishedAt: "18/09/2026",
  installerUrl: "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.2.0/cainghien_tauri_1.2.0_x64-setup.exe",
  localInstallerUrl: "/downloads/1.2.0/CaiNghien_Tauri_Setup.exe",
  msiInstallerUrl: "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.1.0/cainghien_tauri_1.1.0_x64_en-US.msi",
  sha256Checksum: "481c8bb0700499c520b32f41f4be6b46d45c570dccb6db9242a66fc65a791b05",
  sizeFormatted: "6.1 MB",
  notes: [
    "Ra mắt tính năng Tự động cập nhật (Auto Updater).",
    "Sửa lỗi gõ tiếng Việt (VNI/Telex) khi gõ phím.",
    "Thêm nút tùy chỉnh số phút tập trung.",
    "Thay đổi Logo ứng dụng phong cách vũ trụ.",
    "Vá lỗi kẹt tiến trình khi gỡ cài đặt (Uninstall)."
  ]
};

export default function Home() {
  const [copiedSha, setCopiedSha] = useState(false);
  const copyTimeoutRef = useRef(null);
  const [releaseInfo, setReleaseInfo] = useState(DEFAULT_LATEST);

  useEffect(() => {
    fetch('/data/releases.json')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        const rel = data.releases?.find(r => r.is_latest) || data.releases?.find(r => r.version === data.latest?.version) || data.releases?.[0] || data.latest;
        if (!rel) return;

        const verStr = rel.version
          ? (rel.version.startsWith('v') ? rel.version : `v${rel.version}`)
          : DEFAULT_LATEST.version;
        const pubDateStr = rel.published_at
          ? rel.published_at.split('T')[0].split('-').reverse().join('/')
          : DEFAULT_LATEST.publishedAt;
        const fileObj = rel.files?.installer;
        const msiObj = rel.files?.msi;

        setReleaseInfo({
          version: verStr,
          versionRaw: rel.version || DEFAULT_LATEST.versionRaw,
          publishedAt: pubDateStr,
          installerUrl: fileObj?.url || DEFAULT_LATEST.installerUrl,
          localInstallerUrl: fileObj?.direct_url || `/downloads/${rel.version}/CaiNghien_Tauri_Setup.exe`,
          msiInstallerUrl: msiObj?.url || DEFAULT_LATEST.msiInstallerUrl,
          msiAvailable: !!msiObj,
          sha256Checksum: fileObj?.sha256 || DEFAULT_LATEST.sha256Checksum,
          sizeFormatted:
            fileObj?.size_formatted ||
            (fileObj?.size_bytes
              ? `${(fileObj.size_bytes / 1024 / 1024).toFixed(1)} MB`
              : DEFAULT_LATEST.sizeFormatted),
          notes: rel.notes || DEFAULT_LATEST.notes
        });
      })
      .catch(err => {
        console.warn('Failed to fetch releases.json in Home.jsx, using defaults', err);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyChecksum = async () => {
    const checksum = releaseInfo.sha256Checksum;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(checksum);
        success = true;
      }
    } catch (e) {
      // Fallback below
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = checksum;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.warn('Fallback copy command failed:', e);
      }
    }

    if (success) {
      setCopiedSha(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  return (
    <main className="page-layout-shell">
        
        {/* Hero Section */}
        <section className="hero-section-container">
          <div className="hero-badge-pill">
            <span className="status-indicator-dot">
              <span className="status-indicator-pulse" />
            </span>
            <span>Phiên bản {releaseInfo.version} Chính Thức Phát Hành</span>
          </div>

          <h1 className="hero-main-heading">
            Pháo đài <span className="gradient-heading-highlight">Kỷ Luật Thép</span>
            <br className="hero-heading-break" />
            {" "}Cho Sự Tập Trung Tuyệt Đối
          </h1>

          <p className="hero-description-paragraph">
            Ngăn chặn hoàn toàn sự cám dỗ số. CaiNghiện can thiệp sâu vào hệ thống Windows 
            để khóa chặt các trang web xao nhãng, ép bạn phải giữ kỷ luật và bảo vệ thời gian quý báu.
          </p>

          <div className="hero-action-buttons-group">
            <a href={releaseInfo.installerUrl} download className="button-primary-download">
              <DownloadIcon className="svg-icon-standard" />
              <span>Tải Miễn Phí (Windows x64)</span>
            </a>
            <a 
              href="https://github.com/HairBaconGamming/CaiNghien" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="button-secondary-outline"
            >
              <GithubIcon className="svg-icon-standard" />
              <span>Mã Nguồn Mở</span>
            </a>
          </div>

          <div className="trust-badges-bar">
            <div className="trust-badge-item">
              <CheckCircleIcon className="svg-icon-standard" />
              <span>Can thiệp tầng hệ thống (Hosts & Service)</span>
            </div>
            <div className="trust-badge-item">
              <CheckCircleIcon className="svg-icon-standard" />
              <span>Không thể ép tắt bằng Task Manager</span>
            </div>
            <div className="trust-badge-item">
              <CheckCircleIcon className="svg-icon-standard" />
              <span>Mã khôi phục an toàn 7 ngày</span>
            </div>
          </div>
        </section>

        {/* Dashboard Screenshot Showcase */}
        <section className="dashboard-showcase-section">
          <div className="dashboard-glass-frame">
            <div className="dashboard-glass-overlay-badge">
              <SparklesIcon className="svg-icon-standard" />
              <span>Bảo Vệ Thời Gian Thực • Streak Kỷ Luật</span>
            </div>
            <img 
              src="/assets/cain_dashboard.jpg" 
              alt="Bảng điều khiển CaiNghiện Focus Guard" 
              className="dashboard-screenshot-image"
            />
          </div>
        </section>

        {/* Core Features Grid Section */}
        <section id="features" className="features-section-container">
          <div className="section-header-block">
            <span className="section-kicker-label">Bảo Vệ Đa Tầng</span>
            <h2 className="section-title-heading">5 Lớp Khiên Chống Bốc Đồng</h2>
            <p className="section-subtitle-description">
              Kiến trúc đa tầng giúp triệt tiêu hoàn toàn thói quen xấu, tái thiết lập khả năng tập trung sâu qua từng ngày.
            </p>
          </div>

          <div className="features-cards-grid">
            <div className="feature-glass-card">
              <div className="feature-card-icon-box">
                <CalendarClockIcon className="svg-icon-standard" />
              </div>
              <h3 className="feature-card-heading">Lịch Trình Tự Động</h3>
              <p className="feature-card-text">
                Thiết lập khung giờ làm việc cố định. Hệ thống tự động đổi DNS và ghi đè file Hosts 
                để cắt đứt mạng xã hội mà không cần bạn phải thao tác thủ công.
              </p>
            </div>

            <div className="feature-glass-card">
              <div className="feature-card-icon-box">
                <KeyboardIcon className="svg-icon-standard" />
              </div>
              <h3 className="feature-card-heading">Rào Cản Chánh Niệm</h3>
              <p className="feature-card-text">
                Muốn tắt ứng dụng? Bạn bắt buộc phải gõ chính xác 100% một đoạn văn cam kết 
                để cơn bốc đồng tiết Dopamine kịp thời hạ nhiệt.
              </p>
            </div>

            <div className="feature-glass-card">
              <div className="feature-card-icon-box accent-rose">
                <SkullIcon className="svg-icon-standard" />
              </div>
              <h3 className="feature-card-heading">Trảm Dữ Liệu (Hình Phạt)</h3>
              <p className="feature-card-text">
                Nếu cố tình dùng Task Manager để cưỡng chế tắt app, toàn bộ Cấp độ (Level) 
                và Chuỗi ngày (Streak) sẽ lập tức bị xóa sạch về con số 0.
              </p>
            </div>

            <div className="feature-glass-card">
              <div className="feature-card-icon-box accent-blue">
                <LockIcon className="svg-icon-standard" />
              </div>
              <h3 className="feature-card-heading">Kiosk Mode Khóa Cứng</h3>
              <p className="feature-card-text">
                Đẩy giới hạn kỷ luật lên mức cao nhất. Chiếm toàn quyền màn hình, khóa phím Alt+Tab, 
                Windows Key, tích hợp đồng hồ Pomodoro và âm thanh tập trung.
              </p>
            </div>

            <div className="feature-glass-card">
              <div className="feature-card-icon-box">
                <ShieldCheckIcon className="svg-icon-standard" />
              </div>
              <h3 className="feature-card-heading">An Toàn Cốt Lõi</h3>
              <p className="feature-card-text">
                Mã khôi phục dùng 1 lần kết hợp cơ chế Emergency Recovery đợi 7 ngày. 
                Bạn sẽ không bao giờ bị khóa vĩnh viễn ngoài ý muốn.
              </p>
            </div>

            <div className="feature-glass-card">
              <div className="feature-card-icon-box">
                <TerminalIcon className="svg-icon-standard" />
              </div>
              <h3 className="feature-card-heading">Cập Nhật Minh Bạch</h3>
              <p className="feature-card-text">
                Mỗi bản vá được công bố minh bạch kèm mã băm SHA-256. 
                Bạn nắm quyền kiểm soát hoàn toàn thời điểm áp dụng bản nâng cấp.
              </p>
            </div>
          </div>
        </section>

        {/* Showcase Section: Mindfulness Challenge */}
        <section id="mindfulness" className="showcase-section-container">
          <div className="showcase-two-column-layout">
            <div className="showcase-column-content">
              <span className="showcase-badge-pill">Thử Thách Gõ Phím</span>
              <h2 className="showcase-heading">Chặn Đứng Cơn Nghiện Tức Thời</h2>
              <p className="showcase-body-text">
                Quy trình hủy bỏ kỷ luật không còn dễ dàng bằng một cú nhấp chuột. 
                Giao diện Mindfulness yêu cầu sự tập trung tuyệt đối để nhập chính xác đoạn văn bản cam kết, 
                buộc não bộ phải suy nghĩ lại quyết định bộc phát.
              </p>
              <ul className="showcase-points-list">
                <li className="showcase-point-item">
                  <CheckCircleIcon className="showcase-point-icon" />
                  <span className="showcase-point-label">Yêu cầu độ chính xác 100% từng ký tự khi gõ phím.</span>
                </li>
                <li className="showcase-point-item">
                  <CheckCircleIcon className="showcase-point-icon" />
                  <span className="showcase-point-label">Đồng hồ đếm ngược thông minh ẩn giấu nút Tắt bảo vệ.</span>
                </li>
                <li className="showcase-point-item">
                  <CheckCircleIcon className="showcase-point-icon" />
                  <span className="showcase-point-label">Cơ chế tâm lý học hành vi: làm nguội cơn khát Dopamine tức thời.</span>
                </li>
              </ul>
            </div>

            <div className="showcase-column-visual">
              <div className="showcase-image-card-wrapper">
                <img 
                  src="/assets/cain_typing_challenge.jpg" 
                  alt="Giao diện thử thách gõ phím chánh niệm" 
                  className="showcase-screenshot-image"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Showcase Section: Focus Room Kiosk */}
        <section id="kiosk" className="showcase-section-container">
          <div className="showcase-two-column-layout">
            <div className="showcase-column-visual">
              <div className="showcase-image-card-wrapper">
                <img 
                  src="/assets/cain_focus_room.jpg" 
                  alt="Không gian tĩnh tâm Focus Room" 
                  className="showcase-screenshot-image"
                />
              </div>
            </div>

            <div className="showcase-column-content">
              <span className="showcase-badge-pill blue-theme">Kiosk Mode Khóa Cứng</span>
              <h2 className="showcase-heading">Không Gian Tĩnh Tâm Sâu</h2>
              <p className="showcase-body-text">
                Triệt tiêu mọi phân tâm để đưa bạn vào trạng thái Deep Work hoàn hảo. 
                Chế độ Focus Room chiếm toàn quyền màn hình, ẩn thanh Taskbar và áp dụng khóa 
                ở tầng thấp hệ điều hành Windows.
              </p>
              <ul className="showcase-points-list">
                <li className="showcase-point-item">
                  <LockIcon className="showcase-point-icon blue-theme" />
                  <span className="showcase-point-label">Vô hiệu hóa tổ hợp phím Alt+Tab, Windows Key, Ctrl+Esc.</span>
                </li>
                <li className="showcase-point-item">
                  <MusicIcon className="showcase-point-icon blue-theme" />
                  <span className="showcase-point-label">Tích hợp đồng hồ Pomodoro toàn màn hình, âm thanh tiếng Mưa và nhạc Lofi.</span>
                </li>
                <li className="showcase-point-item">
                  <CheckCircleIcon className="showcase-point-icon blue-theme" />
                  <span className="showcase-point-label">Tự động chặn mọi thông báo popup gây đứt gãy dòng suy nghĩ.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Downloads & Releases Section */}
        <section id="downloads" className="downloads-section-container">
          <div className="section-header-block">
            <span className="section-kicker-label">Bản Phát Hành Ổn Định</span>
            <h2 className="section-title-heading">Sẵn Sàng Để Tập Trung?</h2>
            <p className="section-subtitle-description">
              Tải về bản dựng mới nhất cho Windows 10 & 11 (64-bit). Khởi động ngay hành trình kỷ luật thép.
            </p>
          </div>

          <div className="release-main-glass-panel">
            <div className="release-header-row">
              <div className="release-title-block">
                <span className="release-version-pill">{releaseInfo.version}</span>
                <span className="release-timestamp-text">Phát hành ngày {releaseInfo.publishedAt}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className="trust-badge-item">Kiến trúc x64</span>
                <Link to="/releases" className="download-secondary-button" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                  <span>Xem tất cả bản phát hành →</span>
                </Link>
              </div>
            </div>

            <div className="release-glance-metrics-row">
              <div className="glance-metric-card">
                <span className="glance-metric-title">Kích thước file</span>
                <div className="glance-metric-value">{releaseInfo.sizeFormatted}</div>
              </div>
              <div className="glance-metric-card">
                <span className="glance-metric-title">Nền tảng</span>
                <div className="glance-metric-value">Windows 10 / 11</div>
              </div>
              <div className="glance-metric-card">
                <span className="glance-metric-title">Công nghệ</span>
                <div className="glance-metric-value">Rust & Tauri v2</div>
              </div>
            </div>

            <div className="release-actions-row">
              <div className="download-action-card">
                <div>
                  <div className="file-info-primary">CaiNghien Setup Installer ({releaseInfo.version} .exe)</div>
                  <div className="file-info-description">Khuyến dùng: Bản cài đặt tiêu chuẩn tự động cấu hình service nền và Auto Updater.</div>
                </div>
                <div className="download-buttons-cluster">
                  <a href={releaseInfo.installerUrl} download className="download-primary-button">
                    <DownloadIcon className="svg-icon-standard" />
                    <span>Tải từ GitHub</span>
                  </a>
                  <a href={releaseInfo.localInstallerUrl} download className="download-secondary-button" title="Tải trực tiếp từ máy chủ web nếu mạng chặn GitHub">
                    <DownloadIcon className="svg-icon-standard" />
                    <span>Tải trực tiếp (.exe)</span>
                  </a>
                </div>
              </div>

              <div className="download-action-card">
                <div>
                  <div className="file-info-primary">CaiNghien MSI Package ({releaseInfo.msiAvailable ? releaseInfo.version : 'v1.1.0 LTS'} .msi)</div>
                  <div className="file-info-description">
                    {releaseInfo.msiAvailable
                      ? "Gói cài đặt Windows Installer dành cho quản trị viên hệ thống."
                      : "Gói cài đặt Windows Installer dành cho quản trị viên hệ thống (Bản ổn định v1.1.0)."}
                  </div>
                </div>
                <a href={releaseInfo.msiInstallerUrl} download className="button-secondary-outline">
                  <DownloadIcon className="svg-icon-standard" />
                  <span>Tải MSI {releaseInfo.msiAvailable ? `(${releaseInfo.version})` : '(v1.1.0)'}</span>
                </a>
              </div>
            </div>

            <div className="checksum-copy-box" aria-live="polite">
              <span className="checksum-hash-code" title={releaseInfo.sha256Checksum}>
                SHA-256: {releaseInfo.sha256Checksum}
              </span>
              <button 
                type="button" 
                onClick={handleCopyChecksum} 
                className="copy-hash-button"
                aria-label={copiedSha ? "Đã sao chép mã SHA-256 vào bộ nhớ tạm" : "Sao chép mã băm SHA-256"}
              >
                {copiedSha ? (
                  <>
                    <CheckIcon className="svg-icon-standard" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="svg-icon-standard" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <div className="release-notes-container">
              <h4 className="release-notes-title">Điểm nổi bật trong bản phát hành {releaseInfo.version}:</h4>
              <ul className="release-notes-list">
                {(Array.isArray(releaseInfo.notes) ? releaseInfo.notes : []).map((note, index) => (
                  <li key={index} className="release-note-item">{note}</li>
                ))}
              </ul>
              <div style={{ marginTop: '16px' }}>
                <Link to="/releases" className="manifest-link-pill" style={{ display: 'inline-flex' }}>
                  <span>Xem toàn bộ lịch sử phát hành &amp; kiểm tra mã băm SHA-256 →</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section className="cta-banner-section">
          <div className="cta-glass-card-container">
            <h2 className="cta-main-heading">Đã Sẵn Sàng Giành Lại Quyền Kiểm Soát?</h2>
            <p className="cta-subtitle-text">
              Cài đặt CaiNghiện ngay hôm nay để bảo vệ sự tập trung của bạn khỏi thế giới đầy xao nhãng.
            </p>
            <div className="cta-button-wrapper">
              <a href={releaseInfo.installerUrl} download className="button-primary-download">
                <DownloadIcon className="svg-icon-standard" />
                <span>Tải Miễn Phí (Windows x64)</span>
              </a>
            </div>
          </div>
        </section>

      </main>
  );
}
