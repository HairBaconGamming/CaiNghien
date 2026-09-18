import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  DownloadIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  TagIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  CpuIcon,
  InfoIcon,
  RocketIcon,
  BugIcon,
  WrenchIcon,
  SearchIcon,
  RefreshCwIcon,
  FileCodeIcon,
  CalendarClockIcon,
  TerminalIcon,
  GithubIcon
} from '../components/Icons.jsx';

const FALLBACK_DATA = {
  latest: {
    version: "1.2.0",
    published_at: "2026-09-18",
    notes: [
      "Ra mắt tính năng Tự động cập nhật (Auto Updater).",
      "Sửa lỗi gõ tiếng Việt (VNI/Telex) khi gõ phím.",
      "Thêm nút tùy chỉnh số phút tập trung.",
      "Thay đổi Logo ứng dụng phong cách vũ trụ.",
      "Vá lỗi kẹt tiến trình khi gỡ cài đặt (Uninstall)."
    ]
  },
  releases: [
    {
      version: "1.2.0",
      tag: "v1.2.0",
      published_at: "2026-09-18",
      is_latest: true,
      title: "Bản Phát Hành Ổn Định v1.2.0",
      summary: "Tích hợp tính năng Tự động Cập nhật (Auto Updater), hoàn thiện bộ gõ tiếng Việt trong Thử thách Gõ phím và nâng cấp giao diện Cosmos phong cách vũ trụ.",
      notes: [
        "Ra mắt tính năng Tự động cập nhật (Auto Updater).",
        "Sửa lỗi gõ tiếng Việt (VNI/Telex) khi gõ phím.",
        "Thêm nút tùy chỉnh số phút tập trung.",
        "Thay đổi Logo ứng dụng phong cách vũ trụ.",
        "Vá lỗi kẹt tiến trình khi gỡ cài đặt (Uninstall)."
      ],
      categorized_notes: {
        features: [
          "Tự động cập nhật (Auto Updater): Tự động kiểm tra bản phát hành mới, xác thực chữ ký Ed25519 và cập nhật âm thầm.",
          "Tùy chỉnh thời gian tập trung: Cho phép đặt linh hoạt thời gian phiên Focus theo nhu cầu cá nhân."
        ],
        improvements: [
          "Logo phong cách vũ trụ: Thiết kế biểu tượng Cosmos Gradient mới đồng bộ cùng chủ đề ứng dụng.",
          "Tối ưu bộ nhớ: Giảm thiểu thêm mức tiêu thụ CPU và RAM khi chạy chế độ nền."
        ],
        fixes: [
          "Sửa triệt để lỗi xung đột gõ tiếng Việt (Telex / VNI) trong màn hình Mindfulness Typing Challenge.",
          "Khắc phục sự cố tiến trình nền không giải phóng khi thực hiện gỡ cài đặt (Uninstall)."
        ]
      },
      files: {
        installer: {
          filename: "cainghien_tauri_1.2.0_x64-setup.exe",
          url: "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.2.0/cainghien_tauri_1.2.0_x64-setup.exe",
          direct_url: "/downloads/1.2.0/CaiNghien_Tauri_Setup.exe",
          sha256: "481c8bb0700499c520b32f41f4be6b46d45c570dccb6db9242a66fc65a791b05",
          size_bytes: 6426534,
          size_formatted: "6.1 MB",
          platform: "Windows 10 / 11 (64-bit)"
        }
      }
    },
    {
      version: "1.1.0",
      tag: "v1.1.0",
      published_at: "2026-09-17",
      is_latest: false,
      title: "Bản Phát Hành v1.1.0",
      summary: "Đại tu toàn diện thiết kế Cosmos Glassmorphism, tích hợp Heatmap 365 ngày và Focus Room Lofi.",
      notes: [
        "Đại tu giao diện toàn diện với thiết kế Cosmos Glassmorphism.",
        "Tích hợp màn hình Dashboard Heatmap 365 ngày.",
        "Tích hợp màn hình Focus Room với nhạc Lofi.",
        "Tích hợp màn hình Typing Challenge chấm điểm theo thời gian thực.",
        "Lưu trữ dữ liệu API thực tế vào ổ đĩa."
      ],
      categorized_notes: {
        features: [
          "Tích hợp màn hình Dashboard Heatmap 365 ngày theo dõi chuỗi ngày kỷ luật liên tục.",
          "Tích hợp màn hình Focus Room Kiosk với nhạc Lofi và âm thanh tiếng mưa tự nhiên.",
          "Tích hợp màn hình Typing Challenge chấm điểm WPM và độ chính xác thời gian thực."
        ],
        improvements: [
          "Giao diện chuẩn Cosmos Glassmorphism với hiệu ứng mờ đa tầng và màu sắc neon.",
          "Hệ thống lưu trữ cấu hình cục bộ tin cậy, không phụ thuộc kết nối đám mây."
        ],
        fixes: [
          "Tối ưu hóa độ mượt khi kích hoạt Kiosk Mode trên đa màn hình."
        ]
      },
      files: {
        installer: {
          filename: "cainghien_tauri_1.1.0_x64-setup.exe",
          url: "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.1.0/cainghien_tauri_1.1.0_x64-setup.exe",
          sha256: "8d7d9c165e0b5f6e078b6aebb5b94300521272216270d2dc6fcbadea2d856e8a",
          size_bytes: 4753402,
          size_formatted: "4.5 MB",
          platform: "Windows 10 / 11 (64-bit)"
        },
        msi: {
          filename: "cainghien_tauri_1.1.0_x64_en-US.msi",
          url: "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.1.0/cainghien_tauri_1.1.0_x64_en-US.msi",
          sha256: "34d529d37d74b755557cd69827172f099df92c705d532cd206104c5fe2e395c2",
          size_bytes: 8089600,
          size_formatted: "7.7 MB",
          platform: "Windows MSI Installer"
        }
      }
    },
    {
      version: "1.0.0",
      tag: "v1.0.0",
      published_at: "2026-09-16",
      is_latest: false,
      title: "Bản Phát Hành Khởi Đầu v1.0.0",
      summary: "Phiên bản chính thức đầu tiên trên nền tảng Rust & Tauri v2 với kiến trúc bảo vệ hệ thống đa tầng.",
      notes: [
        "Phiên bản v1.0.0 Chính Thức với kiến trúc Rust & Tauri tối ưu hóa bộ nhớ RAM.",
        "Chế độ khóa cứng ứng dụng (Kiosk Mode) vô hiệu hóa Alt+Tab và Windows Key.",
        "Giao diện Glassmorphism hoàn toàn mới bằng Vanilla CSS siêu mượt mà.",
        "Hệ thống Heatmap theo dõi chuỗi ngày kỷ luật và Thử thách gõ phím chánh niệm."
      ],
      categorized_notes: {
        features: [
          "Kiến trúc Rust & Tauri tối ưu hóa tài nguyên phần cứng cực nhẹ.",
          "Chế độ Kiosk Mode vô hiệu hóa phím tắt chuyển màn hình (Alt+Tab, WinKey).",
          "Khóa can thiệp tầng file Hosts và Windows Service chống gỡ ngang."
        ],
        improvements: [
          "Khởi tạo cấu trúc giao diện Glassmorphism thuần túy.",
          "Cơ chế Emergency Recovery an toàn 7 ngày đề phòng sự cố."
        ],
        fixes: [
          "Bản phát hành đầu tiên ra mắt cộng đồng."
        ]
      },
      files: {
        installer: {
          filename: "cainghien_tauri_0.1.0_x64-setup.exe",
          url: "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.0.0/cainghien_tauri_0.1.0_x64-setup.exe",
          direct_url: "/downloads/1.0.0/CaiNghien_Tauri_Setup.exe",
          sha256: "bbc19c7902c51681c815374037c2a793a461f3019a6b1629700b5f388bbb08b7",
          size_bytes: 4590767,
          size_formatted: "4.4 MB",
          platform: "Windows 10 / 11 (64-bit)"
        },
        msi: {
          filename: "CaiNghien_Tauri_Installer.msi",
          url: "/downloads/1.0.0/CaiNghien_Tauri_Installer.msi",
          direct_url: "/downloads/1.0.0/CaiNghien_Tauri_Installer.msi",
          sha256: "2a0bf9266211f5edb3fa9a9ce0524b8c4ba23d46e5e0068777ffe7a89f02c3ff",
          size_bytes: 5791744,
          size_formatted: "5.5 MB",
          platform: "Windows MSI Installer"
        }
      }
    }
  ]
};

