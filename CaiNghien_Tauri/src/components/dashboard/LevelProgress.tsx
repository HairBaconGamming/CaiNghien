import React from 'react';
import type { UserProfile } from '../../services/api';

export type UserProfileData = Partial<UserProfile> & {
  handle?: string;
  next_title?: string;
};

export interface LevelProgressProps {
  profile?: UserProfileData;
  isLoading?: boolean;
}

function getRankTitleForLevel(lvl: number): string {
  if (lvl >= 50) return 'Celestial Master';
  if (lvl >= 35) return 'Stellar Captain';
  if (lvl >= 25) return 'Nova Voyager';
  if (lvl >= 15) return 'Cosmic Explorer';
  if (lvl >= 5) return 'Stargazer';
  return 'Cosmic Cadet';
}

export const LevelProgress: React.FC<LevelProgressProps> = ({
  profile,
  isLoading = false
}) => {
  // Defaults matching cain_dashboard.jpg
  const username = profile?.username ?? 'Alex Chen';
  const handle = profile?.handle ?? '@astro_alex';
  const level = profile?.level ?? 28;
  const rankTitle = profile?.title ?? profile?.rank ?? 'Stargazer';
  const currentXp = Math.max(0, profile?.current_xp ?? 14350);
  const nextLevelXp = Math.max(1, profile?.next_level_xp ?? 15000);
  const nextLevel = level + 1;
  const nextTitle = profile?.next_title ?? `${getRankTitleForLevel(nextLevel)} (LVL ${nextLevel})`;

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentXp / nextLevelXp) * 100))
  );

  if (isLoading) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl relative overflow-hidden animate-pulse">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-white/10 rounded" />
            <div className="h-4 w-36 bg-white/10 rounded" />
            <div className="h-3 w-56 bg-white/10 rounded" />
          </div>
        </div>
        <div className="mt-6">
          <div className="h-4 w-full bg-white/5 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl relative overflow-hidden shrink-0"
      style={{
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}
    >
      {/* Background ambient radial highlight */}
      <div
        className="absolute top-0 right-1/4 w-96 h-96 pointer-events-none -z-0 opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(0, 240, 255, 0.1) 40%, transparent 70%)'
        }}
      />

      {/* User Information Row */}
      <div className="flex items-center gap-5 relative z-10">
        {/* Cosmic Black Hole Avatar */}
        <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
          {/* Outer purple pulsating halo */}
          <div
            className="absolute inset-0 rounded-full border border-purple-500/50 animate-pulse"
            style={{
              boxShadow: '0 0 18px rgba(168, 85, 247, 0.5), inset 0 0 10px rgba(168, 85, 247, 0.3)',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 80%)'
            }}
          />
          {/* Inner cyan accretion ring */}
          <div
            className="absolute inset-1.5 rounded-full border border-cyan-400/60"
            style={{
              boxShadow: '0 0 14px rgba(0, 240, 255, 0.6), inset 0 0 8px rgba(0, 240, 255, 0.4)'
            }}
          />
          {/* Event Horizon (Black Hole Center) */}
          <div className="w-9 h-9 rounded-full bg-[#030712] border border-white/10 flex items-center justify-center relative z-10 shadow-inner">
            <div className="w-3 h-3 rounded-full bg-[#070c1e] shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
          </div>
        </div>

        {/* User Meta */}
        <div className="flex flex-col justify-center">
          <div className="flex items-baseline">
            <span className="text-xl font-bold text-white tracking-wide">{username}</span>
            <span className="text-slate-400 text-sm font-normal ml-2">{handle}</span>
          </div>
          <div className="text-sky-400 font-semibold text-sm tracking-wide mt-0.5">
            Level {level}: {rankTitle}
          </div>
          <div className="text-slate-400 text-xs mt-0.5 font-normal">
            XP: {currentXp.toLocaleString()}/{nextLevelXp.toLocaleString()} | {progressPercent}% hoàn thành
          </div>
        </div>
      </div>

      {/* User Level Progress Bar Section */}
      <div className="mt-5 relative z-10">
        {/* Status Line */}
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-300 font-medium text-sm">Cấp độ người dùng</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-300">{progressPercent}% Hoàn thành</span>
            <span className="bg-slate-800/90 border border-white/20 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm">
              LVL {level}
            </span>
            <span className="text-slate-400 text-xs">Next: {nextTitle}</span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="relative w-full h-4 bg-slate-950/70 border border-white/15 rounded-full flex items-center px-0.5 overflow-visible">
          {/* Filled Multi-Stop Gradient Bar */}
          <div
            className="h-2.5 rounded-full relative transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 30%, #6366f1 60%, #06b6d4 85%, #00f0ff 100%)',
              boxShadow: '0 0 16px rgba(0, 240, 255, 0.55), 0 0 28px rgba(168, 85, 247, 0.35)'
            }}
          />

          {/* Milestone Node: 35% (Magenta/Pink glow) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-pink-400 border-2 border-slate-900 pointer-events-none z-10"
            style={{
              left: '35%',
              boxShadow: '0 0 10px #ec4899, 0 0 18px rgba(236, 72, 153, 0.6)'
            }}
            title="Milestone 35%"
          />

          {/* Milestone Node: 65% (Bright White glow) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-900 pointer-events-none z-10"
            style={{
              left: '65%',
              boxShadow: '0 0 10px #ffffff, 0 0 18px rgba(255, 255, 255, 0.8)'
            }}
            title="Milestone 65%"
          />

          {/* Milestone Node: 80% (Sky Blue glow) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-sky-300 border-2 border-slate-900 pointer-events-none z-10"
            style={{
              left: '80%',
              boxShadow: '0 0 8px #38bdf8, 0 0 16px rgba(56, 189, 248, 0.6)'
            }}
            title="Milestone 80%"
          />

          {/* Head Orb at Current Progress Point (~96%) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-200 border-2 border-white pointer-events-none z-20 animate-pulse"
            style={{
              left: `${progressPercent}%`,
              boxShadow: '0 0 16px #00f0ff, 0 0 30px #00f0ff'
            }}
            title={`Current Progress: ${progressPercent}%`}
          />
        </div>
      </div>
    </div>
  );
};

export default LevelProgress;
