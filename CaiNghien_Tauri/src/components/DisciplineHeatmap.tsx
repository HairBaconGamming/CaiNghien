import { useState, useMemo } from 'react';
import { Flame, Calendar, Trophy, CheckCircle, Info } from 'lucide-react';

export interface DayHistoryItem {
  focus_minutes: number;
  violations: number;
  is_clean: boolean;
}

interface DisciplineHeatmapProps {
  dailyStats?: Record<string, number>;
  dailyHistory?: Record<string, DayHistoryItem>;
  currentStreak?: number;
}

interface DayCell {
  dateStr: string; // YYYY-MM-DD
  date: Date;
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  minutes: number;
  isClean: boolean;
  violations: number;
  level: number; // 0, 1, 2, 3, 4
}

const WEEKS_TO_SHOW = 20; // ~140 days (approx 4.5 months)
const CELL_SIZE = 12;
const CELL_GAP = 3;
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6',
  'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'
];

export function DisciplineHeatmap({ dailyStats = {}, dailyHistory = {}, currentStreak = 0 }: DisciplineHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{
    day: DayCell;
    x: number;
    y: number;
  } | null>(null);

  // Helper to format Date to YYYY-MM-DD local
  const toDateStr = (d: Date): string => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  };

  // Build grid data for the last WEEKS_TO_SHOW weeks
  const { weeks, statsSummary } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // End on the current week's Sunday
    // JS getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Convert so 0 = Mon, 6 = Sun
    const jsDay = today.getDay();
    const currentDayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0 = Mon ... 6 = Sun

    // Calculate start date: (WEEKS_TO_SHOW - 1) weeks ago on Monday
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDayOfWeek - (WEEKS_TO_SHOW - 1) * 7);

    const weekList: DayCell[][] = [];
    let curDate = new Date(startDate);
    let totalMinutes = 0;
    let disciplinedDays = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const daysInWeek: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = toDateStr(curDate);
        const isFuture = curDate > today;

        let minutes = 0;
        let violations = 0;
        let isClean = true;

        if (!isFuture) {
          if (dailyHistory[dateStr]) {
            minutes = dailyHistory[dateStr].focus_minutes || 0;
            violations = dailyHistory[dateStr].violations || 0;
            isClean = dailyHistory[dateStr].is_clean;
          } else if (dailyStats[dateStr]) {
            minutes = dailyStats[dateStr] || 0;
            violations = 0;
            isClean = minutes > 0;
          }
        }

        // Intensity level: 0 to 4
        let level = 0;
        if (minutes > 0 || (!isFuture && isClean && minutes > 0)) {
          if (minutes > 360) level = 4;
          else if (minutes > 180) level = 3;
          else if (minutes > 60) level = 2;
          else level = 1;
        }

        if (!isFuture) {
          totalMinutes += minutes;
          if (minutes > 0) {
            disciplinedDays++;
            tempStreak++;
            if (tempStreak > maxStreak) maxStreak = tempStreak;
          } else {
            tempStreak = 0;
          }
        }

        daysInWeek.push({
          dateStr,
          date: new Date(curDate),
          dayOfWeek: d,
          minutes,
          isClean,
          violations,
          level: isFuture ? 0 : level
        });

        curDate.setDate(curDate.getDate() + 1);
      }
      weekList.push(daysInWeek);
    }

    return {
      weeks: weekList,
      statsSummary: {
        totalMinutes,
        disciplinedDays,
        longestStreak: Math.max(maxStreak, currentStreak),
        totalHours: (totalMinutes / 60).toFixed(1)
      }
    };
  }, [dailyStats, dailyHistory, currentStreak]);

  // Generate Month header labels
  const monthLabels = useMemo(() => {
    const labels: { text: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, wIdx) => {
      const firstDayOfWeek = week[0].date;
      const month = firstDayOfWeek.getMonth();
      if (month !== lastMonth) {
        labels.push({
          text: MONTH_NAMES[month],
          weekIndex: wIdx
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  const formatVietnameseDate = (d: Date): string => {
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const dayName = dayNames[d.getDay()];
    const date = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${dayName}, ${date}/${month}/${year}`;
  };

  const formatMinutes = (mins: number): string => {
    if (mins === 0) return '0 phút';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
    if (h > 0) return `${h} giờ`;
    return `${m} phút`;
  };

  const getCellColor = (level: number): string => {
    switch (level) {
      case 4: return '#10b981'; // Level 4: Emerald glow solid
      case 3: return 'rgba(16, 185, 129, 0.8)';
      case 2: return 'rgba(16, 185, 129, 0.55)';
      case 1: return 'rgba(16, 185, 129, 0.3)';
      default: return 'rgba(255, 255, 255, 0.05)';
    }
  };

  const getCellGlow = (level: number): string => {
    switch (level) {
      case 4: return 'drop-shadow(0px 0px 4px rgba(16, 185, 129, 0.9))';
      case 3: return 'drop-shadow(0px 0px 2px rgba(16, 185, 129, 0.6))';
      default: return 'none';
    }
  };

  const gridWidth = WEEKS_TO_SHOW * (CELL_SIZE + CELL_GAP) + 36;
  const gridHeight = 7 * (CELL_SIZE + CELL_GAP) + 24;

  return (
    <div className="discipline-heatmap-card">
      {/* Header */}
      <div className="heatmap-header">
        <div className="heatmap-title-box">
          <Calendar size={18} className="icon-emerald" />
          <h3 className="heatmap-title">Biểu đồ Kỷ luật Hàng ngày (Heatmap)</h3>
          <span className="heatmap-badge">20 Tuần gần nhất</span>
        </div>
        <div className="heatmap-legend">
          <span className="legend-label">Ít</span>
          <span className="legend-cell level-0" title="0 phút" />
          <span className="legend-cell level-1" title="1 - 60 phút" />
          <span className="legend-cell level-2" title="61 - 180 phút" />
          <span className="legend-cell level-3" title="181 - 360 phút" />
          <span className="legend-cell level-4" title="> 360 phút" />
          <span className="legend-label">Nhiều</span>
        </div>
      </div>

      {/* SVG Heatmap Grid */}
      <div className="heatmap-scroll-wrapper custom-scrollbar">
        <svg
          className="heatmap-svg"
          width={gridWidth}
          height={gridHeight}
          style={{ overflow: 'visible' }}
        >
          {/* Month Labels */}
          {monthLabels.map((ml, idx) => (
            <text
              key={idx}
              x={32 + ml.weekIndex * (CELL_SIZE + CELL_GAP)}
              y={10}
              className="heatmap-month-text"
              fill="#94a3b8"
              fontSize={10}
            >
              {ml.text}
            </text>
          ))}

          {/* Day of Week Labels (T2, T4, T6, CN) */}
          {DAY_LABELS.map((dayLabel, dIdx) => (
            dIdx % 2 === 0 ? (
              <text
                key={dIdx}
                x={2}
                y={20 + dIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
                className="heatmap-day-text"
                fill="#64748b"
                fontSize={9}
              >
                {dayLabel}
              </text>
            ) : null
          ))}

          {/* Heatmap Cells */}
          {weeks.map((week, wIdx) =>
            week.map((cell, dIdx) => {
              const x = 30 + wIdx * (CELL_SIZE + CELL_GAP);
              const y = 16 + dIdx * (CELL_SIZE + CELL_GAP);
              const isToday = cell.dateStr === toDateStr(new Date());

              return (
                <rect
                  key={`${wIdx}-${dIdx}`}
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2.5}
                  ry={2.5}
                  fill={getCellColor(cell.level)}
                  stroke={isToday ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}
                  strokeWidth={isToday ? 1.5 : 1}
                  style={{
                    filter: getCellGlow(cell.level),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredDay({
                      day: cell,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8
                    });
                  }}
                  onMouseLeave={() => setHoveredDay(null)}
                />
              );
            })
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredDay && (
          <div
            className="heatmap-floating-tooltip"
            style={{
              position: 'fixed',
              left: `${hoveredDay.x}px`,
              top: `${hoveredDay.y}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999
            }}
          >
            <div className="tooltip-date">
              {formatVietnameseDate(hoveredDay.day.date)}
            </div>
            <div className="tooltip-detail">
              <span className="tooltip-time">
                ⏱ {formatMinutes(hoveredDay.day.minutes)}
              </span>
              <span className={`tooltip-status ${hoveredDay.day.minutes > 0 ? 'clean' : 'idle'}`}>
                {hoveredDay.day.minutes > 0 ? '🔥 Giữ vững kỷ luật' : 'Chưa ghi nhận'}
              </span>
            </div>
            {hoveredDay.day.violations > 0 && (
              <div className="tooltip-violation">
                ⚠️ Vi phạm: {hoveredDay.day.violations} lần
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Footer Badges */}
      <div className="heatmap-summary-row">
        <div className="heatmap-stat-item">
          <div className="stat-item-label">
            <Flame size={14} className="icon-emerald" /> Chuỗi hiện tại
          </div>
          <div className="stat-item-val emerald">{currentStreak} ngày</div>
        </div>
        <div className="heatmap-stat-item">
          <div className="stat-item-label">
            <Trophy size={14} className="icon-amber" /> Kỷ lục chuỗi
          </div>
          <div className="stat-item-val amber">{statsSummary.longestStreak} ngày</div>
        </div>
        <div className="heatmap-stat-item">
          <div className="stat-item-label">
            <CheckCircle size={14} className="icon-indigo" /> Ngày kỷ luật
          </div>
          <div className="stat-item-val indigo">{statsSummary.disciplinedDays} ngày</div>
        </div>
        <div className="heatmap-stat-item">
          <div className="stat-item-label">
            <Info size={14} className="icon-cyan" /> Tổng thời gian
          </div>
          <div className="stat-item-val cyan">{statsSummary.totalHours} giờ</div>
        </div>
      </div>
    </div>
  );
}
