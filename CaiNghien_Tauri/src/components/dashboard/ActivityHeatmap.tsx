import React, { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, ChevronDown, Flame } from 'lucide-react';
import { DashboardMetricsRow } from './StatsCard';
import type { HeatmapData as ApiHeatmapData, HeatmapDay } from '../../services/api';

export type DayCell = HeatmapDay;
export type HeatmapData = ApiHeatmapData;

export interface ActivityHeatmapProps {
  data?: HeatmapData;
  isLoading?: boolean;
  yearRange?: string; // default "2023-2024" or dynamic
}

// Color scale mappings per spec.md
export const TIER_COLORS: Record<number, string> = {
  0: '#1e2433', // Empty (charcoal)
  1: '#2c407a', // 1-7 (deep slate blue)
  2: '#4338ca', // 8-15 (indigo)
  3: '#8b5cf6', // 16-22 (purple/violet)
  4: '#c026d3', // 23-29 (magenta)
  5: '#00f0ff', // 30+ (bright neon cyan)
};

const formatDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  isLoading = false,
  yearRange = '2023-2024',
}) => {
  // Cell data currently hovered/active
  const [activeCell, setActiveCell] = useState<{
    date: string;
    count: number;
    level: number;
  } | null>(null);

  // Exact real-time cursor coordinates
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [activeFilter, setActiveFilter] = useState<'all' | 'streak'>('all');
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);

  // Smooth RAF-throttled pointer movement tracking
  const updateCoords = useCallback((clientX: number, clientY: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setCoords({ x: clientX, y: clientY });
    });
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      updateCoords(e.clientX, e.clientY);
    },
    [updateCoords]
  );

  // Clean dismissal when cursor leaves the entire heatmap area
  const handlePointerLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setActiveCell(null);
    setCoords(null);
  }, []);

  // 52 columns x 7 rows dynamic grid ending on the current week
  const { gridWeeks, totalContributions, currentStreak, activityRate, startOfGrid, endOfWeek } = useMemo(() => {
    const dayMap = new Map<string, DayCell>();
    if (data?.days && data.days.length > 0) {
      data.days.forEach((d) => dayMap.set(d.date, d));
    }

    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
    // Ending Saturday of the current week to align full columns
    const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - currentDayOfWeek));
    // Start of the 52-week calendar matrix (Sunday 52*7-1 days prior)
    const startOfGrid = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate() - (52 * 7 - 1));

    const weeks: DayCell[][] = [];
    let calculatedTotal = 0;

    for (let w = 0; w < 52; w++) {
      const week: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startOfGrid.getFullYear(), startOfGrid.getMonth(), startOfGrid.getDate() + w * 7 + d);
        const dateStr = formatDateKey(currentDate);

        let cell: DayCell;
        if (dayMap.has(dateStr)) {
          cell = dayMap.get(dateStr)!;
        } else {
          // Strictly render genuine records without pseudo-random generator
          cell = {
            date: dateStr,
            count: 0,
            level: 0,
          };
        }

        calculatedTotal += cell.count;
        week.push(cell);
      }
      weeks.push(week);
    }

    return {
      gridWeeks: weeks,
      totalContributions: data?.total_contributions ?? calculatedTotal,
      currentStreak: data?.current_streak ?? 0,
      activityRate: data?.activity_rate ?? 0,
      startOfGrid,
      endOfWeek,
    };
  }, [data]);

  // Dynamic month labels across the 52 weeks
  const monthLabels = useMemo(() => {
    const labels: { name: string; col: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < 52; w++) {
      const d = new Date(startOfGrid.getFullYear(), startOfGrid.getMonth(), startOfGrid.getDate() + w * 7);
      const m = d.getMonth();
      if (m !== lastMonth) {
        if (labels.length === 0 || w - labels[labels.length - 1].col >= 3) {
          const name = d.toLocaleDateString('en-US', { month: 'short' });
          labels.push({ name, col: w });
          lastMonth = m;
        }
      }
    }
    return labels;
  }, [startOfGrid]);

  // Dynamic header year range
  const displayYearRange = useMemo(() => {
    if (yearRange && yearRange !== '2023-2024') return yearRange;
    const startY = startOfGrid.getFullYear();
    const endY = endOfWeek.getFullYear();
    return startY === endY ? `${startY}` : `${startY} - ${endY}`;
  }, [yearRange, startOfGrid, endOfWeek]);

  const getCellGlow = (level: number): string => {
    if (level === 5) {
      return '0 0 8px #00f0ff, 0 0 14px rgba(0, 240, 255, 0.5)';
    }
    if (level === 4) {
      return '0 0 5px rgba(192, 38, 211, 0.4)';
    }
    return 'none';
  };

  const formatDateDisplay = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Smart floating tooltip positioning with edge clamping
  const tooltipStyle = useMemo<React.CSSProperties | null>(() => {
    if (!coords) return null;
    
    // Default offsets
    let targetX = coords.x + 15;
    let targetY = coords.y + 15;
    
    // Basic edge clamping using viewport bounds (assume tooltip is roughly 120x60)
    if (typeof window !== 'undefined') {
      const tooltipWidth = 140;
      const tooltipHeight = 70;
      if (targetX + tooltipWidth > window.innerWidth) {
        targetX = coords.x - tooltipWidth - 10;
      }
      if (targetY + tooltipHeight > window.innerHeight) {
        targetY = coords.y - tooltipHeight - 10;
      }
    }

    return {
      left: `${targetX}px`,
      top: `${targetY}px`,
      willChange: 'left, top',
      transition: 'opacity 0.12s ease-out',
    };
  }, [coords]);

  if (isLoading) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-pulse">
        <div className="h-6 w-56 bg-white/10 rounded mb-6" />
        <div className="h-44 w-full bg-white/5 rounded-xl mb-6" />
        <div className="h-12 w-full bg-white/5 rounded" />
      </div>
    );
  }

  return (
    <div
      className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative select-none shrink-0"
      style={{
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base md:text-lg font-bold text-white tracking-wide flex items-center gap-2">
          Activity Heatmap <span className="text-slate-500 font-normal">|</span> {displayYearRange}
        </h3>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Streak Filter Button */}
          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === 'streak' ? 'all' : 'streak'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              activeFilter === 'streak'
                ? 'bg-purple-600/30 border-purple-500/60 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-purple-400" />
            <span>Streak</span>
          </button>

          {/* Heatmap Options Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsDropdown((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Heatmap Options</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showOptionsDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl py-1.5 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => setShowOptionsDropdown(false)}
                  className="w-full text-left px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  View {displayYearRange}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOptionsDropdown(false)}
                  className="w-full text-left px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  High Intensity Only
                </button>
                <button
                  type="button"
                  onClick={() => setShowOptionsDropdown(false)}
                  className="w-full text-left px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Export Activity Log
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Matrix Container (Horizontally Scrollable if screen is small) */}
      <div
        className="overflow-x-auto pb-2 scrollbar-thin"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className="min-w-[780px]">
          {/* Month Labels Header */}
          <div className="relative h-5 mb-1.5 pl-7 text-[11px] text-slate-400 font-normal select-none pointer-events-none">
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                className="absolute"
                style={{
                  left: `${(m.col / 52) * 100}%`,
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          {/* Days Grid with Day Labels on the Left */}
          <div className="flex gap-2">
            {/* Day of Week Labels (M, W, F) */}
            <div className="flex flex-col justify-between w-5 text-[10px] text-slate-500 font-medium select-none pt-0.5 pb-0.5 pointer-events-none">
              <span className="h-3.5 flex items-center leading-none opacity-0">S</span>
              <span className="h-3.5 flex items-center leading-none">M</span>
              <span className="h-3.5 flex items-center leading-none opacity-0">T</span>
              <span className="h-3.5 flex items-center leading-none">W</span>
              <span className="h-3.5 flex items-center leading-none opacity-0">T</span>
              <span className="h-3.5 flex items-center leading-none">F</span>
              <span className="h-3.5 flex items-center leading-none opacity-0">S</span>
            </div>

            {/* 52 Columns Grid */}
            <div className="flex-1 flex gap-[3.5px]">
              {gridWeeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3.5px] flex-1">
                  {week.map((cell, dIdx) => {
                    const isFiltered = activeFilter === 'streak' && cell.level === 0;
                    const cellColor = isFiltered ? '#121622' : TIER_COLORS[cell.level] || TIER_COLORS[0];
                    const glow = isFiltered ? 'none' : getCellGlow(cell.level);
                    const isCurrentActive = activeCell?.date === cell.date;

                    return (
                      <div
                        key={`${wIdx}-${dIdx}`}
                        className={`w-full aspect-square rounded-[3px] border border-white/[0.04] cursor-pointer relative transition-all duration-75 ${
                          isCurrentActive
                            ? 'ring-1 ring-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.6)] z-10 brightness-135'
                            : 'hover:brightness-125'
                        }`}
                        style={{
                          backgroundColor: cellColor,
                          boxShadow: isCurrentActive ? undefined : glow,
                        }}
                        onPointerEnter={() => {
                          setActiveCell({
                            date: cell.date,
                            count: cell.count,
                            level: cell.level,
                          });
                        }}
                        onMouseMove={(e) => {
                          updateCoords(e.clientX, e.clientY);
                          if (!activeCell || activeCell.date !== cell.date) {
                            setActiveCell({
                              date: cell.date,
                              count: cell.count,
                              level: cell.level,
                            });
                          }
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap Legend: Less [dots] More (Bottom Right) */}
          <div className="flex items-center justify-end gap-1.5 mt-3 text-xs text-slate-400 pointer-events-none">
            <span className="text-[11px] mr-1">Less</span>
            {[0, 1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className="w-2.5 h-2.5 rounded-[2px] border border-white/10"
                style={{
                  backgroundColor: TIER_COLORS[lvl],
                  boxShadow: lvl === 5 ? '0 0 6px #00f0ff' : 'none',
                }}
              />
            ))}
            <span className="text-[11px] ml-1">More</span>
          </div>
        </div>
      </div>

      {/* Floating Tooltip: Follows cursor at 60/120fps with zero sticking or offset */}
      {activeCell && tooltipStyle && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed pointer-events-none z-[9999] bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-2 shadow-[0_10px_25px_rgba(0,0,0,0.8)] text-center text-xs"
          style={tooltipStyle}
        >
          <div className="font-semibold text-white">
            {activeCell.count > 0
              ? `${activeCell.count} ${activeCell.count === 1 ? 'contribution' : 'contributions'}`
              : 'No contributions'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {formatDateDisplay(activeCell.date)}
          </div>
          <div className="text-[10px] text-cyan-400 font-medium mt-1">
            Tier {activeCell.level} Intensity
          </div>
        </div>,
        document.body
      )}

      {/* Bottom Summary Telemetry Row & Tier Breakdown */}
      <div className="mt-4">
        <DashboardMetricsRow
          contributions={totalContributions}
          currentStreak={currentStreak}
          activityRate={activityRate}
        />
      </div>
    </div>
  );
};

export default ActivityHeatmap;
