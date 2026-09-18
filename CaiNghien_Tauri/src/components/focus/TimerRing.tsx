import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Check, X } from 'lucide-react';

export interface TimerRingProps {
  secondsRemaining: number;
  totalSeconds: number;
  isRunning: boolean;
  selectedMinutes: number;
  onTogglePlayPause: () => void;
  onReset?: () => void;
  onSelectDuration?: (minutes: number) => void;
  availableDurations?: number[];
  disabled?: boolean;
}

export const TimerRing: React.FC<TimerRingProps> = ({
  secondsRemaining,
  totalSeconds,
  isRunning,
  selectedMinutes,
  onTogglePlayPause,
  onReset,
  onSelectDuration,
  availableDurations = [15, 25, 45, 60, 90],
  disabled = false,
}) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Format MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  // SVG Geometry Constants
  // Center is (200, 200) in a 400x400 SVG canvas
  const size = 400;
  const center = size / 2; // 200
  const radius = 155; // Radius of progress arc
  const circumference = 2 * Math.PI * radius; // ~973.89

  // Calculate progress ratio (elapsed)
  // When running from 25:00 down to 00:00:
  // At start (25:00 remaining): elapsed = 0 -> arc offset = circumference (or shown up to selected session)
  // Look at cain_focus_room.jpg:
  // The progress arc starts at 12 o'clock and extends clockwise down to ~5 o'clock (~25 minutes position on a 60m clock, or elapsed session fraction).
  const elapsedSeconds = Math.max(0, totalSeconds - secondsRemaining);
  const progressRatio = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  
  // Dash offset: Starts at 0 elapsed and fills as time passes
  // We offset by circumference * (1 - progressRatio)
  // If timer is not yet started, we show a subtle indicator or initial arc
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="relative flex flex-col items-center justify-center select-none group">
      {/* Outer Glow Halo */}
      <div 
        className="absolute w-[440px] h-[440px] rounded-full pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background: isRunning 
            ? 'radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, rgba(168, 85, 247, 0.08) 45%, transparent 70%)'
            : 'radial-gradient(circle, rgba(56, 189, 248, 0.06) 0%, transparent 65%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Dial Container (420px x 420px) */}
      <div className="relative w-[420px] h-[420px] flex items-center justify-center">
        
        {/* Cardinal Markers on the perimeter matching cain_focus_room.jpg */}
        {/* 12 o'clock: 0 */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[13px] font-medium text-slate-400/80 tracking-wider">
          0
        </div>

        {/* 3 o'clock: 15 */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] font-medium text-slate-400/80 tracking-wider">
          15
        </div>

        {/* 6 o'clock: 30 */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[13px] font-medium text-slate-400/80 tracking-wider">
          30
        </div>

        {/* 9 o'clock: .45 matching mockup */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[13px] font-medium text-slate-400/80 tracking-wider">
          .45
        </div>

        {/* Outer Circular Reference Line */}
        <div className="absolute w-[394px] h-[394px] rounded-full border border-white/[0.07] pointer-events-none" />

        {/* Main SVG Progress Arc Layer */}
        <svg 
          className="absolute w-[400px] h-[400px] -rotate-90 pointer-events-none z-10"
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            {/* Radiant White-Cyan-Purple Neon Gradient */}
            <linearGradient id="timerNeonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="60%" stopColor="#00f0ff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.85" />
            </linearGradient>

            {/* Glowing Bloom Filter */}
            <filter id="timerBloom" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur1" />
              <feGaussianBlur stdDeviation="8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="5"
          />

          {/* Glowing Animated Progress Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#timerNeonGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#timerBloom)"
            style={{
              transition: isRunning ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset 0.4s ease-out',
            }}
          />
        </svg>

        {/* Middle Glassmorphic Frosted Disc */}
        <div 
          className="relative w-[340px] h-[340px] rounded-full flex flex-col items-center justify-center z-20 transition-all duration-300"
          style={{
            background: 'radial-gradient(circle at center, rgba(20, 28, 52, 0.45) 0%, rgba(10, 16, 35, 0.65) 100%)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: `
              0 0 45px rgba(0, 0, 0, 0.6),
              inset 0 1px 2px rgba(255, 255, 255, 0.3),
              inset 0 0 30px rgba(0, 240, 255, 0.05),
              0 0 30px ${isRunning ? 'rgba(0, 240, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)'}
            `,
          }}
        >
          {/* Play / Pause Frosted Pill Button matching cain_focus_room.jpg */}
          <button
            type="button"
            onClick={onTogglePlayPause}
            disabled={disabled}
            aria-label={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
            className={`
              w-9 h-9 rounded-full flex items-center justify-center
              border transition-all duration-200 cursor-pointer
              ${isRunning 
                ? 'bg-white/12 hover:bg-white/20 border-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)] scale-100 hover:scale-105' 
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/40 text-cyan-300 shadow-[0_0_16px_rgba(0,240,255,0.3)] hover:scale-105 active:scale-95'
              }
            `}
          >
            {isRunning ? (
              <Pause size={15} className="fill-white text-white translate-x-0" />
            ) : (
              <Play size={15} className="fill-cyan-300 text-cyan-300 translate-x-0.5" />
            )}
          </button>

          {/* FOCUS SESSION Subtitle */}
          <span className="text-[11px] font-semibold tracking-[0.28em] text-slate-300 uppercase mt-3 mb-1">
            FOCUS SESSION
          </span>

          {/* Big Time Display: "25:00" */}
          <div 
            className="text-[74px] leading-none font-bold text-white tracking-tight font-mono my-1 select-all"
            style={{
              textShadow: `
                0 0 25px rgba(255, 255, 255, 0.5),
                0 0 45px rgba(0, 240, 255, 0.35)
              `,
            }}
          >
            {formatTime(secondsRemaining)}
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-1.5 mt-1">
            <span 
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning 
                  ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]' 
                  : secondsRemaining === 0 
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-slate-400/60'
              }`} 
            />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
              {isRunning 
                ? 'ĐANG TẬP TRUNG' 
                : secondsRemaining === 0 
                ? 'HOÀN THÀNH' 
                : secondsRemaining < totalSeconds 
                ? 'TẠM DỪNG' 
                : 'SẴN SÀNG'}
            </span>
          </div>

          {/* Reset Action Button when paused & timer progressed */}
          {!isRunning && secondsRemaining < totalSeconds && onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Đặt lại bộ đếm"
              className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Duration Selector Pills (Visible when not actively running or on subtle hover) */}
      {!isRunning && onSelectDuration && (
        <div className="flex items-center gap-2 mt-5 animate-fade-in flex-wrap justify-center">
          {availableDurations.map((mins) => {
            const isSelected = selectedMinutes === mins && !isCustomizing;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setIsCustomizing(false);
                  onSelectDuration(mins);
                }}
                disabled={disabled}
                className={`
                  px-3 py-1 rounded-full text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(0,240,255,0.35)] scale-105'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20'
                  }
                `}
              >
                {mins}m
              </button>
            );
          })}

          {isCustomizing ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <input
                type="number"
                min="1"
                max="999"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    let val = parseInt(customValue, 10);
                    if (!isNaN(val) && val > 0) {
                      if (val > 999) val = 999;
                      onSelectDuration(val);
                      setIsCustomizing(false);
                    }
                  } else if (e.key === 'Escape') {
                    setIsCustomizing(false);
                  }
                }}
                placeholder="Phút"
                className="w-16 px-2 py-1 bg-white/5 border border-cyan-400/50 text-cyan-300 text-xs rounded-full focus:outline-none focus:border-cyan-300 text-center"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  let val = parseInt(customValue, 10);
                  if (!isNaN(val) && val > 0) {
                    if (val > 999) val = 999;
                    onSelectDuration(val);
                    setIsCustomizing(false);
                  }
                }}
                className="p-1 rounded-full text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                title="Xác nhận"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsCustomizing(false)}
                className="p-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Hủy"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCustomValue(!availableDurations.includes(selectedMinutes) ? String(selectedMinutes) : '');
                setIsCustomizing(true);
              }}
              disabled={disabled}
              className={`
                px-3 py-1 rounded-full text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer
                ${!availableDurations.includes(selectedMinutes)
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(0,240,255,0.35)] scale-105'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20'
                }
              `}
            >
              {!availableDurations.includes(selectedMinutes) ? `${selectedMinutes}m` : 'Tùy chỉnh'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
