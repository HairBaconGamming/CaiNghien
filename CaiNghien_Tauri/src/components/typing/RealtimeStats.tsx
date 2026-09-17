import React from 'react';
import { Zap, Target, Clock } from 'lucide-react';

export interface RealtimeStatsProps {
  wpm: number;
  accuracy: number;
  timeSeconds: number;
  variant?: 'compact' | 'pills';
  className?: string;
}

/**
 * Format elapsed seconds into MM:SS format.
 */
export function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate net WPM based on correct characters and elapsed time.
 * Standard calculation: (correctCharacters / 5) / (elapsedSeconds / 60)
 */
export function calculateWPM(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0 || correctChars <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  const words = correctChars / 5;
  return Math.round(words / minutes);
}

/**
 * Calculate typing accuracy percentage: (correct / totalTyped) * 100
 */
export function calculateAccuracy(correctChars: number, totalTyped: number): number {
  if (totalTyped <= 0) return 100;
  const acc = (correctChars / totalTyped) * 100;
  return Math.max(0, Math.min(100, Math.round(acc)));
}

export const RealtimeStats: React.FC<RealtimeStatsProps> = ({
  wpm,
  accuracy,
  timeSeconds,
  variant = 'compact',
  className = '',
}) => {
  const formattedTime = formatTime(timeSeconds);

  if (variant === 'pills') {
    return (
      <div className={`flex items-center gap-3 select-none ${className}`}>
        {/* WPM Pill (Cyan Accent) */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-400/40 shadow-[0_0_12px_rgba(0,240,255,0.25)] backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-300">WPM:</span>
          <span className="text-sm font-bold text-white font-mono tabular-nums">
            {wpm}
          </span>
        </div>

        {/* Accuracy Pill (Purple Accent) */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/40 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)] backdrop-blur-md">
          <Target className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-slate-300">Accuracy:</span>
          <span className="text-sm font-bold text-white font-mono tabular-nums">
            {accuracy}%
          </span>
        </div>

        {/* Time Pill (Emerald Green Accent) */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)] backdrop-blur-md">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-300">Time:</span>
          <span className="text-sm font-bold text-white font-mono tabular-nums">
            {formattedTime}
          </span>
        </div>
      </div>
    );
  }

  // Default 'compact' layout matching cain_typing_challenge.jpg 100%
  return (
    <div
      className={`flex flex-col items-end justify-start space-y-1 font-mono select-none text-right min-w-[100px] ${className}`}
      aria-label="Real-time typing telemetry"
    >
      <div className="flex items-baseline justify-end gap-1.5">
        <span className="text-xs font-medium text-slate-400">WPM:</span>
        <span className="text-sm font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] tabular-nums">
          {wpm}
        </span>
      </div>

      <div className="flex items-baseline justify-end gap-1.5">
        <span className="text-xs font-medium text-slate-400">Accuracy:</span>
        <span className="text-sm font-bold text-slate-200 tabular-nums">
          {accuracy}%
        </span>
      </div>

      <div className="flex items-baseline justify-end gap-1.5">
        <span className="text-xs font-medium text-slate-400">Time:</span>
        <span className="text-sm font-medium text-slate-300 tabular-nums">
          {formattedTime}
        </span>
      </div>
    </div>
  );
};

export default RealtimeStats;
