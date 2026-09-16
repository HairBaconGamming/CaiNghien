import { useState, useMemo } from 'react';
import { Clock, Calendar, CheckCircle2, X, Sparkles, AlertCircle, PlayCircle } from 'lucide-react';

export interface ScheduleConfig {
  enabled: boolean;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  days_of_week: number[]; // 0 = Sunday, 1 = Monday, 2 = Tuesday, ..., 6 = Saturday
}

interface ScheduleModalProps {
  schedule?: ScheduleConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newSchedule: ScheduleConfig) => void;
}

const DAYS_META = [
  { id: 1, label: 'T2', full: 'Thứ Hai' },
  { id: 2, label: 'T3', full: 'Thứ Ba' },
  { id: 3, label: 'T4', full: 'Thứ Tư' },
  { id: 4, label: 'T5', full: 'Thứ Năm' },
  { id: 5, label: 'T6', full: 'Thứ Sáu' },
  { id: 6, label: 'T7', full: 'Thứ Bảy' },
  { id: 0, label: 'CN', full: 'Chủ Nhật' },
];

export function isCurrentlyInSchedule(schedule?: ScheduleConfig): boolean {
  if (!schedule || !schedule.enabled) return false;
  if (!schedule.start_time || !schedule.end_time) return false;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  if (!schedule.days_of_week.includes(currentDay)) {
    return false;
  }

  const [sHour, sMin] = schedule.start_time.split(':').map(Number);
  const [eHour, eMin] = schedule.end_time.split(':').map(Number);

  const startMinutes = sHour * 60 + sMin;
  const endMinutes = eHour * 60 + eMin;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // Crosses midnight (e.g. 22:00 to 06:00)
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

export function getScheduleStatusInfo(schedule?: ScheduleConfig): {
  isActive: boolean;
  isEnabled: boolean;
  statusText: string;
  badgeClass: string;
} {
  if (!schedule || !schedule.enabled) {
    return {
      isActive: false,
      isEnabled: false,
      statusText: 'Lập lịch tự động đang tắt',
      badgeClass: 'status-badge-off'
    };
  }

  const active = isCurrentlyInSchedule(schedule);
  if (active) {
    return {
      isActive: true,
      isEnabled: true,
      statusText: 'ĐANG TRONG KHUNG GIỜ LÀM VIỆC — Tự động kích hoạt Hosts & DNS Cloudflare',
      badgeClass: 'status-badge-active'
    };
  }

  return {
    isActive: false,
    isEnabled: true,
    statusText: `Ngoài khung giờ làm việc — Khung giờ cài đặt: ${schedule.start_time} - ${schedule.end_time}`,
    badgeClass: 'status-badge-waiting'
  };
}

export function ScheduleModal({ schedule, isOpen, onClose, onSave }: ScheduleModalProps) {
  const [enabled, setEnabled] = useState<boolean>(schedule?.enabled ?? false);
  const [startTime, setStartTime] = useState<string>(schedule?.start_time || '08:00');
  const [endTime, setEndTime] = useState<string>(schedule?.end_time || '17:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    schedule?.days_of_week && schedule.days_of_week.length > 0
      ? schedule.days_of_week
      : [1, 2, 3, 4, 5] // Default: Mon to Fri
  );

  const currentStatus = useMemo(() => {
    return getScheduleStatusInfo({
      enabled,
      start_time: startTime,
      end_time: endTime,
      days_of_week: daysOfWeek
    });
  }, [enabled, startTime, endTime, daysOfWeek]);

  if (!isOpen) return null;

  const toggleDay = (dayId: number) => {
    if (daysOfWeek.includes(dayId)) {
      if (daysOfWeek.length > 1) {
        setDaysOfWeek(daysOfWeek.filter((d) => d !== dayId));
      }
    } else {
      setDaysOfWeek([...daysOfWeek, dayId].sort());
    }
  };

  const applyPreset = (presetType: 'office' | 'evening' | 'fulltime') => {
    switch (presetType) {
      case 'office':
        setEnabled(true);
        setStartTime('08:00');
        setEndTime('17:00');
        setDaysOfWeek([1, 2, 3, 4, 5]); // Mon - Fri
        break;
      case 'evening':
        setEnabled(true);
        setStartTime('19:30');
        setEndTime('22:30');
        setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]); // Every day
        break;
      case 'fulltime':
        setEnabled(true);
        setStartTime('07:00');
        setEndTime('23:00');
        setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]); // Every day
        break;
    }
  };

  const handleSave = () => {
    onSave({
      enabled,
      start_time: startTime,
      end_time: endTime,
      days_of_week: daysOfWeek
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content schedule-modal-content">
        <button onClick={onClose} className="modal-close" aria-label="Close">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="modal-header-with-icon">
          <div className="modal-icon-box cyan">
            <Clock size={28} />
          </div>
          <div>
            <h3 className="modal-title">Cấu hình Lập lịch Cố định</h3>
            <p className="modal-subtitle">
              Tự động kích hoạt Chặn Web & DNS Cloudflare trong khung giờ làm việc
            </p>
          </div>
        </div>

        {/* Live Status Banner */}
        <div className={`schedule-status-banner ${currentStatus.badgeClass}`}>
          <div className="status-pulse-dot" />
          <div className="status-banner-text">
            <strong>{currentStatus.statusText}</strong>
          </div>
        </div>

        {/* Master Toggle Switch */}
        <div className="schedule-section master-toggle-row">
          <div className="toggle-info">
            <span className="toggle-title">Kích hoạt Chế độ Lập lịch</span>
            <span className="toggle-desc">Hệ thống sẽ tự động bật bảo vệ theo đúng thời gian bên dưới</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="slider round" />
          </label>
        </div>

        {/* Quick Presets */}
        <div className="schedule-section">
          <div className="section-label">
            <Sparkles size={16} className="icon-cyan" />
            <span>Mẫu lịch trình gợi ý nhanh:</span>
          </div>
          <div className="preset-buttons-grid">
            <button
              type="button"
              className="preset-btn"
              onClick={() => applyPreset('office')}
            >
              <PlayCircle size={14} />
              <span>Hành chính (08:00 - 17:00, T2-T6)</span>
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => applyPreset('evening')}
            >
              <PlayCircle size={14} />
              <span>Tối chuyên sâu (19:30 - 22:30)</span>
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => applyPreset('fulltime')}
            >
              <PlayCircle size={14} />
              <span>Toàn thời gian (07:00 - 23:00)</span>
            </button>
          </div>
        </div>

        {/* Work Hours Config */}
        <div className="schedule-section">
          <div className="section-label">
            <Clock size={16} className="icon-cyan" />
            <span>Khung giờ làm việc / tập trung:</span>
          </div>
          <div className="time-pickers-row">
            <div className="time-field">
              <label>Giờ bắt đầu</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="time-input"
              />
            </div>
            <div className="time-separator">đến</div>
            <div className="time-field">
              <label>Giờ kết thúc</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="time-input"
              />
            </div>
          </div>
        </div>

        {/* Days of Week Config */}
        <div className="schedule-section">
          <div className="section-label">
            <Calendar size={16} className="icon-cyan" />
            <span>Các ngày áp dụng trong tuần:</span>
          </div>
          <div className="days-picker-row">
            {DAYS_META.map((day) => {
              const isSelected = daysOfWeek.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`day-circle-btn ${isSelected ? 'selected' : ''}`}
                  title={day.full}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hint */}
        <div className="schedule-hint-box">
          <AlertCircle size={16} className="icon-cyan" />
          <span>
            Khi trong khung giờ, nút Dừng bảo vệ sẽ bị khóa để đảm bảo kỷ luật tối đa.
          </span>
        </div>

        {/* Actions */}
        <div className="modal-btn-group" style={{ marginTop: '1.5rem' }}>
          <button onClick={onClose} className="btn-secondary">
            <span>Hủy bỏ</span>
          </button>
          <button onClick={handleSave} className="btn-primary-cyan">
            <CheckCircle2 size={18} />
            <span>Lưu Lịch trình</span>
          </button>
        </div>
      </div>
    </div>
  );
}
