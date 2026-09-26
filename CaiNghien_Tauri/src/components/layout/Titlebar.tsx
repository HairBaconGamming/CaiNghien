import React, { useState, useEffect, useRef } from 'react';
import { Minus, Square, Copy, X, Sparkles } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriEnvironment } from '../../services/api';

export const Titlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let isMounted = true;
    const appWindow = getCurrentWindow();

    appWindow
      .isMaximized()
      .then((max) => {
        if (isMounted) setIsMaximized(max);
      })
      .catch(console.error);

    const unlistenPromise = appWindow.onResized(async () => {
      try {
        const max = await appWindow.isMaximized();
        if (isMounted) setIsMaximized(max);
      } catch (err) {
        console.error('Failed to query isMaximized on resize:', err);
      }
    });

    return () => {
      isMounted = false;
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = async () => {
    if (!isTauriEnvironment()) return;
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error('Window minimize error:', e);
    }
    setActiveMenu(null);
  };

  const handleToggleMaximize = async () => {
    if (!isTauriEnvironment()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    } catch (e) {
      console.error('Window toggle maximize error:', e);
    }
    setActiveMenu(null);
  };

  const handleClose = async () => {
    if (!isTauriEnvironment()) return;
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error('Window close error:', e);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleToggleFullscreen = async () => {
    if (!isTauriEnvironment()) return;
    const appWindow = getCurrentWindow();
    const isFullScreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFullScreen);
    setActiveMenu(null);
  };

  const menus = [
    {
      id: 'file',
      label: 'Tệp',
      items: [
        { label: 'Thoát', onClick: handleClose, shortcut: 'Alt+F4' }
      ]
    },
    {
      id: 'view',
      label: 'Xem',
      items: [
        { label: 'Tải lại', onClick: handleReload, shortcut: 'Ctrl+R' },
        { label: 'Toàn màn hình', onClick: handleToggleFullscreen, shortcut: 'F11' }
      ]
    },
    {
      id: 'window',
      label: 'Cửa sổ',
      items: [
        { label: 'Thu nhỏ', onClick: handleMinimize, shortcut: 'Win+Down' },
        { label: 'Phóng to', onClick: handleToggleMaximize, shortcut: 'Win+Up' }
      ]
    }
  ];

  return (
    <div
      data-tauri-drag-region="true"
      onDoubleClick={handleToggleMaximize}
      className="h-8 w-full bg-slate-950/75 backdrop-blur-xl border-b border-white/[0.08] select-none flex items-center justify-between z-50 relative shrink-0"
    >
      {/* Left Branding & Menu */}
      <div className="flex items-center h-full">
        <div
          data-tauri-drag-region="true"
          className="flex items-center gap-2 pl-3 pr-4 h-full pointer-events-none"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
          <span className="text-xs font-semibold tracking-wider text-slate-300 font-sans whitespace-nowrap">
            CaiNghien Focus Guard
          </span>
        </div>

        {/* Custom Menubar */}
        <div ref={menuRef} className="flex items-center h-full text-[11px] text-slate-300 relative z-50">
          {menus.map((menu) => (
            <div key={menu.id} className="relative h-full">
              <button
                onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
                onMouseEnter={() => {
                  if (activeMenu && activeMenu !== menu.id) setActiveMenu(menu.id);
                }}
                className={`h-full px-3 flex items-center hover:bg-white/10 transition-colors cursor-default ${
                  activeMenu === menu.id ? 'bg-white/10 text-white' : ''
                }`}
              >
                {menu.label}
              </button>
              
              {activeMenu === menu.id && (
                <div className="absolute top-8 left-0 min-w-[180px] py-1 bg-[#1a1b26] border border-white/10 shadow-2xl rounded-b-md">
                  {menu.items.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={item.onClick}
                      className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors text-left text-[11px]"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="text-slate-500">{item.shortcut}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center Flexible Drag Zone */}
      <div data-tauri-drag-region="true" className="flex-1 h-full" />

      {/* Right Window Action Controls */}
      <div data-tauri-drag-region="false" className="flex items-center h-full">
        <button
          type="button"
          aria-label="Minimize"
          title="Minimize"
          onClick={handleMinimize}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-default"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          title={isMaximized ? 'Restore' : 'Maximize'}
          onClick={handleToggleMaximize}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-default"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-90" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          aria-label="Close"
          title="Close to Tray"
          onClick={handleClose}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600/90 transition-colors cursor-default"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Titlebar;
