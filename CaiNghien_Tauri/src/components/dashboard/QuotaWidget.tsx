import React, { useState, useEffect, useRef } from 'react';
import { api, QuotaStatus } from '../../services/api';
import { Play, Pause, Clock } from 'lucide-react';

export const QuotaWidget: React.FC = () => {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchStatus = async () => {
    try {
      if (!api.isTauriEnvironment()) {
        if (mounted.current) {
          setQuotaStatus({ active: false, used_seconds: 0, max_seconds: 7200 });
        }
        return;
      }
      const status = await api.getQuotaStatus();
      if (mounted.current) {
        setQuotaStatus(status);
      }
    } catch (err) {
      console.error('Error fetching quota status:', err);
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 1 second to update the timer smoothly
    const interval = setInterval(() => {
      fetchStatus();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    try {
      if (api.isTauriEnvironment()) {
        await api.startQuota();
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error starting quota:', err);
    }
  };

  const handlePause = async () => {
    try {
      if (api.isTauriEnvironment()) {
        await api.pauseQuota();
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error pausing quota:', err);
    }
  };

  if (isLoading && !quotaStatus) {
    return (
      <div className="shrink-0 bg-[#1C1C1E] border border-white/5 rounded-2xl p-6 flex justify-center items-center">
        <span className="text-white/50">Đang tải Quota...</span>
      </div>
    );
  }

  const { active, used_seconds, max_seconds } = quotaStatus || { active: false, used_seconds: 0, max_seconds: 0 };
  const remainingSeconds = Math.max(0, max_seconds - used_seconds);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  
  // Pad strings to prevent layout shift
  const padMin = String(minutes).padStart(2, '0');
  const padSec = String(seconds).padStart(2, '0');
  
  const percentUsed = max_seconds > 0 ? Math.min(100, (used_seconds / max_seconds) * 100) : 100;

  return (
    <div className="shrink-0 bg-[#1C1C1E] border border-white/5 rounded-2xl p-6 flex flex-col gap-4 shadow-lg relative overflow-hidden">
      {/* Background active indicator glow */}
      {active && (
        <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />
      )}
      
      <div className="flex justify-between items-center relative z-10">
        <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          <Clock className={`w-5 h-5 ${active ? 'text-indigo-400 animate-pulse' : 'text-white/40'}`} />
          Thời gian giải trí (Quota)
        </h3>
        <div className="flex gap-2">
          {!active ? (
            <button
              onClick={handleStart}
              disabled={remainingSeconds === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              <Play className="w-4 h-4" /> Bắt đầu
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-xl transition-all font-medium text-sm"
            >
              <Pause className="w-4 h-4" /> Tạm dừng
            </button>
          )}
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-white/80 font-medium font-mono">
            Còn lại: {hours > 0 ? `${hours}h ` : ''}{padMin}m {padSec}s
          </span>
          <span className="text-white/50">
            Đã dùng {Math.floor(used_seconds / 60)}m / {Math.floor(max_seconds / 60)}m
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${percentUsed > 90 ? 'bg-red-500' : percentUsed > 75 ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>
      
      {active && (
        <div className="text-xs text-indigo-300/80 text-center relative z-10 mt-1">
          Quota đang hoạt động. Các rào cản tạm thời được gỡ bỏ.
        </div>
      )}
    </div>
  );
};