export default function Releases() {
  const [data, setData] = useState(FALLBACK_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'latest', 'previous'
  const [copiedId, setCopiedId] = useState(null);
  const [expandedVerify, setExpandedVerify] = useState(false);
  const [verifyMode, setVerifyMode] = useState('hash'); // 'hash' or 'compare'
  const [expandedHistorical, setExpandedHistorical] = useState({});
  const copyTimerRef = useRef(null);

  const toggleHistoricalExpand = (ver) => {
    setExpandedHistorical(prev => ({ ...prev, [ver]: !prev[ver] }));
  };

  useEffect(() => {
    fetch('/data/releases.json')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (json && json.releases && json.releases.length > 0) {
          setData(json);
        }
      })
      .catch(err => {
        console.warn('Loaded fallback releases data:', err);
      });

    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyText = async (text, id) => {
    if (!text) return;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (e) {
      // Fallback
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
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
        console.warn('Fallback copy failed', e);
      }
    }

    if (success) {
      setCopiedId(id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const releasesList = data?.releases && data.releases.length > 0 ? data.releases : FALLBACK_DATA.releases;
  const latestRelease = releasesList.find(r => r.is_latest) || releasesList.find(r => r.version === data?.latest?.version) || releasesList[0] || FALLBACK_DATA.releases[0];
  const historicalReleases = releasesList.filter(r => r.version !== latestRelease.version);

  const normalizeForSearch = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim();
  };

  const releaseMatchesQuery = (rel, query) => {
    if (!query || !query.trim()) return true;
    const q = normalizeForSearch(query);
    const qRaw = query.toLowerCase().trim();

    const fields = [
      rel.version,
      `v${rel.version}`,
      rel.tag,
      rel.title,
      rel.summary
    ];

    if (Array.isArray(rel.notes)) {
      fields.push(...rel.notes);
    }

    if (rel.categorized_notes) {
      if (Array.isArray(rel.categorized_notes.features)) fields.push(...rel.categorized_notes.features);
      if (Array.isArray(rel.categorized_notes.improvements)) fields.push(...rel.categorized_notes.improvements);
      if (Array.isArray(rel.categorized_notes.fixes)) fields.push(...rel.categorized_notes.fixes);
    }

    if (rel.files) {
      Object.values(rel.files).forEach(f => {
        if (f.filename) fields.push(f.filename);
        if (f.platform) fields.push(f.platform);
        if (f.sha256) fields.push(f.sha256);
        if (f.size_formatted) fields.push(f.size_formatted);
      });
    }

    return fields.some(field => {
      if (!field) return false;
      const norm = normalizeForSearch(field);
      const raw = String(field).toLowerCase();
      return norm.includes(q) || raw.includes(qRaw);
    });
  };

  // Filtered lists based on search query and filter tabs
  const filteredHistorical = useMemo(() => {
    if (activeFilter === 'latest') return [];
    return historicalReleases.filter(rel => releaseMatchesQuery(rel, searchQuery));
  }, [historicalReleases, searchQuery, activeFilter]);

  const matchesLatest = useMemo(() => {
    if (activeFilter === 'previous') return false;
    return releaseMatchesQuery(latestRelease, searchQuery);
  }, [latestRelease, searchQuery, activeFilter]);

  const totalMatchingCount = (matchesLatest ? 1 : 0) + filteredHistorical.length;

  const latestInstaller = latestRelease.files?.installer;
  const latestSha = latestInstaller?.sha256 || "481c8bb0700499c520b32f41f4be6b46d45c570dccb6db9242a66fc65a791b05";
  const latestSize = latestInstaller?.size_formatted || "6.1 MB";
  const latestFilename = latestInstaller?.filename || `cainghien_tauri_${latestRelease.version}_x64-setup.exe`;
  const latestPsCmd = `Get-FileHash -Path "${latestFilename}" -Algorithm SHA256`;
  const latestPsCompareCmd = `(Get-FileHash "${latestFilename}").Hash -eq "${latestSha.toUpperCase()}"`;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
  };

  return (
    <div className="releases-page-wrapper">
      {/* Top Breadcrumb */}
      <div style={{ textAlign: 'center' }}>
        <div className="releases-breadcrumb">
          <Link to="/">Trang Chủ</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Lịch Sử Phát Hành & Bản Cập Nhật</span>
        </div>
      </div>

      {/* Hero Header */}
      <header className="releases-hero-header">
        <h1 className="releases-hero-title">
          Kho Vũ Khí &amp; <span className="gradient-heading-highlight">Bản Cập Nhật</span>
        </h1>
        <p className="releases-hero-subtitle">
          Tất cả các bản dựng chính thức của CaiNghiện Focus Guard cho Windows 10 &amp; 11 (64-bit). 
          Mỗi gói cài đặt được bảo vệ bằng chữ ký số Ed25519 và mã băm SHA-256 minh bạch.
        </p>
      </header>

      {/* Quick Stats Ribbon */}
      <div className="releases-stats-ribbon">
        <div className="stats-ribbon-card">
          <span className="stats-ribbon-label">
            <SparklesIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: 'var(--brand-400)' }} />
            Bản Mới Nhất
          </span>
          <span className="stats-ribbon-value">v{latestRelease.version}</span>
        </div>

        <div className="stats-ribbon-card">
          <span className="stats-ribbon-label">
            <CalendarClockIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: 'var(--accent-cyan)' }} />
            Ngày Ra Mắt
          </span>
          <span className="stats-ribbon-value">{formatDate(latestRelease.published_at)}</span>
        </div>

        <div className="stats-ribbon-card">
          <span className="stats-ribbon-label">
            <RefreshCwIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: '#34d399' }} />
            Tự Động Cập Nhật
          </span>
          <span className="stats-ribbon-value" style={{ color: '#34d399', fontSize: '1.05rem' }}>Đang Hoạt Động</span>
        </div>

        <div className="stats-ribbon-card">
          <span className="stats-ribbon-label">
            <CpuIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: 'var(--brand-300)' }} />
            Kiến Trúc Hỗ Trợ
          </span>
          <span className="stats-ribbon-value">Windows x64</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="releases-toolbar">
        <div className="releases-search-box">
          <SearchIcon className="svg-icon-standard" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="releases-search-input"
            placeholder="Tìm kiếm tính năng, mã lỗi, bản vá..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2px 6px' }}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="releases-filter-tabs">
          <button
            type="button"
            className={`releases-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Tất cả ({searchQuery.trim() ? totalMatchingCount : releasesList.length})
          </button>
          <button
            type="button"
            className={`releases-filter-btn ${activeFilter === 'latest' ? 'active' : ''}`}
            onClick={() => setActiveFilter('latest')}
          >
            Mới nhất (v{latestRelease.version})
          </button>
          <button
            type="button"
            className={`releases-filter-btn ${activeFilter === 'previous' ? 'active' : ''}`}
            onClick={() => setActiveFilter('previous')}
          >
            Tiền nhiệm ({searchQuery.trim() ? filteredHistorical.length : historicalReleases.length})
          </button>
        </div>
      </div>

      {/* =========================================================================
          FEATURED LATEST RELEASE HERO CARD (v1.2.0)
          ========================================================================= */}
      {matchesLatest && (
        <article className="releases-featured-card">
          <div className="featured-card-glow-bg" />

          {/* Top Banner Row */}
          <div className="featured-top-banner">
            <div className="latest-pulse-badge">
              <span className="latest-pulse-dot" />
              <span>BẢN PHÁT HÀNH MỚI NHẤT (LATEST STABLE)</span>
            </div>

            <div className="featured-meta-badges">
              <span className="trust-badge-item" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                <CalendarClockIcon className="svg-icon-standard" style={{ width: '14px', height: '14px' }} />
                <span>{formatDate(latestRelease.published_at)}</span>
              </span>
              <span className="trust-badge-item" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                <CpuIcon className="svg-icon-standard" style={{ width: '14px', height: '14px' }} />
                <span>Windows 10 / 11 (x64)</span>
              </span>
            </div>
          </div>

          {/* Version Headline & Summary */}
          <div className="featured-title-section">
            <h2 className="featured-version-headline">
              <span>{latestRelease.title || `CaiNghiện Focus Guard v${latestRelease.version}`}</span>
              <span className="version-hero-tag">v{latestRelease.version}</span>
            </h2>
            <p className="featured-summary-text">
              {latestRelease.summary || "Bản phát hành chính thức mang lại sự nâng cấp toàn diện về khả năng tự động cập nhật, độ ổn định hệ thống và trải nghiệm tập trung sâu."}
            </p>
          </div>

          {/* Quick Specs Grid */}
          <div className="featured-specs-grid">
            <div className="spec-chip">
              <div className="spec-chip-label">Dung lượng cài đặt</div>
              <div className="spec-chip-val">{latestSize}</div>
            </div>
            <div className="spec-chip">
              <div className="spec-chip-label">Định dạng gói</div>
              <div className="spec-chip-val">NSIS (.exe)</div>
            </div>
            <div className="spec-chip">
              <div className="spec-chip-label">Cơ chế cập nhật</div>
              <div className="spec-chip-val" style={{ color: '#34d399' }}>Tự động (Ed25519)</div>
            </div>
            <div className="spec-chip">
              <div className="spec-chip-label">Trạng thái</div>
              <div className="spec-chip-val" style={{ color: 'var(--brand-300)' }}>Sản xuất (GA)</div>
            </div>
          </div>

          {/* Action Download Cluster */}
          <div className="featured-downloads-row">
            <a
              href={latestInstaller?.url || "https://github.com/HairBaconGamming/CaiNghien/releases"}
              download
              className="btn-primary-release-dl"
            >
              <DownloadIcon className="svg-icon-standard" />
              <span>Tải CaiNghien v{latestRelease.version} (.exe)</span>
              <span className="btn-size-tag">{latestSize}</span>
            </a>

            {latestInstaller?.direct_url && (
              <a
                href={latestInstaller.direct_url}
                download
                className="btn-secondary-release-dl"
                title="Tải trực tiếp từ máy chủ web nếu mạng chặn GitHub"
              >
                <DownloadIcon className="svg-icon-standard" />
                <span>Máy Chủ Dự Phòng (.exe)</span>
              </a>
            )}

            <a
              href="https://github.com/HairBaconGamming/CaiNghien/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary-release-dl"
            >
              <GithubIcon className="svg-icon-standard" />
              <span>Xem trên GitHub</span>
              <ExternalLinkIcon className="svg-icon-standard" style={{ width: '14px', height: '14px', opacity: 0.7 }} />
            </a>
          </div>

          {/* SHA-256 Checksum Copy Box */}
          <div className="checksum-copy-box" aria-live="polite">
            <span className="checksum-hash-code" title={latestSha}>
              SHA-256: {latestSha}
            </span>
            <button
              type="button"
              onClick={() => handleCopyText(latestSha, `hash-${latestRelease.version}`)}
              className="copy-hash-button"
              aria-label={copiedId === `hash-${latestRelease.version}` ? "Đã chép" : "Sao chép mã SHA-256"}
            >
              {copiedId === `hash-${latestRelease.version}` ? (
                <>
                  <CheckIcon className="svg-icon-standard" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <CopyIcon className="svg-icon-standard" />
                  <span>Sao chép SHA-256</span>
                </>
              )}
            </button>
          </div>

          {/* Expandable PowerShell Integrity Verification */}
          <div className="release-verify-box">
            <div className="verify-box-header">
              <div className="verify-box-title">
                <TerminalIcon className="svg-icon-standard" style={{ width: '15px', height: '15px', color: 'var(--brand-300)' }} />
                <span>Xác thực tính toàn vẹn qua Windows PowerShell</span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedVerify(!expandedVerify)}
                className="download-secondary-button"
                style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                aria-expanded={expandedVerify}
              >
                <span>{expandedVerify ? "Thu gọn lệnh" : "Xem lệnh kiểm tra"}</span>
                {expandedVerify ? <ChevronUpIcon className="svg-icon-standard" style={{ width: '14px', height: '14px' }} /> : <ChevronDownIcon className="svg-icon-standard" style={{ width: '14px', height: '14px' }} />}
              </button>
            </div>

            {expandedVerify && (
              <div style={{ marginTop: '10px' }}>
                <div className="ps-cmd-toggle-group">
                  <button
                    type="button"
                    className={`ps-cmd-tab-btn ${verifyMode === 'hash' ? 'active' : ''}`}
                    onClick={() => setVerifyMode('hash')}
                  >
                    Tạo mã băm (Get-FileHash)
                  </button>
                  <button
                    type="button"
                    className={`ps-cmd-tab-btn ${verifyMode === 'compare' ? 'active' : ''}`}
                    onClick={() => setVerifyMode('compare')}
                  >
                    Kiểm tra tự động (True/False)
                  </button>
                </div>

                <div className="powershell-cmd-pill">
                  <code>{verifyMode === 'hash' ? latestPsCmd : latestPsCompareCmd}</code>
                  <button
                    type="button"
                    onClick={() => handleCopyText(verifyMode === 'hash' ? latestPsCmd : latestPsCompareCmd, 'ps-cmd')}
                    className="copy-hash-button"
                    style={{ flexShrink: 0 }}
                  >
                    {copiedId === 'ps-cmd' ? (
                      <>
                        <CheckIcon className="svg-icon-standard" />
                        <span>Đã chép lệnh</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="svg-icon-standard" />
                        <span>Chép lệnh</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Categorized Changelog Grid */}
          <div className="changelog-sections-container">
            {/* New Features */}
            <div className="changelog-category-card">
              <div className="changelog-category-header feature">
                <RocketIcon className="svg-icon-standard" style={{ width: '16px', height: '16px' }} />
                <span>Tính Năng Mới</span>
              </div>
              <ul className="changelog-category-list">
                {(latestRelease.categorized_notes?.features || [
                  "Ra mắt tính năng Tự động cập nhật (Auto Updater) đồng bộ với GitHub Releases.",
                  "Thêm nút tùy chỉnh số phút tập trung (Focus Timer) linh hoạt theo nhu cầu cá nhân."
                ]).map((feat, i) => (
                  <li key={i} className="changelog-item-row">
                    <span className="changelog-bullet-dot" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvements */}
            <div className="changelog-category-card">
              <div className="changelog-category-header improvement">
                <WrenchIcon className="svg-icon-standard" style={{ width: '16px', height: '16px' }} />
                <span>Cải Tiến &amp; Tối Ưu</span>
              </div>
              <ul className="changelog-category-list">
                {(latestRelease.categorized_notes?.improvements || [
                  "Thay đổi Logo ứng dụng phong cách vũ trụ Cosmos Gradient neon hiện đại.",
                  "Tối ưu mức tiêu thụ bộ nhớ RAM xuống mức tối thiểu khi chạy nền."
                ]).map((imp, i) => (
                  <li key={i} className="changelog-item-row">
                    <span className="changelog-bullet-dot" style={{ background: 'var(--accent-cyan)' }} />
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bug Fixes */}
            <div className="changelog-category-card">
              <div className="changelog-category-header fix">
                <BugIcon className="svg-icon-standard" style={{ width: '16px', height: '16px' }} />
                <span>Vá Lỗi &amp; Ổn Định</span>
              </div>
              <ul className="changelog-category-list">
                {(latestRelease.categorized_notes?.fixes || [
                  "Sửa lỗi gõ tiếng Việt (VNI/Telex) khi gõ Thử Thách Cam Kết Mindfulness.",
                  "Vá lỗi kẹt tiến trình service nền khi thực hiện gỡ cài đặt (Uninstall)."
                ]).map((fix, i) => (
                  <li key={i} className="changelog-item-row">
                    <span className="changelog-bullet-dot" style={{ background: '#34d399' }} />
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      )}

      {/* =========================================================================
          HISTORICAL TIMELINE SECTION
          ========================================================================= */}
      {filteredHistorical.length > 0 && (
        <section className="releases-timeline-section">
          <div className="timeline-section-title">
            <TagIcon className="svg-icon-standard" style={{ color: 'var(--brand-400)' }} />
            <span>Dòng Thời Gian Các Bản Phát Hành Tiền Nhiệm</span>
          </div>
          <p className="timeline-section-desc">
            Xem lại lịch sử hoàn thiện tính năng, các bước tối ưu hóa và liên kết tải về của các bản dựng trước.
          </p>

          <div className="releases-timeline">
            {filteredHistorical.map((release, idx) => {
              const fileInstaller = release.files?.installer;
              const fileMsi = release.files?.msi;
              const hashVal = fileInstaller?.sha256;
              const sizeVal = fileInstaller?.size_formatted || (fileInstaller?.size_bytes ? `${Math.round(fileInstaller.size_bytes / 1024 / 1024 * 10) / 10} MB` : '4.5 MB');

              return (
                <div key={idx} className="timeline-entry">
                  {/* Orbital Marker Orb */}
                  <div className="timeline-marker-orb">
                    <div className="timeline-marker-inner" />
                  </div>

                  {/* Timeline Glass Card */}
                  <div className="timeline-card-glass">
                    <div className="timeline-header-flex">
                      <div className="timeline-version-group">
                        <span className="release-version-pill" style={{ fontSize: '0.85rem' }}>
                          v{release.version}
                        </span>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                          {release.title || `Bản Cập Nhật v${release.version}`}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="release-timestamp-text">
                          {formatDate(release.published_at)}
                        </span>
                      </div>
                    </div>

                    {release.summary && (
                      <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        {release.summary}
                      </p>
                    )}

                    {/* Change notes */}
                    <ul className="timeline-notes-list">
                      {release.notes?.map((note, noteIdx) => (
                        <li key={noteIdx} className="timeline-note-bullet">
                          <CheckCircleIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: 'var(--brand-400)', flexShrink: 0, marginTop: '2px' }} />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Checksum if available */}
                    {hashVal && (
                      <div className="checksum-copy-box" style={{ padding: '8px 14px', marginBottom: fileMsi?.sha256 ? '8px' : '12px' }}>
                        <span className="checksum-hash-code" style={{ fontSize: '0.78rem' }} title={hashVal}>
                          SHA-256 (.exe): {hashVal}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(hashVal, `hash-${release.version}`)}
                          className="copy-hash-button"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {copiedId === `hash-${release.version}` ? (
                            <>
                              <CheckIcon className="svg-icon-standard" style={{ width: '13px', height: '13px' }} />
                              <span>Đã chép</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon className="svg-icon-standard" style={{ width: '13px', height: '13px' }} />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {fileMsi?.sha256 && (
                      <div className="checksum-copy-box" style={{ padding: '8px 14px', marginBottom: '12px' }}>
                        <span className="checksum-hash-code" style={{ fontSize: '0.78rem' }} title={fileMsi.sha256}>
                          SHA-256 (.msi): {fileMsi.sha256}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(fileMsi.sha256, `hash-msi-${release.version}`)}
                          className="copy-hash-button"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {copiedId === `hash-msi-${release.version}` ? (
                            <>
                              <CheckIcon className="svg-icon-standard" style={{ width: '13px', height: '13px' }} />
                              <span>Đã chép</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon className="svg-icon-standard" style={{ width: '13px', height: '13px' }} />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Expandable Details Button */}
                    <div style={{ marginTop: '8px', marginBottom: '4px' }}>
                      <button
                        type="button"
                        onClick={() => toggleHistoricalExpand(release.version)}
                        className="timeline-expand-btn"
                        aria-expanded={!!expandedHistorical[release.version]}
                      >
                        <span>
                          {expandedHistorical[release.version]
                            ? "Thu gọn chi tiết & lệnh kiểm tra"
                            : "Xem phân loại bản vá & kiểm tra mã băm"}
                        </span>
                        {expandedHistorical[release.version] ? (
                          <ChevronUpIcon className="svg-icon-standard" style={{ width: '14px', height: '14px' }} />
                        ) : (
                          <ChevronDownIcon className="svg-icon-standard" style={{ width: '14px', height: '14px' }} />
                        )}
                      </button>
                    </div>

                    {/* Expanded Drawer for Historical Release */}
                    {expandedHistorical[release.version] && (
                      <div className="timeline-expanded-content">
                        {release.categorized_notes && (
                          <div className="changelog-sections-container" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none' }}>
                            {release.categorized_notes.features?.length > 0 && (
                              <div className="changelog-category-card">
                                <div className="changelog-category-header feature">
                                  <RocketIcon className="svg-icon-standard" style={{ width: '15px', height: '15px' }} />
                                  <span>Tính Năng Mới</span>
                                </div>
                                <ul className="changelog-category-list">
                                  {release.categorized_notes.features.map((feat, i) => (
                                    <li key={i} className="changelog-item-row">
                                      <span className="changelog-bullet-dot" />
                                      <span>{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {release.categorized_notes.improvements?.length > 0 && (
                              <div className="changelog-category-card">
                                <div className="changelog-category-header improvement">
                                  <WrenchIcon className="svg-icon-standard" style={{ width: '15px', height: '15px' }} />
                                  <span>Cải Tiến &amp; Tối Ưu</span>
                                </div>
                                <ul className="changelog-category-list">
                                  {release.categorized_notes.improvements.map((imp, i) => (
                                    <li key={i} className="changelog-item-row">
                                      <span className="changelog-bullet-dot" style={{ background: 'var(--accent-cyan)' }} />
                                      <span>{imp}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {release.categorized_notes.fixes?.length > 0 && (
                              <div className="changelog-category-card">
                                <div className="changelog-category-header fix">
                                  <BugIcon className="svg-icon-standard" style={{ width: '15px', height: '15px' }} />
                                  <span>Vá Lỗi &amp; Ổn Định</span>
                                </div>
                                <ul className="changelog-category-list">
                                  {release.categorized_notes.fixes.map((fix, i) => (
                                    <li key={i} className="changelog-item-row">
                                      <span className="changelog-bullet-dot" style={{ background: '#34d399' }} />
                                      <span>{fix}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {fileInstaller?.filename && (
                          <div className="release-verify-box" style={{ marginTop: '6px' }}>
                            <div className="verify-box-header">
                              <div className="verify-box-title">
                                <TerminalIcon className="svg-icon-standard" style={{ width: '14px', height: '14px', color: 'var(--brand-300)' }} />
                                <span>PowerShell Hash Check (v{release.version})</span>
                              </div>
                            </div>
                            <div className="powershell-cmd-pill">
                              <code>Get-FileHash -Path "{fileInstaller.filename}" -Algorithm SHA256</code>
                              <button
                                type="button"
                                onClick={() => handleCopyText(`Get-FileHash -Path "${fileInstaller.filename}" -Algorithm SHA256`, `ps-cmd-${release.version}`)}
                                className="copy-hash-button"
                                style={{ flexShrink: 0 }}
                              >
                                {copiedId === `ps-cmd-${release.version}` ? (
                                  <>
                                    <CheckIcon className="svg-icon-standard" />
                                    <span>Đã chép</span>
                                  </>
                                ) : (
                                  <>
                                    <CopyIcon className="svg-icon-standard" />
                                    <span>Chép lệnh</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Download Buttons for Historical release */}
                    <div className="timeline-bottom-actions">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {fileInstaller && (
                          <a
                            href={fileInstaller.url}
                            download
                            className="download-primary-button"
                            style={{ padding: '9px 18px', fontSize: '0.875rem' }}
                          >
                            <DownloadIcon className="svg-icon-standard" style={{ width: '16px', height: '16px' }} />
                            <span>Tải v{release.version} Setup (.exe)</span>
                            <span className="btn-size-tag" style={{ fontSize: '0.75rem' }}>{sizeVal}</span>
                          </a>
                        )}

                        {fileInstaller?.direct_url && (
                          <a
                            href={fileInstaller.direct_url}
                            download
                            className="download-secondary-button"
                            style={{ padding: '9px 16px', fontSize: '0.85rem' }}
                            title="Tải từ máy chủ dự phòng"
                          >
                            <DownloadIcon className="svg-icon-standard" style={{ width: '16px', height: '16px' }} />
                            <span>Tải dự phòng</span>
                          </a>
                        )}

                        {fileMsi && (
                          <a
                            href={fileMsi.url}
                            download
                            className="download-secondary-button"
                            style={{ padding: '9px 16px', fontSize: '0.85rem' }}
                            title="Gói cài đặt MSI cho quản trị viên"
                          >
                            <DownloadIcon className="svg-icon-standard" style={{ width: '16px', height: '16px' }} />
                            <span>Gói MSI</span>
                          </a>
                        )}
                      </div>

                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Kiến trúc: Windows x64
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* No results message if search has no matches */}
      {!matchesLatest && filteredHistorical.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border-light)' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Không tìm thấy bản phát hành nào phù hợp với từ khóa "<strong>{searchQuery}</strong>".
          </p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
            className="download-primary-button"
          >
            <span>Hiển thị tất cả bản phát hành</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          SECURITY & UPDATE ARCHITECTURE PANEL
          ========================================================================= */}
      <section className="releases-security-architecture">
        <div className="security-arch-header">
          <span className="security-arch-kicker">Kiến Trúc Bảo Mật Toàn Vẹn</span>
          <h2 className="security-arch-title">3 Tầng Bảo Vệ Khi Cập Nhật Hệ Thống</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            CaiNghiện can thiệp vào tầng hệ thống Windows để bảo vệ bạn khỏi sự phân tâm, 
            do đó mỗi bản cập nhật đều tuân thủ quy trình kiểm định an toàn nghiêm ngặt nhất.
          </p>
        </div>

        <div className="security-steps-grid">
          <div className="security-step-card">
            <div className="security-step-number">01</div>
            <div className="security-step-heading">Chữ Ký Số Ed25519</div>
            <p className="security-step-text">
              Mọi gói nhị phân từ v1.2.0 đều được ký số bằng khóa mật mã Tauri Ed25519. 
              Trình cập nhật từ chối thực thi bất kỳ tệp nào không khớp chữ ký xác thực.
            </p>
          </div>

          <div className="security-step-card">
            <div className="security-step-number">02</div>
            <div className="security-step-heading">Đối Soát SHA-256 Bitwise</div>
            <p className="security-step-text">
              Mã băm SHA-256 được công bố độc lập trên manifest. Người dùng có thể kiểm tra 
              toàn vẹn từng byte dữ liệu trực tiếp trong PowerShell trước khi khởi chạy.
            </p>
          </div>

          <div className="security-step-card">
            <div className="security-step-number">03</div>
            <div className="security-step-heading">Thay Thế Nguyên Tử (Atomic)</div>
            <p className="security-step-text">
              Quy trình cập nhật nền giải phóng tiến trình an toàn, ngăn ngừa triệt để 
              lỗi kẹt file locked và duy trì toàn vẹn dữ liệu chuỗi ngày (Streak) của bạn.
            </p>
          </div>
        </div>

        {/* Machine-readable Endpoints */}
        <div className="security-arch-endpoints">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kênh cấp dữ liệu tự động (API):</span>
          <a href="/data/tauri-update.json" target="_blank" rel="noopener noreferrer" className="manifest-link-pill">
            <FileCodeIcon className="svg-icon-standard" style={{ width: '15px', height: '15px' }} />
            <span>tauri-update.json (Updater V2)</span>
          </a>
          <a href="/data/releases.json" target="_blank" rel="noopener noreferrer" className="manifest-link-pill">
            <FileCodeIcon className="svg-icon-standard" style={{ width: '15px', height: '15px' }} />
            <span>releases.json (Full Changelog)</span>
          </a>
          <a href="/data/update-manifest.json" target="_blank" rel="noopener noreferrer" className="manifest-link-pill">
            <FileCodeIcon className="svg-icon-standard" style={{ width: '15px', height: '15px' }} />
            <span>update-manifest.json</span>
          </a>
        </div>
      </section>

      {/* =========================================================================
          FAQ / INSTALLATION TIPS CARDS
          ========================================================================= */}
      <section style={{ marginTop: '50px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <InfoIcon className="svg-icon-standard" style={{ color: 'var(--accent-cyan)' }} />
          <span>Lưu Ý Cài Đặt Dành Cho Windows</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.55)', border: '1px solid var(--glass-border-light)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheckIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: 'var(--accent-amber)' }} />
              <span>Cảnh Báo Microsoft SmartScreen</span>
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Vì là phần mềm mã nguồn mở cá nhân chưa mua chứng chỉ đắt đỏ từ Microsoft, Windows Defender có thể hiện "Windows protected your PC". Bạn chỉ cần bấm <strong>"More info" (Thông tin thêm)</strong> &gt; <strong>"Run anyway" (Vẫn chạy)</strong>.
            </p>
          </div>

          <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.55)', border: '1px solid var(--glass-border-light)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TerminalIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: 'var(--brand-400)' }} />
              <span>Quyền Quản Trị (Administrator)</span>
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Để thiết lập bảo vệ tầng thấp Windows (tự động ghi đè Hosts chặn web đen và cài đặt Windows Service chạy ngầm), bạn cần đồng ý cấp quyền Administrator (UAC Prompt) trong lần cài đặt đầu tiên.
            </p>
          </div>

          <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.55)', border: '1px solid var(--glass-border-light)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCwIcon className="svg-icon-standard" style={{ width: '16px', height: '16px', color: '#34d399' }} />
              <span>Cập Nhật Nền Từ Bản v1.2.0</span>
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Bắt đầu từ phiên bản v1.2.0, bạn sẽ không cần phải tải lại thủ công từ trang web mỗi khi có bản vá. Ứng dụng tích hợp Tauri Auto Updater sẽ tự động thông báo và áp dụng bản cập nhật ngay trong app.
            </p>
          </div>
        </div>
      </section>

      {/* Return to home link */}
      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <Link to="/" className="download-secondary-button" style={{ display: 'inline-flex', padding: '12px 24px' }}>
          <span>← Quay lại Trang Chủ CaiNghiện</span>
        </Link>
      </div>
    </div>
  );
}
