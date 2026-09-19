import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Sparkles } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriEnvironment } from '../../services/api';

export const Titlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

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

  const handleMinimize = async () => {
    if (!isTauriEnvironment()) return;
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error('Window minimize error:', e);
    }
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
  };

  const handleClose = async () => {
    if (!isTauriEnvironment()) return;
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error('Window close error:', e);
    }
  };

  return (
    <div
      data-tauri-drag-region="true"
      onDoubleClick={handleToggleMaximize}
      className="h-8 w-full bg-slate-950/75 backdrop-blur-xl border-b border-white/[0.08] select-none flex items-center justify-between z-50 relative shrink-0"
    >
      {/* Left Branding & Drag Handle */}
      <div
        data-tauri-drag-region="true"
        className="flex items-center gap-2 pl-3 pointer-events-none"
      >
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
        <span className="text-xs font-semibold tracking-wider text-slate-300 font-sans">
          CaiNghiện Focus Guard
        </span>
        <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ml-1">
          v1.2.0 • Cosmos
        </span>
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
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          title={isMaximized ? 'Restore' : 'Maximize'}
          onClick={handleToggleMaximize}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600/90 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Titlebar;
