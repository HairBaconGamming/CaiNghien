import { exit } from '@tauri-apps/plugin-process';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Titlebar } from './components/layout/Titlebar';
import { Navbar, NavTabId } from './components/layout/Navbar';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { FocusRoomScreen } from './components/focus/FocusRoomScreen';
import { TypingChallengeScreen } from './components/typing/TypingChallengeScreen';
import {
  Settings as SettingsIcon,
  Shield,
  Cpu,
  Sparkles,
  RefreshCw,
  Lock,
  GraduationCap
, Power } from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { api, UserProfile, onTelemetryUpdate, notifyTelemetryUpdate, AppConfig } from './services/api';
import { Toast, ToastType } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { AccountScreen } from './components/AccountScreen';


export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'general' | 'account'>('general');
  const [showTypingModal, setShowTypingModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [blockedDomainsInput, setBlockedDomainsInput] = useState('');
  const [studyMinutesInput, setStudyMinutesInput] = useState<number | string>(60);
  const [rewardQuotaInput, setRewardQuotaInput] = useState<number | string>(15);
  const [toasts, setToasts] = useState<{id: string, type: ToastType, message: string}[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

  const isRatioValid = useMemo(() => {
    const req = Number(studyMinutesInput);
    const reward = Number(rewardQuotaInput);
    return Number.isInteger(req) && req >= 1 && Number.isInteger(reward) && reward >= 1;
  }, [studyMinutesInput, rewardQuotaInput]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const c = await api.getAppConfig();
      if (c) {
        setAppConfig(c);
        setBlockedDomainsInput(c.blocked_domains.join('\n'));
        setStudyMinutesInput(c.study_minutes_required ?? 60);
        setRewardQuotaInput(c.reward_quota_minutes ?? 15);
      }
    } catch (e) {
      console.warn('Failed to load app config:', e);
    }
  }, []);

  const updateConfig = async (updates: Partial<AppConfig>) => {
    if (!appConfig) return;
    const newConfig = { ...appConfig, ...updates };
    setAppConfig(newConfig);
    try {
      await api.saveAppConfig(newConfig);
      refreshConfig();
    } catch (e) {
      console.error('Failed to save config:', e);
      addToast('error', 'Lưu cài đặt thất bại: ' + e);
      refreshConfig();
    }
  };

  const handleSaveStudyRatio = () => {
    const req = Number(studyMinutesInput);
    const reward = Number(rewardQuotaInput);
    if (!isRatioValid) {
      addToast('error', 'Thời gian học yêu cầu và thưởng Quota phải là số nguyên dương lớn hơn 0');
      return;
    }
    updateConfig({
      study_minutes_required: req,
      reward_quota_minutes: reward,
    });
    addToast('success', 'Đã lưu cấu hình Study-to-Earn thành công!');
  };

  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.getUserProfile();
      if (p) {
        setUserProfile(p);
      }
    } catch (e) {
      console.warn('Failed to load user profile in App:', e);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
    refreshConfig();
  }, [refreshProfile, refreshConfig]);

  useEffect(() => {
    const unsubscribe = onTelemetryUpdate(() => {
      refreshProfile();
      setDashboardRefreshTrigger((prev) => prev + 1);
    });

    const handleFocus = () => {
      refreshProfile();
      setDashboardRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshProfile]);

  const handleSelectTab = (tab: NavTabId) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      refreshProfile();
      setDashboardRefreshTrigger((prev) => prev + 1);
    }
  };

  const [updateObj, setUpdateObj] = useState<any>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notifications, setNotifications] = useState<import('./components/layout/Navbar').Notification[]>([
    {
      id: 'welcome',
      title: 'Chào mừng trở lại',
      message: 'Hệ thống đã sẵn sàng bảo vệ sự tập trung của bạn.',
      read: false,
      timestamp: 'Vừa xong'
    }
  ]);
  
  const handleMarkNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  
  // Settings Protection
  const [settingsLocked, setSettingsLocked] = useState(true);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsLocked(true);
      setShowUnlockModal(false);
    }
  }, [activeTab]);

  useEffect(() => {
    check().then((update) => {
      if (update) {
        setUpdateObj(update);
      }
    }).catch(console.error);
  }, []);


  const handleSaveDomains = () => {
    const domains = blockedDomainsInput.split('\n').map(d => d.trim()).filter(d => d.length > 0);
    updateConfig({ blocked_domains: domains });
    addToast('success', 'Đã lưu cài đặt website!');
  };

  const handleManualCheck = async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await check();
      if (update) {
        setUpdateObj(update);
      } else {
        addToast('info', "Hệ thống đã được cập nhật phiên bản mới nhất.");
      }
    } catch (e) {
      console.error(e);
      addToast('error', "Kho lưu trữ Private - Vui lòng tải app trực tiếp trên Web.");
    }
    setIsCheckingUpdate(false);
  };

  // Generate fixed random starfield coordinates
  const stars = useMemo(() => {
    const starList = [];
    for (let i = 0; i < 90; i++) {
      const top = Math.floor(Math.sin(i * 997) * 50 + 50);
      const left = Math.floor(Math.cos(i * 733) * 50 + 50);
      const size = (i % 3 === 0 ? 2.5 : i % 2 === 0 ? 1.5 : 1);
      const opacity = ((i % 5) + 3) / 10;
      const animDelay = (i % 7) * 0.7;
      starList.push({ id: i, top, left, size, opacity, animDelay });
    }
    return starList;
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden select-none bg-[#030712] text-white flex flex-col relative font-sans">
      {/* Cosmos Custom Titlebar with Drag and Window Controls */}
      <Titlebar />

      {/* Cosmos Background Canvas */}
      <div className="cosmos-canvas">
        {/* Starfield */}
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white transition-opacity"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: star.size > 2 ? '0 0 6px rgba(255, 255, 255, 0.8)' : undefined,
              animation: `pulseGlow ${2 + (star.id % 4)}s ease-in-out infinite`,
              animationDelay: `${star.animDelay}s`,
            }}
          />
        ))}

        {/* Ambient Nebula Glow Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-fuchsia-600/20 via-purple-600/10 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-cyan-500/15 via-sky-600/10 to-transparent blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-[28rem] h-[28rem] rounded-full bg-gradient-to-tl from-violet-600/20 via-indigo-600/10 to-transparent blur-[130px] pointer-events-none" />
      </div>

      {/* Main Glass Shell Container */}
      <div className="relative z-10 flex flex-col w-full h-full overflow-hidden">
        {/* Cosmos Top Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          userLevel={userProfile?.level}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
        />

        {/* Active Workspace Viewport */}
        <main className="flex-1 overflow-hidden relative p-4 md:p-6 flex flex-col items-center justify-center">
          <div className="w-full h-full max-w-[1560px] mx-auto flex flex-col">
            {activeTab === 'dashboard' && (
              <DashboardScreen refreshTrigger={dashboardRefreshTrigger} />
            )}

            {activeTab === 'focus' && (
              <FocusRoomScreen
                onExit={() => handleSelectTab('dashboard')}
                onSessionComplete={() => {
                  refreshProfile();
                  notifyTelemetryUpdate();
                }}
              />
            )}

            {activeTab === 'typing' && (
              <TypingChallengeScreen
                onClose={() => handleSelectTab('dashboard')}
                onComplete={() => {
                  refreshProfile();
                  notifyTelemetryUpdate();
                  handleSelectTab('dashboard');
                }}
              />
            )}




            {activeTab === 'settings' && appConfig && (
              <div className="w-full h-full flex overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-64 border-r border-white/10 p-6 flex flex-col gap-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Cài đặt</div>
                  
                  <button 
                    onClick={() => setSettingsTab('general')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      settingsTab === 'general' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    Cài đặt chung
                  </button>
                  
                  <button 
                    onClick={() => setSettingsTab('account')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      settingsTab === 'account' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    Tài khoản & Hồ sơ
                  </button>
                </div>
                
                {/* Main Content */}
                <div className="flex-1 overflow-y-auto">
                  {settingsTab === 'general' && (
                    <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SettingsIcon className="w-6 h-6 text-sky-400" />
                    <div>
                      <h2 className="text-xl font-bold text-white">Cài đặt Focus Guard & Cosmos</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Định cấu hình kỷ luật, mật khẩu bảo vệ và giao diện.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-white/10">
                    <span className="text-sm font-bold text-white">Bảo vệ chính</span>
                    <input 
                      type="checkbox" 
                      checked={appConfig.protection_enabled} 
                      onChange={(e) => updateConfig({ protection_enabled: e.target.checked })}
                      className="toggle-checkbox accent-cyan-400 w-6 h-6 cursor-pointer" 
                      disabled={settingsLocked} 
                    />
                  </div>
                </div>

                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                  {settingsLocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#030712]/80 backdrop-blur-sm rounded-2xl border border-white/10">
                      <Shield className="w-12 h-12 text-cyan-400 mb-4 animate-pulse" />
                      <h3 className="text-white font-bold text-xl mb-2">Đã bật bảo vệ</h3>
                      <p className="text-slate-300 text-sm mb-6 text-center max-w-sm">
                        Focus Guard đang hoạt động. Cài đặt và mật khẩu đã bị khóa. Hoàn thành thử thách để mở khóa.
                      </p>
                      <button
                        onClick={() => setShowUnlockModal(true)}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm tracking-wider uppercase text-white flex items-center gap-2 bg-gradient-to-r from-cyan-500/40 to-sky-500/30 border border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.45)] hover:shadow-[0_0_25px_rgba(0,240,255,0.7)] transition-all cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-cyan-300" />
                        <span>Gõ để mở khóa</span>
                      </button>
                    </div>
                  )}

                  {/* Password Protection Box */}
                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Lock className="w-5 h-5 text-fuchsia-400" />
                      <h3 className="text-base font-bold text-white">Mật khẩu & Bảo mật</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <div>
                           <p className="text-sm font-semibold text-slate-200">Mật khẩu app {appConfig.password_hash ? 'Đã đặt' : 'Chưa đặt'}</p>
                           <p className="text-xs text-slate-400">Áp đặt rào cản thoát nghiêm ngặt</p>
                         </div>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <button
                          disabled={settingsLocked}
                          onClick={() => {
                            const newPwd = prompt("Nhập mật khẩu mới (để trống để xóa):");
                            if (newPwd !== null) {
                               import('@tauri-apps/api/core').then(({ invoke }) => {
                                  invoke('set_password', { password: newPwd || null })
                                    .then(() => addToast('success', 'Đã cập nhật mật khẩu'))
                                    .catch(e => addToast('error', e as string));
                               });
                            }
                          }}
                          className="w-full py-2 rounded-lg border border-fuchsia-500/30 text-xs font-bold uppercase tracking-wider text-fuchsia-300 hover:bg-fuchsia-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Đổi mật khẩu
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-base font-bold text-white">Thực thi kỷ luật</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Tên miền bị chặn</p>
                          <p className="text-xs text-slate-400 mb-2">Mỗi tên miền một dòng</p>
                        </div>
                        <textarea 
                          value={blockedDomainsInput}
                          onChange={(e) => setBlockedDomainsInput(e.target.value)}
                          disabled={settingsLocked}
                          className="w-full h-24 bg-slate-900/50 border border-white/10 rounded-lg p-2 text-sm text-white resize-none"
                        />
                        <button 
                           disabled={settingsLocked}
                           onClick={handleSaveDomains}
                           className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                           Lưu tên miền
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Study-to-Earn Conversion Ratio Settings Card */}
                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                      <h3 className="text-base font-bold text-white">Quy đổi Study-to-Earn (Học để kiếm giờ chơi)</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-400">
                          Học tập trung và nộp bài thu hoạch để nhận thời gian giải trí tự do vào Quota hàng ngày.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                            Thời gian học yêu cầu (phút)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={studyMinutesInput}
                            onChange={(e) => setStudyMinutesInput(e.target.value)}
                            disabled={settingsLocked}
                            placeholder="60"
                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                            Thời gian thưởng Quota (phút)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={rewardQuotaInput}
                            onChange={(e) => setRewardQuotaInput(e.target.value)}
                            disabled={settingsLocked}
                            placeholder="15"
                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      {/* Real-time conversion preview summary & validation */}
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        {isRatioValid ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">Quy đổi:</span>
                            <span className="font-bold text-amber-300 font-mono">
                              Học {studyMinutesInput} phút = Nhận {rewardQuotaInput} phút chơi
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-rose-400 font-medium">
                            ⚠️ Thời gian học yêu cầu và thưởng Quota phải là số nguyên dương lớn hơn hoặc bằng 1.
                          </p>
                        )}
                      </div>

                      <button
                        disabled={settingsLocked || !isRatioValid}
                        onClick={handleSaveStudyRatio}
                        className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      >
                        Lưu tỷ lệ quy đổi
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-5 h-5 text-purple-400" />
                      <h3 className="text-base font-bold text-white">Hệ thống & Khởi động</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Khởi động cùng window</p>
                          <p className="text-xs text-slate-400">Chạy CaiNghien ngầm khi khởi động hệ thống</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={appConfig.start_with_windows} 
                          onChange={(e) => updateConfig({ start_with_windows: e.target.checked })}
                          className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" 
                          disabled={settingsLocked}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Chặn nội dung NSFW</p>
                          <p className="text-xs text-slate-400">Tự động chặn nội dung người lớn</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={appConfig.block_nsfw} 
                          onChange={(e) => updateConfig({ block_nsfw: e.target.checked })}
                          className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" 
                          disabled={settingsLocked}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Độ trễ khóa cài đặt</p>
                          <p className="text-xs text-slate-400">Áp đặt độ trễ khi tắt bảo vệ</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={appConfig.change_delay_enabled} 
                          onChange={(e) => updateConfig({ change_delay_enabled: e.target.checked })}
                          className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" 
                          disabled={settingsLocked}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <RefreshCw className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">Cập nhật hệ thống</h3>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Cập nhật phần mềm</p>
                          <p className="text-xs text-slate-400">Kiểm tra tính năng mới nhất</p>
                        </div>
                        <button
                          onClick={handleManualCheck}
                          disabled={isCheckingUpdate || settingsLocked}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-emerald-600/80 hover:bg-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {isCheckingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="glass-panel rounded-2xl p-6 border border-red-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-5 h-5 text-red-400" />
                      <h3 className="text-base font-bold text-white">Xóa dữ liệu (Reset Data)</h3>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Xóa toàn bộ dữ liệu</p>
                          <p className="text-xs text-slate-400">Xóa lịch sử tập trung, thành tích và đưa tài khoản về cấp độ 1</p>
                        </div>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              title: 'Xóa toàn bộ dữ liệu',
                              message: 'Bạn có chắc chắn muốn xóa toàn bộ dữ liệu? Thao tác này không thể hoàn tác.',
                              onConfirm: async () => {
                                try {
                                  await api.resetAllData();
                                  addToast('success', 'Đã xóa dữ liệu thành công!');
                                  setConfirmDialog(null);
                                  setTimeout(() => window.location.reload(), 1500);
                                } catch (e) {
                                  addToast('error', 'Lỗi: ' + e);
                                  setConfirmDialog(null);
                                }
                              }
                            });
                          }}
                          disabled={settingsLocked}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-red-600/80 hover:bg-red-500 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          Xóa dữ liệu
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-6 border border-red-500/30 mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Power className="w-5 h-5 text-red-400" />
                        <h3 className="text-base font-bold text-white">Tắt ứng dụng</h3>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">Tắt hoàn toàn Focus Guard</p>
                            <p className="text-xs text-slate-400">Đóng ứng dụng và dừng mọi tiến trình bảo vệ ngầm</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await exit(0);
                              } catch(e) {
                                console.error(e);
                              }
                            }}
                            disabled={settingsLocked}
                            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-red-600/80 hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Tắt Ứng Dụng
                          </button>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
                  )}
                  
                  {settingsTab === 'account' && (
                    <div className="p-6">
                      <AccountScreen addToast={addToast} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Modal Overlay for Typing Challenge (when invoked outside direct tab) */}
      {showTypingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl">
            <TypingChallengeScreen
              asModal
              onClose={() => setShowTypingModal(false)}
              onComplete={() => {
                setShowTypingModal(false);
                refreshProfile();
                notifyTelemetryUpdate();
              }}
            />
          </div>
        </div>
      )}

      {/* Unlock Settings Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl">
            <TypingChallengeScreen
              asModal
              customText="Tôi cam kết chịu trách nhiệm với bản thân, kỷ luật để vượt qua cám dỗ. Việc gỡ bỏ rào cản lúc này có thể phá hủy mọi nỗ lực. Tôi chọn sự tự do thực sự chứ không phải khoái cảm nhất thời."
              onClose={() => setShowUnlockModal(false)}
              onComplete={() => {
                setSettingsLocked(false);
                setShowUnlockModal(false);
                refreshProfile();
                notifyTelemetryUpdate();
              }}
            />
          </div>
        </div>
      )}

      {/* Update Modal */}
      {updateObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Bản cập nhật Cosmic có sẵn
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              Phiên bản {updateObj.version} đã sẵn sàng để cài đặt.
            </p>
            {updateObj.body && (
              <div className="bg-slate-900/50 rounded-lg p-3 mb-6 border border-white/5 max-h-32 overflow-y-auto text-xs text-slate-400 whitespace-pre-wrap">
                {updateObj.body}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setUpdateObj(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                disabled={isUpdating}
              >
                Để sau
              </button>
              <button
                onClick={async () => {
                  setIsUpdating(true);
                  try {
                    await updateObj.downloadAndInstall();
                    await relaunch();
                  } catch (e) {
                    console.error(e);
                    addToast('error', "Cài đặt bản cập nhật thất bại.");
                  }
                  setIsUpdating(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-2 cursor-pointer"
                disabled={isUpdating}
              >
                {isUpdating ? 'Đang cài đặt...' : 'Cài đặt & Khởi động lại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} id={t.id} type={t.type} message={t.message} onClose={removeToast} />
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
