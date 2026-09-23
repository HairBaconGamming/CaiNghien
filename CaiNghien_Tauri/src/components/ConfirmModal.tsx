import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.15)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 mt-8">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className="px-6 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
