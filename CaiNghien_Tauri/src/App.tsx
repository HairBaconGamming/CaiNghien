import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Sliders,
  Lock,
  Unlock,
  Power,
  PowerOff,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  X,
  Key,
  KeyRound,
  Play,
  Pause,
  Flame,
  Sparkles,
  Zap,
  Award,
  Gem,
  Crown,
  Sun,
  Trophy,
  Star,
  Hourglass,
  BarChart3,
  Clock,
  Globe,
  Info,
  CheckCircle2,
  Minus,
  Square,
  Cpu,
  RefreshCw,
  HelpCircle,
  Activity,
  LayoutDashboard,
  Timer,
  Maximize2,
  CalendarCheck2
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

// Core New Components
import { DisciplineHeatmap, DayHistoryItem } from './components/DisciplineHeatmap';
import { ScheduleModal, ScheduleConfig, getScheduleStatusInfo } from './components/ScheduleModal';
import { MindfulnessModal } from './components/MindfulnessModal';
import { FocusRoom } from './components/FocusRoom';

export interface TierData {
  level: number;
  name: string;
  nameEn: string;
  minHours: number;
  maxHours: number;
  icon: typeof Shield;
  color: string;
  glow: string;
  gradient: string;
}

export const TIERS: TierData[] = [
  { level: 1, name: "Mầm Non Kỷ Luật", nameEn: "Novice Seed", minHours: 0, maxHours: 10, icon: Sparkles, color: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)", gradient: "linear-gradient(135deg, #0284c7, #38bdf8)" },
  { level: 2, name: "Thiết Binh", nameEn: "Iron Mind", minHours: 10, maxHours: 30, icon: Shield, color: "#34d399", glow: "rgba(52, 211, 153, 0.4)", gradient: "linear-gradient(135deg, #059669, #34d399)" },
  { level: 3, name: "Tiên Phong Đồng", nameEn: "Bronze Vanguard", minHours: 30, maxHours: 60, icon: Zap, color: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)", gradient: "linear-gradient(135deg, #d97706, #fbbf24)" },
  { level: 4, name: "Hiệp Sĩ Bạc", nameEn: "Silver Knight", minHours: 60, maxHours: 100, icon: Flame, color: "#818cf8", glow: "rgba(129, 140, 248, 0.45)", gradient: "linear-gradient(135deg, #4f46e5, #818cf8)" },
  { level: 5, name: "Thủ Hộ Kim Tinh", nameEn: "Gold Guardian", minHours: 100, maxHours: 150, icon: Award, color: "#f59e0b", glow: "rgba(245, 158, 11, 0.5)", gradient: "linear-gradient(135deg, #b45309, #f59e0b)" },
  { level: 6, name: "Vệ Binh Bạch Kim", nameEn: "Platinum Sentinel", minHours: 150, maxHours: 210, icon: Gem, color: "#06b6d4", glow: "rgba(6, 182, 212, 0.55)", gradient: "linear-gradient(135deg, #0891b2, #06b6d4)" },
  { level: 7, name: "Chúa Tể Kim Cương", nameEn: "Diamond Sovereign", minHours: 210, maxHours: 280, icon: Crown, color: "#a855f7", glow: "rgba(168, 85, 247, 0.6)", gradient: "linear-gradient(135deg, #7e22ce, #c084fc)" },
  { level: 8, name: "Tinh Anh Vũ Trụ", nameEn: "Cosmic Astral", minHours: 280, maxHours: 360, icon: Sun, color: "#f43f5e", glow: "rgba(244, 63, 94, 0.65)", gradient: "linear-gradient(135deg, #e11d48, #fb7185)" },
  { level: 9, name: "Đại Tông Sư", nameEn: "Grandmaster", minHours: 360, maxHours: 450, icon: Trophy, color: "#ec4899", glow: "rgba(236, 72, 153, 0.7)", gradient: "linear-gradient(135deg, #db2777, #f472b6)" },
  { level: 10, name: "Kỷ Luật Tối Thượng", nameEn: "Cyber-Zen Ascendant", minHours: 450, maxHours: Infinity, icon: Star, color: "#c084fc", glow: "rgba(192, 132, 252, 0.8)", gradient: "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)" }
];

export function calculateStreak(dailyStats: Record<string, number> = {}): number {
  let streak = 0;
  const checkDate = new Date();
  
  const toDateStr = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  };

  const todayStr = toDateStr(checkDate);
  if ((dailyStats[todayStr] || 0) > 0) {
    streak++;
  }
  checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
    const dateStr = toDateStr(checkDate);
    if ((dailyStats[dateStr] || 0) > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getGamificationInfo(rawHours: number) {
  const hours = Math.max(0, Number(rawHours) || 0);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const tier = TIERS[i];
    if (hours >= tier.minHours) {
      const isMaxLevel = tier.maxHours === Infinity;
      const currentInLevel = hours - tier.minHours;
      const requiredInLevel = isMaxLevel ? 0 : tier.maxHours - tier.minHours;
      const progressPercent = isMaxLevel
        ? 100
        : Math.min(100, Math.max(0, Math.round((currentInLevel / requiredInLevel) * 100)));
      const remainingHours = isMaxLevel ? 0 : Math.max(0, tier.maxHours - hours);
      return {
        level: tier.level,
        tier,
        isMaxLevel,
        currentInLevel,
        requiredInLevel,
        progressPercent,
        remainingHours,
        totalHours: hours
      };
    }
  }
  return {
    level: 1,
    tier: TIERS[0],
    isMaxLevel: false,
    currentInLevel: 0,
    requiredInLevel: 10,
    progressPercent: 0,
    remainingHours: 10,
    totalHours: 0
  };
}

export function GamificationCard({ totalHours, streakDays }: { totalHours: number; streakDays?: number }) {
  const info = getGamificationInfo(totalHours);
  const TierIcon = info.tier.icon;

  return (
    <div className="gamification-card" style={{ '--tier-glow': info.tier.glow } as React.CSSProperties}>
      <div className="gamification-badge-section">
        <div className="glow-badge-wrapper">
          <div className="glow-badge-aura" />
          <div className="glow-badge-emblem" style={{ background: info.tier.gradient }}>
            <TierIcon size={30} color="#ffffff" className="glow-badge-icon" />
          </div>
          <span className="glow-badge-level-chip">Cấp {info.level}</span>
        </div>

        <div className="gamification-info-header">
          <div className="gamification-title-row">
            <span className="gamification-tier-name">{info.tier.name}</span>
            {streakDays !== undefined && streakDays > 0 && (
              <span className="streak-pill">🔥 {streakDays} ngày liên tiếp</span>
            )}
          </div>
          <div className="gamification-subtext">
            {info.isMaxLevel ? "Đạt cảnh giới tối thượng" : `${info.totalHours}h tích lũy · Cần thêm ${info.remainingHours}h để thăng cấp`}
          </div>
        </div>
      </div>

      {/* Dynamic Animated Progress Bar */}
      <div className="gamification-progress-section">
        <div className="progress-labels-row">
          <span className="progress-text-label">Tiến trình cấp độ</span>
          <span className="progress-text-percent" style={{ color: info.tier.color }}>
            {info.progressPercent}%
          </span>
        </div>

        <div className="glow-progress-track">
          <div 
            className="glow-progress-fill" 
            style={{ 
              width: `${info.progressPercent}%`,
              background: info.tier.gradient,
              boxShadow: `0 0 10px ${info.tier.glow}`
            }}
          >
            <div className="glow-progress-shimmer" />
          </div>
        </div>

        <div className="progress-footer-row">
          <span>{info.currentInLevel}h / {info.requiredInLevel}h</span>
          <span>{info.isMaxLevel ? "Cấp tối đa" : `Còn ${info.remainingHours}h tới Cấp ${info.level + 1}`}</span>
        </div>
      </div>
    </div>
  );
}

export interface AppConfig {
  protection_enabled: boolean;
  blocked_domains: string[];
  password_hash: string | null;
  unlock_requested_at: number | null;
  start_with_windows: boolean;
  change_delay_enabled: boolean;
  block_nsfw: boolean;
  protection_started_at: number | null;
  violations_count: number;
  daily_quota_minutes: number;
  quota_used_seconds: number;
  quota_last_reset_date: string;
  hardcore_until: number | null;
  daily_stats: Record<string, number>;
  daily_history?: Record<string, DayHistoryItem>;
  total_focus_hours: number;
  current_day_focus_seconds?: number;
  level?: number;
  xp?: number;
  streak?: number;
  schedule?: ScheduleConfig;
  schedule_enabled?: boolean;
  schedule_start?: string;
  schedule_end?: string;
  schedule_days?: number[];
}

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  // Modals & Barriers
  const [showMindfulness, setShowMindfulness] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showPenaltyWarning, setShowPenaltyWarning] = useState(false);
  const [showPenaltyNotice, setShowPenaltyNotice] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFocusRoom, setShowFocusRoom] = useState(false);
  
  const [showHardcore, setShowHardcore] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const [isLockScreen, setIsLockScreen] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(60);

  const fetchConfig = () => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('invoke timeout')), 5000)
    );
    Promise.race([invoke<AppConfig>('get_app_config'), timeout])
      .then((data) => setConfig(data))
      .catch((err) => {
        console.error("Tauri invoke failed (likely in browser). Using mock config.", err);
        setConfig({
          protection_enabled: false,
          blocked_domains: ["facebook.com", "tiktok.com", "youtube.com"],
          password_hash: null,
          unlock_requested_at: null,
          start_with_windows: true,
          change_delay_enabled: false,
          block_nsfw: true,
          protection_started_at: null,
          violations_count: 0,
          daily_quota_minutes: 60,
          quota_used_seconds: 0,
          quota_last_reset_date: "",
          hardcore_until: null,
          daily_stats: {},
          daily_history: {},
          total_focus_hours: 0,
          level: 1,
          xp: 0,
          streak: 0,
          schedule: {
            enabled: false,
            start_time: "08:00",
            end_time: "17:00",
            days_of_week: [1, 2, 3, 4, 5]
          }
        });
      });
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Hardcore Countdown Timer
  useEffect(() => {
    if (!showHardcore) return;
    
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [showHardcore]);

  // Lockscreen Listener
  useEffect(() => {
    const unlisten = listen('trigger-lockscreen', async () => {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(true);
      await win.setFullscreen(true);
      setIsLockScreen(true);
      setLockCountdown(60);
      try {
        await invoke('lock_hardware_input');
      } catch (e) {
        console.error(e);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // Lockscreen Countdown
  useEffect(() => {
    if (!isLockScreen) return;
    const interval = setInterval(async () => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsLockScreen(false);
          const win = getCurrentWindow();
          win.setFullscreen(false);
          win.setAlwaysOnTop(false);
          invoke('unlock_hardware_input').catch(console.error);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLockScreen]);

  if (!config) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <div className="status-indicator">
          <RefreshCw size={20} className="spin-slow" /> Đang tải cấu hình hệ thống...
        </div>
      </div>
    );
  }

  const isGuarding = config.protection_enabled;
  const isHardcoreActive = config.hardcore_until ? Date.now() < config.hardcore_until * 1000 : false;

  const updateConfig = (partial: Partial<AppConfig>) => {
    const newConfig = { ...config, ...partial };
    setConfig(newConfig);
    invoke('save_app_config', { newConfig }).catch(console.error);
  };

  // Schedule status helper
  const scheduleConfig: ScheduleConfig = config.schedule || {
    enabled: config.schedule_enabled ?? false,
    start_time: config.schedule_start ?? "08:00",
    end_time: config.schedule_end ?? "17:00",
    days_of_week: config.schedule_days ?? [1, 2, 3, 4, 5]
  };
  const scheduleStatus = getScheduleStatusInfo(scheduleConfig);

  /**
   * R3 & R5 Interception Flow:
   * 1. If currently guarding: Intercept with MindfulnessModal BEFORE password prompt!
   * 2. After 100% exact match in MindfulnessModal:
   *    - If password set -> Show PasswordPromptModal
   *    - If no password -> Show PenaltyWarningModal directly
   * 3. After password verified -> Show PenaltyWarningModal
   * 4. User confirms Penalty -> Invoke apply_penalty, reset state to Level 1 / 0 XP / 0 Streak
   */
  const handleToggleGuard = () => {
    if (isHardcoreActive) return;

    if (isGuarding) {
      // Intercept with Mindfulness Typing Test Barrier
      setShowMindfulness(true);
    } else {
      updateConfig({ 
        protection_enabled: true,
        protection_started_at: Math.floor(Date.now() / 1000)
      });
    }
  };

  // Mindfulness Barrier passed
  const handleMindfulnessSuccess = () => {
    setShowMindfulness(false);
    if (config.password_hash) {
      setShowPasswordPrompt(true);
    } else {
      setShowPenaltyWarning(true);
    }
  };

  // Password verified passed
  const handlePasswordSuccess = () => {
    setShowPasswordPrompt(false);
    setShowPenaltyWarning(true);
  };

  // Confirmed Penalty Execution: Reset Level, XP, Streak to 0
  const handleConfirmPenaltyStop = async () => {
    setShowPenaltyWarning(false);

    try {
      await invoke('apply_penalty');
    } catch (err) {
      console.warn("apply_penalty IPC failed or in browser mock:", err);
    }

    // Immediately reset UI gamification state
    const penalizedConfig: AppConfig = {
      ...config,
      protection_enabled: false,
      protection_started_at: null,
      level: 1,
      xp: 0,
      streak: 0,
      total_focus_hours: 0,
      current_day_focus_seconds: 0,
      daily_stats: {},
      daily_history: {},
      violations_count: (config.violations_count || 0) + 1
    };

    setConfig(penalizedConfig);
    try {
      await invoke('save_app_config', { newConfig: penalizedConfig });
    } catch (e) {
      console.warn(e);
    }

    setShowPenaltyNotice(true);
  };

  const handleSaveSchedule = (newSchedule: ScheduleConfig) => {
    updateConfig({
      schedule: newSchedule,
      schedule_enabled: newSchedule.enabled,
      schedule_start: newSchedule.start_time,
      schedule_end: newSchedule.end_time,
      schedule_days: newSchedule.days_of_week
    });
  };

  const handleFocusSessionComplete = (minutes: number) => {
    const today = new Date().toISOString().split('T')[0];
    const currentMins = config.daily_stats?.[today] || 0;
    const newStats = {
      ...(config.daily_stats || {}),
      [today]: currentMins + minutes
    };
    const additionalHours = Math.floor((currentMins + minutes) / 60);

    updateConfig({
      daily_stats: newStats,
      total_focus_hours: (config.total_focus_hours || 0) + additionalHours
    });
  };

  return (
    <>
      <TitleBar />
      <div className="app-container">
        <div className="bg-blur-indigo" />
        <div className="bg-blur-rose" />

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo-box">
              <ShieldCheck size={24} color="white" />
            </div>
            <h1 className="logo-text">
              CaiNghiện
            </h1>
          </div>

          <nav className="nav-menu">
            <NavItem 
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')} 
              icon={<LayoutDashboard size={20} />} 
              label="Bảng điều khiển" 
            />
            <NavItem 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={<Sliders size={20} />} 
              label="Cài đặt" 
            />
            <NavItem 
              active={activeTab === 'password'} 
              onClick={() => setActiveTab('password')} 
              icon={<KeyRound size={20} />} 
              label="Mật khẩu" 
            />
          </nav>

          {/* Quick Action: Focus Room */}
          <div className="sidebar-action-box">
            <button 
              onClick={() => setShowFocusRoom(true)} 
              className="btn-sidebar-focus"
            >
              <Maximize2 size={16} />
              <span>Không gian Tĩnh tâm</span>
            </button>
          </div>

          <div className="status-box">
            <div className="status-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} /> Trạng thái
            </div>
            <div className="status-indicator">
              <div className={`status-dot ${isGuarding ? "guarding" : "paused"}`} />
              <span className="status-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isGuarding ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                {isGuarding ? 'Đang bảo vệ' : 'Tạm dừng'}
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <header className="main-header">
            <div className="header-title-group">
              <h2 className="main-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {activeTab === 'home' && <><LayoutDashboard size={24} className="icon-indigo" /> Bảng điều khiển</>}
                {activeTab === 'settings' && <><Sliders size={24} className="icon-indigo" /> Cài đặt</>}
                {activeTab === 'password' && <><KeyRound size={24} className="icon-indigo" /> Bảo mật & Khóa</>}
              </h2>

              {/* Real-time Schedule Live Badge in Header */}
              {scheduleConfig.enabled && (
                <div 
                  className={`header-schedule-badge ${scheduleStatus.badgeClass}`}
                  onClick={() => setShowScheduleModal(true)}
                  title="Bấm để chỉnh sửa khung giờ làm việc"
                >
                  <div className="status-pulse-dot" />
                  <span>{scheduleStatus.isActive ? 'Khung giờ làm việc' : 'Ngoài giờ làm việc'} ({scheduleConfig.start_time} - {scheduleConfig.end_time})</span>
                </div>
              )}
            </div>
            
            <div className="header-actions">
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="btn-header-secondary"
                title="Cấu hình Lập lịch Cố định"
              >
                <CalendarCheck2 size={18} />
                <span>Lập lịch</span>
              </button>

              <button 
                onClick={handleToggleGuard}
                className={`btn-guard ${isGuarding ? "guarding" : "paused"} ${isHardcoreActive ? 'disabled' : ''}`}
                disabled={isHardcoreActive}
              >
                {isGuarding ? (
                  isHardcoreActive ? (
                    <><Flame size={18} /> Đang Tử Thủ</>
                  ) : (
                    <><Power size={18} /> Dừng bảo vệ</>
                  )
                ) : (
                  <><ShieldCheck size={18} /> Bật bảo vệ</>
                )}
              </button>
            </div>
          </header>

          <div className="content-area custom-scrollbar">
            {activeTab === 'home' && (
              <HomeView 
                config={config} 
                refreshConfig={fetchConfig} 
                isHardcoreActive={isHardcoreActive}
                onOpenSchedule={() => setShowScheduleModal(true)}
                onOpenFocusRoom={() => setShowFocusRoom(true)}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView 
                config={config} 
                updateConfig={updateConfig} 
                onOpenSchedule={() => setShowScheduleModal(true)}
              />
            )}
            {activeTab === 'password' && (
              <PasswordView config={config} refreshConfig={fetchConfig} />
            )}
          </div>
        </main>

        {/* R3: Mindfulness Typing Test Barrier Modal */}
        <MindfulnessModal
          isOpen={showMindfulness}
          onCancel={() => setShowMindfulness(false)}
          onSuccess={handleMindfulnessSuccess}
        />

        {/* Password Prompt Modal */}
        {showPasswordPrompt && (
          <PasswordPromptModal 
            config={config} 
            onCancel={() => setShowPasswordPrompt(false)} 
            onSuccess={handlePasswordSuccess}
            refreshConfig={fetchConfig}
          />
        )}

        {/* R5: Fiery Penalty System Warning Modal */}
        {showPenaltyWarning && (
          <div className="modal-overlay">
            <div className="modal-content fiery-penalty-modal">
              <button onClick={() => setShowPenaltyWarning(false)} className="modal-close" aria-label="Close">
                <X size={20} />
              </button>
              <div className="modal-icon-box fiery-pulse">
                <Flame size={40} className="icon-fire" />
              </div>
              <h3 className="modal-title fiery-title">
                ⚠️ CẢNH BÁO HÌNH PHẠT KHẮC NGHIỆT!
              </h3>
              <p className="modal-text fiery-text">
                Việc dừng bảo vệ sẽ kích hoạt ngay <strong>Hệ thống Hình phạt</strong> của ứng dụng:
              </p>

              <div className="penalty-consequences-card">
                <div className="penalty-item">
                  <span className="penalty-icon">💥</span>
                  <span className="penalty-desc">
                    <strong>Reset Cấp độ:</strong> Trở về <em>Cấp 1 (Mầm Non Kỷ Luật)</em>
                  </span>
                </div>
                <div className="penalty-item">
                  <span className="penalty-icon">💥</span>
                  <span className="penalty-desc">
                    <strong>Reset Kinh nghiệm:</strong> Xóa sạch toàn bộ số giờ tích lũy về <em>0 giờ (0% XP)</em>
                  </span>
                </div>
                <div className="penalty-item">
                  <span className="penalty-icon">💥</span>
                  <span className="penalty-desc">
                    <strong>Xóa Chuỗi kỷ luật:</strong> Đặt lại <em>Streak về 0 ngày</em>
                  </span>
                </div>
                <div className="penalty-item">
                  <span className="penalty-icon">⚠️</span>
                  <span className="penalty-desc">
                    Ghi nhận thêm <strong>1 lần vi phạm nghiêm trọng</strong> vào lịch sử hệ thống.
                  </span>
                </div>
              </div>

              <div className="modal-btn-group">
                <button 
                  onClick={() => setShowPenaltyWarning(false)} 
                  className="btn-secondary-emerald"
                >
                  <ShieldCheck size={18} />
                  <span>Tôi nghĩ lại rồi, giữ nguyên kỷ luật!</span>
                </button>
                <button 
                  onClick={handleConfirmPenaltyStop}
                  className="btn-danger fiery-btn"
                >
                  <PowerOff size={18} />
                  <span>Chấp nhận hình phạt và Tắt bảo vệ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Penalty Notification Modal (After execution) */}
        {showPenaltyNotice && (
          <div className="modal-overlay">
            <div className="modal-content rose">
              <button onClick={() => setShowPenaltyNotice(false)} className="modal-close" aria-label="Close">
                <X size={20} />
              </button>
              <div className="modal-icon-box rose">
                <AlertOctagon size={36} />
              </div>
              <h3 className="modal-title text-rose">HỆ THỐNG HÌNH PHẠT ĐÃ KÍCH HOẠT</h3>
              <p className="modal-text">
                Toàn bộ Level, XP và Chuỗi ngày của bạn đã bị xóa sổ về 0. Kỷ luật bị phá vỡ, nhưng hành trình mới bắt đầu từ khoảnh khắc này. Hãy đứng dậy và xây dựng lại thói quen vững chắc hơn!
              </p>
              <div className="modal-btn-group">
                <button onClick={() => setShowPenaltyNotice(false)} className="btn-primary">
                  <CheckCircle2 size={18} />
                  <span>Tôi đã hiểu và sẵn sàng làm lại</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* R2: Fixed Schedule Modal */}
        <ScheduleModal
          isOpen={showScheduleModal}
          schedule={scheduleConfig}
          onClose={() => setShowScheduleModal(false)}
          onSave={handleSaveSchedule}
        />

        {/* R4: Focus Room Kiosk Mode Fullscreen View */}
        <FocusRoom
          isOpen={showFocusRoom}
          onExit={() => setShowFocusRoom(false)}
          onSessionComplete={handleFocusSessionComplete}
        />

        {/* Hardcore Modal (Delay 60s fallback) */}
        {showHardcore && (
          <div className="modal-overlay">
            <div className="modal-content rose">
              <button onClick={() => setShowHardcore(false)} className="modal-close" aria-label="Close">
                <X size={20} />
              </button>
              <div className="modal-icon-box rose">
                <Flame size={32} />
              </div>
              <h3 className="modal-title">Cảnh báo Cám dỗ!</h3>
              <p className="modal-text">
                Bạn đang cố gắng tắt hệ thống bảo vệ. Hãy dành một chút thời gian để suy nghĩ xem việc này có thực sự cần thiết hay chỉ là một sự bốc đồng.
              </p>
              <div className="modal-btn-group">
                <button onClick={() => setShowHardcore(false)} className="btn-secondary-emerald">
                  <CheckCircle2 size={18} />
                  <span>Tôi sẽ tiếp tục làm việc!</span>
                </button>
                <button 
                  onClick={() => {
                    if (countdown === 0) {
                      setShowHardcore(false);
                      setShowPenaltyWarning(true);
                    }
                  }}
                  disabled={countdown > 0}
                  className="btn-danger"
                >
                  <PowerOff size={18} />
                  <span>{countdown > 0 ? `Vẫn tắt bảo vệ (${countdown}s)` : 'Xác nhận Tắt bảo vệ'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lock Screen Overlay */}
        {isLockScreen && (
          <div className="lockscreen-overlay">
            <div className="breathing-circle">
              <span className="breathing-text">{lockCountdown}s</span>
            </div>
            <h2 className="lockscreen-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={28} />
              <span>Hãy hít thở thật sâu...</span>
            </h2>
            <p className="lockscreen-desc">Bạn vừa có ý định mở một ứng dụng/trang web không lành mạnh.</p>
          </div>
        )}
      </div>
    </>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`nav-item ${active ? 'active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return "Dưới 1 phút";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface QuotaStatus {
  active: boolean;
  used_seconds: number;
  max_seconds: number;
}

function HomeView({ 
  config, 
  refreshConfig, 
  isHardcoreActive,
  onOpenSchedule,
  onOpenFocusRoom
}: { 
  config: AppConfig, 
  refreshConfig: () => void, 
  isHardcoreActive: boolean,
  onOpenSchedule: () => void,
  onOpenFocusRoom: () => void
}) {
  const [focusTime, setFocusTime] = useState("0m");
  const [quota, setQuota] = useState<QuotaStatus>({ 
    active: false, 
    used_seconds: config.quota_used_seconds, 
    max_seconds: config.daily_quota_minutes * 60 
  });

  const streak = calculateStreak(config.daily_stats || {});
  const scheduleConfig: ScheduleConfig = config.schedule || {
    enabled: config.schedule_enabled ?? false,
    start_time: config.schedule_start ?? "08:00",
    end_time: config.schedule_end ?? "17:00",
    days_of_week: config.schedule_days ?? [1, 2, 3, 4, 5]
  };
  const scheduleStatus = getScheduleStatusInfo(scheduleConfig);

  useEffect(() => {
    if (!config.protection_enabled || !config.protection_started_at) {
      setFocusTime("0m");
      return;
    }
    
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const passed = now - config.protection_started_at!;
      setFocusTime(formatDuration(passed));
    };
    
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [config.protection_enabled, config.protection_started_at]);

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const status = await invoke<QuotaStatus>('get_quota_status');
        setQuota(status);
      } catch (e) {
        // Error handling or mock for browser
      }
    };
    fetchQuota();
    const interval = setInterval(fetchQuota, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStartQuota = async () => {
    try {
      await invoke('start_quota');
    } catch (e: any) {
      alert(e);
    }
  };

  const handlePauseQuota = async () => {
    try {
      await invoke('pause_quota');
    } catch (e) {}
  };

  const handleHardcore = async (hours: number) => {
    try {
      await invoke('set_hardcore_mode', { hours });
      alert(`Đã bật Chế độ Tử thủ trong ${hours} giờ!`);
      refreshConfig();
    } catch (e: any) {
      alert(e);
    }
  };

  const remaining = Math.max(0, quota.max_seconds - quota.used_seconds);
  const outOfTime = quota.used_seconds >= quota.max_seconds;

  const rH = Math.floor(remaining / 3600);
  const rM = Math.floor((remaining % 3600) / 60);
  const rS = remaining % 60;
  const timeString = `${rH > 0 ? String(rH).padStart(2, '0') + ':' : ''}${String(rM).padStart(2, '0')}:${String(rS).padStart(2, '0')}`;

  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, -1);
    const dateStr = localISOTime.split('T')[0];
    
    const mins = config.daily_stats?.[dateStr] || 0;
    chartData.push({ name: `${d.getDate()}/${d.getMonth()+1}`, mins });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Live Schedule Banner Card */}
      {scheduleConfig.enabled && (
        <div className={`schedule-live-card ${scheduleStatus.badgeClass}`}>
          <div className="schedule-live-content">
            <div className="status-pulse-dot" />
            <div>
              <div className="schedule-live-title">
                {scheduleStatus.isActive ? "🟢 ĐANG TRONG KHUNG GIỜ LÀM VIỆC" : "🌙 NGOÀI KHUNG GIỜ LÀM VIỆC"}
              </div>
              <div className="schedule-live-desc">
                {scheduleStatus.isActive 
                  ? "Tự động kích hoạt Hosts chặn Web & DNS Cloudflare Family."
                  : `Lịch trình tự động: ${scheduleConfig.start_time} - ${scheduleConfig.end_time}.`}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onOpenSchedule} 
            className="btn-schedule-settings"
          >
            <Clock size={16} />
            <span>Chỉnh lịch</span>
          </button>
        </div>
      )}

      {/* Quota UI */}
      <div className={`quota-card ${outOfTime ? 'expired' : ''}`}>
        <h3 className="quota-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Timer size={22} className="icon-indigo" />
          <span>Hạn mức giải trí hôm nay</span>
        </h3>
        <div className={`quota-clock ${outOfTime ? 'text-rose' : (quota.active ? 'text-emerald' : 'text-slate')}`}>
          {timeString}
        </div>
        {outOfTime ? (
          <div className="quota-msg" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={18} />
            <span>Hẹn gặp lại vào ngày mai!</span>
          </div>
        ) : (
          <div className="quota-actions">
            {!quota.active ? (
              <button className="btn-quota start" onClick={handleStartQuota}>
                <Play size={18} />
                <span>Bắt đầu giải trí</span>
              </button>
            ) : (
              <button 
                className={`btn-quota pause ${isHardcoreActive ? 'disabled' : ''}`} 
                onClick={handlePauseQuota}
                disabled={isHardcoreActive}
              >
                {isHardcoreActive ? <Lock size={18} /> : <Pause size={18} />}
                <span>{isHardcoreActive ? 'Không thể tạm dừng' : 'Tạm dừng'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Focus Room Banner Callout */}
      <div className="focus-room-callout">
        <div className="focus-callout-info">
          <div className="focus-callout-title">
            <Sparkles size={20} className="icon-cyan" />
            <span>Không gian Tĩnh tâm (Focus Room)</span>
          </div>
          <p className="focus-callout-desc">
            Chế độ toàn màn hình chuyên biệt loại bỏ mọi xao nhãng, kích hoạt Low-level Hook chặn Alt+Tab và Windows Key.
          </p>
        </div>
        <button 
          type="button" 
          onClick={onOpenFocusRoom} 
          className="btn-callout-focus"
        >
          <Maximize2 size={16} />
          <span>Vào Phòng Tĩnh tâm</span>
        </button>
      </div>

      {!isHardcoreActive && (
        <div className="quota-card" style={{ background: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)' }}>
          <h3 className="quota-title" style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={22} />
            <span>Kích hoạt Chế độ Tử thủ</span>
          </h3>
          <div className="quota-msg" style={{ marginBottom: '1rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} className="text-rose" />
            <span>Không thể tắt bảo vệ hoặc dùng nút tạm dừng trong thời gian này.</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => handleHardcore(1)} className="btn-danger" style={{ padding: '0.5rem 1.25rem', width: 'auto' }}>
              <Flame size={16} />
              <span>1 Giờ</span>
            </button>
            <button onClick={() => handleHardcore(2)} className="btn-danger" style={{ padding: '0.5rem 1.25rem', width: 'auto' }}>
              <Flame size={16} />
              <span>2 Giờ</span>
            </button>
            <button onClick={() => handleHardcore(4)} className="btn-danger" style={{ padding: '0.5rem 1.25rem', width: 'auto' }}>
              <Flame size={16} />
              <span>4 Giờ</span>
            </button>
          </div>
        </div>
      )}

      {/* Gamification Glow Badge & Dynamic Animated Progress Bar */}
      <GamificationCard totalHours={config.total_focus_hours || 0} streakDays={streak} />

      {/* R1: Discipline Heatmap (GitHub-style 20 weeks) */}
      <DisciplineHeatmap
        dailyStats={config.daily_stats}
        dailyHistory={config.daily_history}
        currentStreak={streak}
      />

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <StatCard 
          title="Thời gian tập trung" 
          icon={<Hourglass size={18} className="icon-indigo" />} 
          value={focusTime} 
          trend={config.protection_enabled ? "Đang đếm" : "Tạm dừng"} 
          positive={config.protection_enabled} 
        />
        <StatCard 
          title="Vi phạm" 
          icon={<AlertOctagon size={18} className="text-rose" />} 
          value={config.violations_count?.toString() || "0"} 
          trend="Số lần" 
          positive={config.violations_count === 0} 
        />
      </div>

      <div style={{ height: 300, background: 'rgba(30, 41, 59, 0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
        <h3 style={{ marginBottom: '1rem', color: '#f8fafc', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} className="icon-indigo" />
          <span>Thống kê 7 ngày gần nhất (Phút)</span>
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#818cf8' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="mins" fill="#818cf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ title, icon, value, trend, positive }: { title: string, icon?: React.ReactNode, value: string, trend: string, positive?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon}
        <span>{title}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className={`stat-trend ${positive ? 'positive' : 'neutral'}`}>
        {trend}
      </div>
    </div>
  );
}

function SettingsView({ 
  config, 
  updateConfig, 
  onOpenSchedule 
}: { 
  config: AppConfig, 
  updateConfig: (p: Partial<AppConfig>) => void,
  onOpenSchedule: () => void 
}) {
  const handleAutostartChange = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      updateConfig({ start_with_windows: checked });
    } catch (e) {
      console.error("Autostart plugin error:", e);
    }
  };

  const scheduleConfig: ScheduleConfig = config.schedule || {
    enabled: config.schedule_enabled ?? false,
    start_time: config.schedule_start ?? "08:00",
    end_time: config.schedule_end ?? "17:00",
    days_of_week: config.schedule_days ?? [1, 2, 3, 4, 5]
  };

  return (
    <div className="settings-container">
      {/* R2: Fixed Schedule Setting Section */}
      <section>
        <h3 className="settings-section-title">
          <Clock size={20} className="icon-cyan" />
          <span>Lập lịch Bảo vệ Cố định</span>
        </h3>
        <div className="settings-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                Tự động kích hoạt Chặn Web & DNS trong giờ làm việc
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                {scheduleConfig.enabled 
                  ? `Đang bật: ${scheduleConfig.start_time} - ${scheduleConfig.end_time} (${scheduleConfig.days_of_week.length} ngày/tuần)`
                  : 'Chưa kích hoạt lập lịch tự động'}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSchedule}
              className="btn-primary-cyan"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              <Sliders size={16} />
              <span>Cấu hình Lịch</span>
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="settings-section-title">
          <Clock size={20} className="icon-indigo" />
          <span>Hạn mức thời gian (Daily Quota)</span>
        </h3>
        <div className="settings-box">
          <label className="checkbox-label" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="checkbox-text" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={16} />
              <span>Tổng thời gian giải trí mỗi ngày: {config.daily_quota_minutes} phút</span>
            </span>
            <input 
              type="range" 
              min="10" 
              max="240" 
              step="10"
              value={config.daily_quota_minutes}
              onChange={(e) => updateConfig({ daily_quota_minutes: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="settings-section-title">
          <Globe size={20} className="icon-indigo" />
          <span>Danh sách website bị chặn</span>
        </h3>
        <textarea 
          className="settings-textarea custom-scrollbar"
          value={config.blocked_domains.join("\n")}
          onChange={(e) => {
            const domains = e.target.value.split("\n").map(d => d.trim()).filter(d => d.length > 0);
            updateConfig({ blocked_domains: domains });
          }}
          placeholder="Mỗi dòng một trang web..."
        />
        <div className="settings-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} />
          <span>Can thiệp trực tiếp vào file Hosts hệ thống Windows.</span>
        </div>
      </section>

      <section>
        <h3 className="settings-section-title rose">
          <ShieldAlert size={20} />
          <span>Chống Nghiện 18+ Tối Cao</span>
        </h3>
        <div className="settings-box rose-box">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={config.block_nsfw}
              onChange={(e) => updateConfig({ block_nsfw: e.target.checked })}
              className="checkbox-input rose"
            />
            <span className="checkbox-text rose-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={16} />
              <span>Kích hoạt Bảo vệ Cấp Hệ điều hành</span>
            </span>
          </label>
          <p className="rose-hint" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Zap size={14} style={{ marginTop: '3px', flexShrink: 0 }} />
            <span>Tính năng này sẽ ép đổi DNS mạng sang Cloudflare Family và tự động đóng sập (Kill) bất kỳ ứng dụng nào nếu bạn cố tình mở các từ khóa nhạy cảm.</span>
          </p>
        </div>
      </section>

      <section>
        <h3 className="settings-section-title">
          <Settings size={20} className="icon-indigo" />
          <span>Tùy chỉnh Nâng cao Hệ thống</span>
        </h3>
        <div className="settings-box">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={config.start_with_windows}
              onChange={(e) => handleAutostartChange(e.target.checked)}
              className="checkbox-input indigo"
            />
            <span className="checkbox-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} />
              <span>Khởi động cùng Windows (chạy ngầm dưới System Tray)</span>
            </span>
          </label>
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={config.change_delay_enabled}
              onChange={(e) => updateConfig({ change_delay_enabled: e.target.checked })}
              className="checkbox-input indigo"
            />
            <span className="checkbox-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Hourglass size={16} />
              <span>Kích hoạt Chống Hối Hận (Khóa nút Tắt bảo vệ trong 60 giây)</span>
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}

function PasswordView({ config, refreshConfig }: { config: AppConfig, refreshConfig: () => void }) {
  const [oldPwd, setOldPwd] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setMsg("");
    
    if (config.password_hash) {
      if (!oldPwd) {
        setError("Vui lòng nhập mật khẩu cũ!");
        return;
      }
      try {
        const ok = await invoke<boolean>("verify_password", { password: oldPwd });
        if (!ok) {
          setError("Mật khẩu cũ không chính xác!");
          return;
        }
      } catch (e) {
        console.warn("Mocking old password verification");
      }
    }

    if (pwd !== confirm) {
      setError("Mật khẩu mới không khớp!");
      return;
    }
    
    try {
      await invoke("set_password", { password: pwd.length > 0 ? pwd : null });
    } catch (e) {
      console.warn("Mocking set_password for browser");
    }
    setMsg(pwd.length > 0 ? "Đã lưu mật khẩu mới." : "Đã gỡ bỏ mật khẩu.");
    setOldPwd("");
    setPwd("");
    setConfirm("");
    refreshConfig();
  };

  return (
    <div className="password-container">
      <div className="password-header">
        <div className="password-icon-box">
          <KeyRound size={32} />
        </div>
        <h3 className="password-title">
          {config.password_hash ? "Cập nhật Mật khẩu" : "Thiết lập Mật khẩu"}
        </h3>
        <p className="password-subtitle">Ngăn chặn bản thân tự ý tắt phần mềm. Để trống mật khẩu mới nếu muốn gỡ bảo vệ.</p>
      </div>

      <div className="password-form">
        {msg && <div className="msg-success">{msg}</div>}
        {error && <div className="msg-error">{error}</div>}
        
        {config.password_hash && (
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} />
              <span>Mật khẩu hiện tại</span>
            </label>
            <input 
              type="password" 
              value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} />
            <span>Mật khẩu mới {config.password_hash && "(Để trống để xóa)"}</span>
          </label>
          <input 
            type="password" 
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            className="form-input"
            placeholder="••••••••"
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} />
            <span>Xác nhận mật khẩu mới</span>
          </label>
          <input 
            type="password" 
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="form-input"
            placeholder="••••••••"
          />
        </div>
        <button 
          onClick={handleSave}
          className="btn-primary"
        >
          <ShieldCheck size={18} />
          <span>{config.password_hash ? "Xác nhận Đổi/Xóa Mật khẩu" : "Khóa phần mềm"}</span>
        </button>
      </div>
    </div>
  );
}

function PasswordPromptModal({ config, onCancel, onSuccess, refreshConfig }: any) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!config.unlock_requested_at) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const passed = now - config.unlock_requested_at;
      const left = SEVEN_DAYS_SEC - passed;
      if (left <= 0) {
        setTimeLeft("Đã hết thời gian chờ, bạn có thể tắt bảo vệ!");
      } else {
        const d = Math.floor(left / 86400);
        const h = Math.floor((left % 86400) / 3600);
        const m = Math.floor((left % 3600) / 60);
        const s = left % 60;
        setTimeLeft(`Còn lại: ${d}d ${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [config.unlock_requested_at]);

  const handleVerify = async () => {
    try {
      const ok = await invoke<boolean>("verify_password", { password: pwd });
      if (ok) {
        onSuccess();
      } else {
        setError("Mật khẩu không chính xác!");
      }
    } catch (e) {
      console.warn("Mocking password verification for browser");
      onSuccess();
    }
  };

  const handleRequestUnlock = async () => {
    try {
      await invoke("request_unlock");
    } catch (e) {
      console.warn("Mocking request_unlock for browser");
    }
    refreshConfig();
  };

  const canBypass = config.unlock_requested_at && (Math.floor(Date.now() / 1000) - config.unlock_requested_at >= SEVEN_DAYS_SEC);

  return (
    <div className="modal-overlay">
      <div className="modal-content indigo">
        <button onClick={onCancel} className="modal-close" aria-label="Close">
          <X size={20} />
        </button>
        <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={20} className="icon-indigo" />
          <span>Nhập mật khẩu để tiếp tục</span>
        </h3>
        <input 
          type="password" 
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          className="form-input"
          style={{ marginBottom: '1rem' }}
          placeholder="Mật khẩu của bạn..."
        />
        {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        
        <button 
          onClick={handleVerify}
          className="btn-primary"
          style={{ marginTop: 0, marginBottom: '1rem' }}
        >
          <CheckCircle2 size={18} />
          <span>Xác nhận</span>
        </button>

        <div className="modal-footer">
          {!config.unlock_requested_at ? (
            <button onClick={handleRequestUnlock} className="btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={14} />
              <span>Quên mật khẩu? Xin mở khóa (Chờ 7 ngày)</span>
            </button>
          ) : (
            <div>
              <div className="time-left-text">{timeLeft}</div>
              {canBypass && (
                <button onClick={onSuccess} className="btn-danger-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Unlock size={16} />
                  <span>Bỏ qua mật khẩu (Đã đủ 7 ngày)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TitleBar() {
  return (
    <div data-tauri-drag-region="true" className="titlebar">
      <div className="titlebar-title" data-tauri-drag-region="true" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Shield size={14} className="icon-indigo" />
        <span>CaiNghiện</span>
      </div>
      <div className="titlebar-buttons" data-tauri-drag-region="false">
        <button type="button" aria-label="Minimize" className="titlebar-button" data-tauri-drag-region="false" onClick={() => getCurrentWindow().minimize()}>
          <Minus size={14} />
        </button>
        <button type="button" aria-label="Maximize" className="titlebar-button" data-tauri-drag-region="false" onClick={() => getCurrentWindow().toggleMaximize()}>
          <Square size={12} />
        </button>
        <button type="button" aria-label="Close" className="titlebar-button titlebar-close" data-tauri-drag-region="false" onClick={() => getCurrentWindow().close()}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
