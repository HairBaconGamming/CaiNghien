import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { 
  Play, 
  Sparkles, 
  Flame, 
  Maximize2, 
  Minimize2, 
  AlertTriangle, 
  CheckCircle2, 
  Award,
  Timer
} from 'lucide-react';

interface FocusRoomProps {
  isOpen: boolean;
  onExit: () => void;
  onSessionComplete?: (minutes: number) => void;
}

const DURATIONS = [
  { label: '15 phút', minutes: 15 },
  { label: '25 phút (Pomodoro)', minutes: 25 },
  { label: '45 phút', minutes: 45 },
  { label: '60 phút', minutes: 60 },
  { label: '90 phút', minutes: 90 },
];

const DISCIPLINE_QUOTES = [
  "Kỷ luật là cầu nối giữa mục tiêu và thành tựu đích thực.",
  "Chúng ta phải chịu đựng một trong hai nỗi đau: nỗi đau của sự kỷ luật hoặc nỗi đau của sự hối hận.",
  "Tập trung không phải là nói CÓ với điều bạn muốn làm, mà là nói KHÔNG với hàng trăm điều phân tâm khác.",
  "Chiến thắng vạn quân không bằng tự chiến thắng chính mình.",
  "Tâm trí tĩnh lặng như mặt nước hồ thu, không sóng gió nào lay chuyển được ý chí.",
  "Mỗi phút bạn kiên trì trong tĩnh lặng hôm nay là nền móng cho tự do ngày mai.",
  "Đừng để sự thoải mái tầm thường đánh cắp tương lai vĩ đại của bạn.",
  "Sức mạnh nội tâm bắt đầu từ khoảnh khắc bạn buông bỏ những điều vô nghĩa."
];

const EXIT_CONFIRMATION_TEXT = "Tôi chấp nhận kết thúc sớm phiên tập trung";

