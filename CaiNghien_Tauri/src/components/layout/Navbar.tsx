import type { FC, ComponentType } from 'react';
import {
  LayoutDashboard,
  Timer,
  Keyboard,
  Settings,
  Bell,
  Sparkles,
  User
} from 'lucide-react';

export type NavTabId = 'dashboard' | 'focus' | 'typing' | 'settings' | 'account';

export interface NavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  userLevel?: number;
  userTitle?: string;
  hasNotifications?: boolean;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  userLevel = 28,
  userTitle = 'Stargazer',
  hasNotifications = true,
}) => {
  const navItems: { id: NavTabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'focus', label: 'Phòng tập trung', icon: Timer },
    { id: 'typing', label: 'Thử thách gõ phím', icon: Keyboard },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
    { id: 'account', label: 'Tài khoản', icon: User },
  ];

  return (
    <header className="h-16 px-8 border-b border-white/10 flex items-center justify-between backdrop-blur-xl bg-slate-950/40 select-none z-30 relative">
      {/* Left Region: Logo & Tabs */}
      <div className="flex items-center gap-2">
        {/* Brand Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onSelectTab('dashboard')}
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 via-purple-600/20 to-pink-500/20 border border-white/15 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.25)] group-hover:border-cyan-400/50 transition-all duration-300">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none">
              <circle cx="5" cy="12" r="2" fill="#00f0ff" />
              <circle cx="12" cy="5" r="2.5" fill="#a855f7" />
              <circle cx="19" cy="11" r="2" fill="#d946ef" />
              <circle cx="14" cy="19" r="2" fill="#38bdf8" />
              <path
                d="M5 12L12 5L19 11L14 19L5 12"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-[0.2em] text-white uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                COSMOS
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 tracking-wider">
                FOCUS GUARD
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              CaiNghien Desktop Suite
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-white/15 mx-4" />

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 rounded-full shadow-[0_0_10px_#00f0ff]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Region: Level Badge, Notifications & Cog */}
      <div className="flex items-center gap-4">
        {/* Level Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/70 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.25)] hover:border-purple-400/50 transition-colors">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-[11px] font-black text-slate-950">
            <Sparkles className="w-3 h-3 text-slate-950" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-sky-300">CẤP {userLevel}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-200">{userTitle}</span>
          </div>
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          onClick={() => {}}
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {hasNotifications && (
            <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899] absolute top-1.5 right-1.5 animate-pulse" />
          )}
        </button>

        {/* Global Settings Cog */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'text-cyan-300 bg-cyan-400/10'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
