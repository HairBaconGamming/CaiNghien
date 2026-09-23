import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onClose: (id: string) => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ id, type, message, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
    info: <Info className="w-5 h-5 text-sky-400" />
  };

  const borders = {
    success: 'border-emerald-500/30',
    error: 'border-rose-500/30',
    info: 'border-sky-500/30'
  };

  const shadows = {
    success: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    error: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    info: 'shadow-[0_0_20px_rgba(14,165,233,0.15)]'
  };

  return (
    <div className={`pointer-events-auto flex items-start gap-3 w-full max-w-sm p-4 mb-3 glass-panel rounded-2xl border ${borders[type]} ${shadows[type]} animate-in slide-in-from-right-8 fade-in duration-300`}>
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1 text-sm font-medium text-slate-200 mt-0.5 leading-relaxed">
        {message}
      </div>
      <button 
        onClick={() => onClose(id)}
        className="shrink-0 text-slate-400 hover:text-white transition-colors p-1 -mt-1 -mr-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
