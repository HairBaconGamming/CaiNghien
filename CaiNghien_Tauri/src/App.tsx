import { useState, useEffect } from 'react';
import { Shield, Settings, Lock, Power, AlertTriangle, X, Key } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';
import { enable, disable } from '@tauri-apps/plugin-autostart';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AppConfig {
  protection_enabled: boolean;
  blocked_domains: string[];
  password_hash: string | null;
  unlock_requested_at: number | null;
  start_with_windows: boolean;
  change_delay_enabled: boolean;
  block_nsfw: boolean;
}

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  const [showHardcore, setShowHardcore] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const fetchConfig = () => {
    invoke<AppConfig>('get_app_config')
      .then((data) => setConfig(data))
      .catch(console.error);
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

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="animate-pulse flex items-center gap-2">
          <Shield className="w-5 h-5" /> Đang tải cấu hình hệ thống...
        </div>
      </div>
    );
  }

  const isGuarding = config.protection_enabled;

  const updateConfig = (partial: Partial<AppConfig>) => {
    const newConfig = { ...config, ...partial };
    setConfig(newConfig);
    invoke('save_app_config', { newConfig }).catch(console.error);
  };

  const handleToggleGuard = () => {
    if (isGuarding) {
      if (config.password_hash) {
        setShowPasswordPrompt(true);
      } else if (config.change_delay_enabled) {
        setShowHardcore(true);
      } else {
        updateConfig({ protection_enabled: false });
      }
    } else {
      updateConfig({ protection_enabled: true });
    }
  };

  const handlePasswordSuccess = () => {
    setShowPasswordPrompt(false);
    if (config.change_delay_enabled) {
      setShowHardcore(true);
    } else {
      updateConfig({ protection_enabled: false });
    }
  };

  const handleConfirmHardcoreStop = () => {
    if (countdown === 0) {
      setShowHardcore(false);
      updateConfig({ protection_enabled: false });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex overflow-hidden font-sans selection:bg-indigo-500/30">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/20 blur-[120px] pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-xl z-10 p-4">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            CaiNghiện
          </h1>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Shield size={20} />} label="Bảng điều khiển" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Cài đặt" />
          <NavItem active={activeTab === 'password'} onClick={() => setActiveTab('password')} icon={<Lock size={20} />} label="Mật khẩu" />
        </nav>

        <div className="mt-auto">
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
            <div className="text-sm text-slate-400 mb-2">Trạng thái</div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isGuarding ? "bg-emerald-400" : "bg-rose-400", isGuarding && "animate-pulse")} />
              <span className="font-medium text-slate-200">{isGuarding ? 'Đang bảo vệ' : 'Tạm dừng'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 z-10 relative flex flex-col h-screen">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <h2 className="text-2xl font-semibold">
            {activeTab === 'home' && 'Bảng điều khiển'}
            {activeTab === 'settings' && 'Cài đặt'}
            {activeTab === 'password' && 'Bảo mật'}
          </h2>
          
          <button 
            onClick={handleToggleGuard}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-lg cursor-pointer",
              isGuarding 
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-rose-500/10" 
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:shadow-emerald-500/10"
            )}
          >
            <Power size={18} />
            {isGuarding ? 'Dừng bảo vệ' : 'Bật bảo vệ'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-xl p-6 shadow-2xl custom-scrollbar">
          {activeTab === 'home' && <HomeView />}
          {activeTab === 'settings' && <SettingsView config={config} updateConfig={updateConfig} />}
          {activeTab === 'password' && <PasswordView config={config} refreshConfig={fetchConfig} />}
        </div>
      </main>

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <PasswordPromptModal 
          config={config} 
          onCancel={() => setShowPasswordPrompt(false)} 
          onSuccess={handlePasswordSuccess}
          refreshConfig={fetchConfig}
        />
      )}

      {/* Hardcore Modal */}
      {showHardcore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-rose-500/10 relative">
            <button onClick={() => setShowHardcore(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 cursor-pointer">
              <X size={24} />
            </button>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                <AlertTriangle size={32} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-slate-100 mb-2">Cảnh báo Cám dỗ!</h3>
            <p className="text-center text-slate-400 mb-8 leading-relaxed">
              Bạn đang cố gắng tắt hệ thống bảo vệ. Hãy dành một chút thời gian để suy nghĩ xem việc này có thực sự cần thiết hay chỉ là một sự bốc đồng.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setShowHardcore(false)} className="w-full py-3 rounded-xl font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer border border-emerald-500/20">
                Tôi sẽ tiếp tục làm việc!
              </button>
              <button 
                onClick={handleConfirmHardcoreStop}
                disabled={countdown > 0}
                className={cn(
                  "w-full py-3 rounded-xl font-medium transition-all duration-300",
                  countdown > 0 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 cursor-pointer"
                )}
              >
                {countdown > 0 ? `Vẫn tắt bảo vệ (${countdown}s)` : 'Xác nhận Tắt bảo vệ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer",
        active 
          ? "bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20 shadow-[inset_0_0_12px_rgba(99,102,241,0.1)]" 
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function HomeView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard title="Thời gian tập trung" value="2h 45m" trend="+15%" positive />
      <StatCard title="Trang web đã chặn" value="124" trend="Hôm nay" />
      <StatCard title="Vi phạm" value="3" trend="-2" positive />
    </div>
  );
}

function StatCard({ title, value, trend, positive }: { title: string, value: string, trend: string, positive?: boolean }) {
  return (
    <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-2 hover:bg-slate-800/60 transition-colors">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className="text-3xl font-bold text-slate-100">{value}</div>
      <div className={cn("text-xs font-medium mt-auto", positive ? "text-emerald-400" : "text-slate-500")}>
        {trend}
      </div>
    </div>
  );
}

function SettingsView({ config, updateConfig }: { config: AppConfig, updateConfig: (p: Partial<AppConfig>) => void }) {
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

  return (
    <div className="space-y-8 max-w-3xl">
      <section>
        <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" /> Danh sách chặn
        </h3>
        <textarea 
          className="w-full h-40 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none custom-scrollbar"
          value={config.blocked_domains.join("\n")}
          onChange={(e) => {
            const domains = e.target.value.split("\n").map(d => d.trim()).filter(d => d.length > 0);
            updateConfig({ blocked_domains: domains });
          }}
          placeholder="Mỗi dòng một trang web..."
        />
        <div className="mt-2 text-sm text-slate-500">Các trang web này sẽ bị chặn bằng cách can thiệp vào file Hosts hệ thống.</div>
      </section>

      <section>
        <h3 className="text-lg font-medium text-rose-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Chống Nghiện 18+ Tối Cao
        </h3>
        <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/20 shadow-[inset_0_0_15px_rgba(244,63,94,0.05)] relative overflow-hidden">
          <div className="relative z-10">
            <label className="flex items-center gap-3 cursor-pointer group mb-3">
              <input 
                type="checkbox" 
                checked={config.block_nsfw}
                onChange={(e) => updateConfig({ block_nsfw: e.target.checked })}
                className="w-5 h-5 rounded border-rose-500/50 bg-slate-900 text-rose-500 accent-rose-500 focus:ring-rose-500" 
              />
              <span className="text-rose-400 font-semibold group-hover:text-rose-300 transition-colors">Kích hoạt Bảo vệ Cấp Hệ điều hành</span>
            </label>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xl">
              Tính năng này sẽ ép đổi DNS mạng sang Cloudflare Family và tự động đóng sập (Kill) bất kỳ ứng dụng nào nếu bạn cố tình mở các từ khóa nhạy cảm.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" /> Nâng cao
        </h3>
        <div className="space-y-4 p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={config.start_with_windows}
              onChange={(e) => handleAutostartChange(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-indigo-500 accent-indigo-500" 
            />
            <span className="text-slate-300 group-hover:text-slate-200 transition-colors">Khởi động cùng Windows (chạy ngầm dưới System Tray)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={config.change_delay_enabled}
              onChange={(e) => updateConfig({ change_delay_enabled: e.target.checked })}
              className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-indigo-500 accent-indigo-500" 
            />
            <span className="text-slate-300 group-hover:text-slate-200 transition-colors">Kích hoạt Chống Hối Hận (Khóa nút Tắt bảo vệ trong 60 giây)</span>
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
    
    // Nếu đã có password, phải xác thực trước
    if (config.password_hash) {
      if (!oldPwd) {
        setError("Vui lòng nhập mật khẩu cũ!");
        return;
      }
      const ok = await invoke<boolean>("verify_password", { password: oldPwd });
      if (!ok) {
        setError("Mật khẩu cũ không chính xác!");
        return;
      }
    }

    if (pwd !== confirm) {
      setError("Mật khẩu mới không khớp!");
      return;
    }
    
    await invoke("set_password", { password: pwd.length > 0 ? pwd : null });
    setMsg(pwd.length > 0 ? "Đã lưu mật khẩu mới." : "Đã gỡ bỏ mật khẩu.");
    setOldPwd("");
    setPwd("");
    setConfirm("");
    refreshConfig();
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 shadow-[inset_0_0_15px_rgba(99,102,241,0.15)]">
          <Key className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-2xl font-semibold text-slate-200">
          {config.password_hash ? "Cập nhật Mật khẩu" : "Thiết lập Mật khẩu"}
        </h3>
        <p className="text-slate-400 text-sm mt-2">Ngăn chặn bản thân tự ý tắt phần mềm. Để trống mật khẩu mới nếu muốn gỡ bảo vệ.</p>
      </div>

      <div className="space-y-5 p-8 rounded-3xl bg-slate-800/40 border border-slate-700/50 shadow-xl">
        {msg && <div className="text-emerald-400 text-sm font-medium">{msg}</div>}
        {error && <div className="text-rose-400 text-sm font-medium">{error}</div>}
        
        {config.password_hash && (
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Mật khẩu hiện tại</label>
            <input 
              type="password" 
              value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="••••••••"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Mật khẩu mới {config.password_hash && "(Để trống để xóa)"}</label>
          <input 
            type="password" 
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Xác nhận mật khẩu mới</label>
          <input 
            type="password" 
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            placeholder="••••••••"
          />
        </div>
        <button 
          onClick={handleSave}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors mt-6 shadow-lg shadow-indigo-500/20 cursor-pointer"
        >
          {config.password_hash ? "Xác nhận Đổi/Xóa Mật khẩu" : "Khóa phần mềm"}
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
    const ok = await invoke<boolean>("verify_password", { password: pwd });
    if (ok) {
      onSuccess();
    } else {
      setError("Mật khẩu không chính xác!");
    }
  };

  const handleRequestUnlock = async () => {
    await invoke("request_unlock");
    refreshConfig();
  };

  const canBypass = config.unlock_requested_at && (Math.floor(Date.now() / 1000) - config.unlock_requested_at >= SEVEN_DAYS_SEC);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-indigo-500/10 relative">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 cursor-pointer">
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold text-center text-slate-100 mb-4">Nhập mật khẩu để tiếp tục</h3>
        <input 
          type="password" 
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 mb-2"
          placeholder="Mật khẩu của bạn..."
        />
        {error && <div className="text-rose-400 text-sm mb-4">{error}</div>}
        
        <button 
          onClick={handleVerify}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium cursor-pointer mb-4"
        >
          Xác nhận
        </button>

        <div className="border-t border-slate-800 pt-4 mt-2">
          {!config.unlock_requested_at ? (
            <button onClick={handleRequestUnlock} className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 underline cursor-pointer">
              Quên mật khẩu? Xin mở khóa (Chờ 7 ngày)
            </button>
          ) : (
            <div className="text-center">
              <div className="text-sm text-rose-400 mb-2 font-medium">{timeLeft}</div>
              {canBypass && (
                <button onClick={onSuccess} className="w-full py-2 bg-rose-500/20 text-rose-400 rounded-xl font-medium cursor-pointer">
                  Bỏ qua mật khẩu (Đã đủ 7 ngày)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