export function FocusRoom({ isOpen, onExit, onSessionComplete }: FocusRoomProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Exit challenge modal state
  const [showExitChallenge, setShowExitChallenge] = useState(false);
  const [exitTypedText, setExitTypedText] = useState('');
  const [exitCooldown, setExitCooldown] = useState(15);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enter / Exit Fullscreen & Tauri Keyboard Hook
  useEffect(() => {
    if (isOpen) {
      const enterRoom = async () => {
        try {
          const win = getCurrentWindow();
          await win.setFullscreen(true);
          await win.setAlwaysOnTop(true);
        } catch (e) {
          console.warn("Fullscreen window API not supported or mocked:", e);
        }

        try {
          await invoke('enter_focus_room');
        } catch (e) {
          console.warn("enter_focus_room IPC not available (backend mock/dev):", e);
        }
      };
      enterRoom();
    } else {
      const leaveRoom = async () => {
        try {
          await invoke('exit_focus_room');
        } catch (e) {
          console.warn("exit_focus_room IPC not available (backend mock/dev):", e);
        }

        try {
          const win = getCurrentWindow();
          await win.setFullscreen(false);
          await win.setAlwaysOnTop(false);
        } catch (e) {
          console.warn("Window API error:", e);
        }
      };
      leaveRoom();
    }
  }, [isOpen]);

  // Rotate quotes every 20 seconds
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % DISCIPLINE_QUOTES.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Main countdown timer
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsRunning(false);
          setIsCompleted(true);
          if (onSessionComplete) {
            onSessionComplete(selectedMinutes);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, selectedMinutes, onSessionComplete]);

  // Exit challenge 15s cooldown
  useEffect(() => {
    if (!showExitChallenge) return;
    setExitCooldown(15);
    setExitTypedText('');

    const interval = setInterval(() => {
      setExitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showExitChallenge]);

  if (!isOpen) return null;

  const handleStartSession = () => {
    setSecondsRemaining(selectedMinutes * 60);
    setIsRunning(true);
    setIsCompleted(false);
  };

  const handleSelectMinutes = (mins: number) => {
    if (!isRunning) {
      setSelectedMinutes(mins);
      setSecondsRemaining(mins * 60);
    }
  };

  const handleRequestExit = () => {
    if (isCompleted || !isRunning) {
      // Safe to exit directly if completed or not running
      onExit();
    } else {
      setShowExitChallenge(true);
    }
  };

  const handleConfirmEarlyExit = () => {
    if (exitTypedText === EXIT_CONFIRMATION_TEXT && exitCooldown === 0) {
      setShowExitChallenge(false);
      setIsRunning(false);
      onExit();
    }
  };

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalSessionSecs = selectedMinutes * 60;
  const progressRatio = totalSessionSecs > 0 ? (totalSessionSecs - secondsRemaining) / totalSessionSecs : 0;
  const strokeDashoffset = 880 - 880 * progressRatio;

  return (
    <div className="focus-room-container">
      {/* Background Cosmic Animations */}
      <div className="focus-room-backdrop" />
      <div className="focus-cosmic-glow-1" />
      <div className="focus-cosmic-glow-2" />

      {/* Top Bar with Minimal Header */}
      <div className="focus-room-topbar">
        <div className="focus-room-brand">
          <Sparkles size={20} className="icon-indigo" />
          <span>KHÔNG GIAN TĨNH TÂM (FOCUS ROOM)</span>
        </div>
        <button
          type="button"
          onClick={handleRequestExit}
          className="focus-room-exit-btn"
          title="Thoát Không gian Tĩnh tâm"
        >
          <Minimize2 size={18} />
          <span>Thoát</span>
        </button>
      </div>

      {/* Center Display: Breathing Orb & Timer */}
      <div className="focus-room-center">
        {isCompleted ? (
          <div className="focus-completion-box">
            <div className="completion-icon-wrapper">
              <Award size={64} className="icon-emerald" />
            </div>
            <h2 className="completion-title">PHIÊN TẬP TRUNG HOÀN THÀNH!</h2>
            <p className="completion-desc">
              Bạn đã hoàn thành xuất sắc {selectedMinutes} phút rèn luyện ý chí và giữ vững kỷ luật.
            </p>
            <div className="modal-btn-group" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsCompleted(false);
                  handleStartSession();
                }}
                className="btn-primary-cyan"
              >
                <Play size={18} />
                <span>Bắt đầu phiên mới</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="btn-secondary"
              >
                <span>Trở về Bảng điều khiển</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* SVG Circular Progress Ring */}
            <div className="focus-timer-wrapper">
              <svg className="focus-progress-svg" viewBox="0 0 300 300">
                <circle
                  className="focus-circle-bg"
                  cx="150"
                  cy="150"
                  r="140"
                />
                <circle
                  className="focus-circle-progress"
                  cx="150"
                  cy="150"
                  r="140"
                  style={{
                    strokeDasharray: 880,
                    strokeDashoffset: isRunning ? strokeDashoffset : 880
                  }}
                />
              </svg>

              {/* Cosmic Breathing Core */}
              <div className={`focus-breathing-orb ${isRunning ? 'pulsing' : ''}`}>
                <div className="focus-time-display">
                  {formatTime(secondsRemaining)}
                </div>
                <div className="focus-time-subtext">
                  {isRunning ? 'Đang tập trung cao độ' : 'Sẵn sàng bắt đầu'}
                </div>
              </div>
            </div>

            {/* Motivational Quote */}
            <div className="focus-quote-card">
              <p className="focus-quote-text">
                "{DISCIPLINE_QUOTES[quoteIndex]}"
              </p>
            </div>

            {/* Duration Selector & Controls (when idle) */}
            {!isRunning && (
              <div className="focus-setup-controls">
                <div className="duration-selector-row">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.minutes}
                      type="button"
                      onClick={() => handleSelectMinutes(d.minutes)}
                      className={`duration-pill ${selectedMinutes === d.minutes ? 'selected' : ''}`}
                    >
                      <Timer size={14} />
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleStartSession}
                  className="btn-focus-start"
                >
                  <Maximize2 size={20} />
                  <span>Bắt đầu Khóa màn hình & Tập trung</span>
                </button>
              </div>
            )}

            {isRunning && (
              <div className="focus-running-indicator">
                <div className="live-dot-green" />
                <span>Bàn phím và thanh tác vụ đang được bảo vệ bởi Low-level Hook</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Exit Challenge Modal */}
      {showExitChallenge && (
        <div className="modal-overlay focus-exit-overlay">
          <div className="modal-content rose focus-exit-modal">
            <div className="modal-icon-box rose">
              <AlertTriangle size={32} />
            </div>
            <h3 className="modal-title text-rose">Dừng sớm Phiên Tập trung?</h3>
            <p className="modal-text">
              Bạn đang ở trong Không gian Tĩnh tâm. Hãy dành {exitCooldown} giây để hít thở sâu và suy ngẫm trước khi đưa ra quyết định dừng lại.
            </p>

            <div className="exit-challenge-card">
              <span className="exit-prompt-label">Gõ lại chính xác câu này để xác nhận:</span>
              <div className="exit-target-text">
                "{EXIT_CONFIRMATION_TEXT}"
              </div>
              <input
                type="text"
                value={exitTypedText}
                onChange={(e) => setExitTypedText(e.target.value)}
                placeholder="Nhập lại văn bản trên..."
                className="form-input"
                autoComplete="off"
              />
            </div>

            <div className="modal-btn-group">
              <button
                type="button"
                onClick={() => setShowExitChallenge(false)}
                className="btn-secondary-emerald"
              >
                <Flame size={18} />
                <span>Tiếp tục phiên tập trung</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmEarlyExit}
                disabled={exitTypedText !== EXIT_CONFIRMATION_TEXT || exitCooldown > 0}
                className={`btn-danger ${exitTypedText !== EXIT_CONFIRMATION_TEXT || exitCooldown > 0 ? 'btn-disabled' : ''}`}
              >
                <CheckCircle2 size={18} />
                <span>
                  {exitCooldown > 0
                    ? `Suy ngẫm (${exitCooldown}s)`
                    : 'Xác nhận Thoát'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
