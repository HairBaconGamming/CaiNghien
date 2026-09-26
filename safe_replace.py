import os

with open('CaiNghien_Tauri/src/components/layout/Navbar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add getRankTitleForLevel and Notification
text = text.replace(
'''export type NavTabId = 'dashboard' | 'focus' | 'typing' | 'settings' | 'account';

export interface NavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  userLevel?: number;
  userTitle?: string;
  hasNotifications?: boolean;
}''',
'''export type NavTabId = 'dashboard' | 'focus' | 'typing' | 'settings' | 'account';

import { getRankTitleForLevel } from '../../services/api';

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export interface NavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  userLevel?: number;
  userTitle?: string;
  notifications?: Notification[];
  onMarkNotificationsRead?: () => void;
}'''
)

# 2. Update Component Signature
text = text.replace(
'''export const Navbar: FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  userLevel = 28,
  userTitle = 'Stargazer',
  hasNotifications = true,
}) => {''',
'''import { useState, useRef, useEffect } from 'react';

export const Navbar: FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  userLevel = 1,
  userTitle,
  notifications = [],
  onMarkNotificationsRead,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasUnread = notifications.some(n => !n.read);
  const displayTitle = userTitle ?? getRankTitleForLevel(userLevel);'''
)

# 3. Replace the old Bell button with Dropdown
bell_search = '''        <button
          type="button"
          onClick={() => {}}
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {hasNotifications && (
            <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899] absolute top-1.5 right-1.5 animate-pulse" />
          )}
        </button>'''

bell_replace = '''        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications && hasUnread && onMarkNotificationsRead) {
                onMarkNotificationsRead();
              }
            }}
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {hasUnread && (
              <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899] absolute top-1.5 right-1.5 animate-pulse" />
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-50">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-white font-bold text-sm">Thông Báo</h3>
                <span className="text-xs text-slate-400">{notifications.length} tin</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Không có thông báo nào.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!notif.read ? 'bg-cyan-900/20' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm font-semibold ${!notif.read ? 'text-cyan-300' : 'text-slate-300'}`}>{notif.title}</h4>
                        <span className="text-[10px] text-slate-500">{notif.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>'''

text = text.replace(bell_search, bell_replace)

# 4. Replace `{userTitle}` with `{displayTitle}` inside the level badge
text = text.replace('>{userTitle}<', '>{displayTitle}<')

# 5. Fix the mojibake in the nav items
text = text.replace("T\\ufffd ng quan", "Tổng quan").replace("T\ufffd ng quan", "Tổng quan").replace("T ng quan", "Tổng quan")
text = text.replace("PhAng t-p trung", "Phòng tập trung")
text = text.replace("Th- thAch gA phA-m", "Thử thách gõ phím")
text = text.replace("CAi `t", "Cài đặt")
text = text.replace("TAi khon", "Tài khoản")

# Fix the badge "C P" and "?" to "CẤP" and "•"
text = text.replace("C P", "CẤP")
text = text.replace(">?<", "> • <")

with open('CaiNghien_Tauri/src/components/layout/Navbar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
