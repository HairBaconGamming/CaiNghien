import React from 'react';
import { Flame, Trophy, Activity, Calendar, TrendingUp } from 'lucide-react';

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  colorScheme?: 'cyan' | 'purple' | 'amber' | 'emerald';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive = true,
  colorScheme = 'cyan'
}) => {
  const colorStyles = {
    cyan: {
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_15px_rgba(0,240,255,0.15)]',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
      valueColor: 'text-white'
    },
    purple: {
      border: 'border-purple-500/30',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
      iconBg: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
      valueColor: 'text-white'
    },
    amber: {
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      valueColor: 'text-white'
    },
    emerald: {
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      valueColor: 'text-white'
    }
  };

  const currentStyle = colorStyles[colorScheme] || colorStyles.cyan;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl border border-white/10 ${currentStyle.border} ${currentStyle.glow} transition-all duration-300 hover:scale-[1.02] hover:border-white/20`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
            {title}
          </span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {value}
          </div>
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStyle.iconBg}`}>
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`font-semibold flex items-center gap-0.5 ${
                trendPositive ? 'text-cyan-400' : 'text-rose-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {trend}
            </span>
          )}
          {subtitle && <span className="text-slate-400">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export interface DashboardMetricsRowProps {
  contributions?: number;
  currentStreak?: number;
  activityRate?: number;
}

export const DashboardMetricsRow: React.FC<DashboardMetricsRowProps> = ({
  contributions = 4185,
  currentStreak = 128,
  activityRate = 85
}) => {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-4 border-t border-white/5">
      {/* Left 3 Large Stats (matching cain_dashboard.jpg) */}
      <div className="flex items-center gap-12">
        {/* Contributions */}
        <div>
          <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {contributions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 font-normal">
            Đóng góp (Năm)
          </div>
        </div>

        {/* Chuỗi hiện tại */}
        <div>
          <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {currentStreak} Ngày
          </div>
          <div className="text-xs text-slate-400 mt-0.5 font-normal">
            Chuỗi hiện tại
          </div>
        </div>

        {/* Activity Rate */}
        <div>
          <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {activityRate}%
          </div>
          <div className="text-xs text-slate-400 mt-0.5 font-normal">
            Hoạt động (TB)
          </div>
        </div>
      </div>

      {/* Right Tier Color Breakdown Swatches (matching cain_dashboard.jpg) */}
      <div className="flex items-center gap-2 text-xs text-slate-300">
        {/* Tier 0 */}
        <div className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 px-2 py-1 rounded-md">
          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#1e2433] border border-white/10" />
          <span className="text-slate-400 text-[11px]">0</span>
        </div>

        {/* Tier 1 */}
        <div className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 px-2 py-1 rounded-md">
          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#2c407a] border border-white/10" />
          <span className="text-slate-400 text-[11px]">0</span>
        </div>

        {/* Tier 2 */}
        <div className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 px-2 py-1 rounded-md">
          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#4338ca] border border-white/10" />
          <span className="text-slate-400 text-[11px]">0</span>
        </div>

        {/* Tier 3 & 4 (Tím) */}
        <div className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 px-2 py-1 rounded-md">
          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#8b5cf6] border border-white/10" />
          <span className="text-slate-400 text-[11px]">Tím</span>
        </div>

        {/* Tier 5 (30+ Neon Cyan Glow) */}
        <div className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 px-2 py-1 rounded-md">
          <div
            className="w-3.5 h-3.5 rounded-[3px] bg-[#00f0ff] border border-white/20"
            style={{
              boxShadow: '0 0 8px #00f0ff, 0 0 14px rgba(0, 240, 255, 0.6)'
            }}
          />
          <span className="text-cyan-300 font-semibold text-[11px]">30+</span>
        </div>
      </div>
    </div>
  );
};

export interface StatsCardsGridProps {
  totalContributions?: number;
  currentStreak?: number;
  longestStreak?: number;
  activityRate?: number;
}

export const StatsCardsGrid: React.FC<StatsCardsGridProps> = ({
  totalContributions = 4185,
  currentStreak = 128,
  longestStreak = 156,
  activityRate = 85
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
      <StatsCard
        title="Tổng đóng góp"
        value={totalContributions.toLocaleString()}
        subtitle="Năm nay"
        trend="+12.4%"
        trendPositive={true}
        icon={<Calendar className="w-5 h-5" />}
        colorScheme="cyan"
      />
      <StatsCard
        title="Chuỗi hiện tại"
        value={`${currentStreak} Ngày`}
        subtitle="Kỷ luật bền bỉ"
        trend="Đang bùng nổ!"
        trendPositive={true}
        icon={<Flame className="w-5 h-5" />}
        colorScheme="purple"
      />
      <StatsCard
        title="Chuỗi dài nhất"
        value={`${longestStreak} Ngày`}
        subtitle="Kỷ lục cá nhân"
        icon={<Trophy className="w-5 h-5" />}
        colorScheme="amber"
      />
      <StatsCard
        title="Tỷ lệ hoạt động"
        value={`${activityRate}%`}
        subtitle="Trung bình năm"
        trend="+3.2%"
        trendPositive={true}
        icon={<Activity className="w-5 h-5" />}
        colorScheme="emerald"
      />
    </div>
  );
};

export default StatsCard;
