import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { 
  Maximize2, 
  Minimize2, 
  X, 
  Award, 
  Flame, 
  Play, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  GraduationCap
} from 'lucide-react';

import { TimerRing } from './TimerRing';
import { MotivationalQuote } from './MotivationalQuote';
import { MusicWidget } from './MusicWidget';
import { StudyHarvestReportModal } from './StudyHarvestReportModal';
import { api, AppConfig, StudyRewardResult } from '../../services/api';

export interface FocusSessionResult {
  success?: boolean;
  xp_earned?: number;
  new_streak?: number;
  today_count?: number;
}

export interface FocusRoomScreenProps {
  isOpen?: boolean;
  initialMinutes?: number;
  onExit?: () => void;
  onSessionComplete?: (minutes: number, xpEarned: number) => void;
  onRequestTypingChallenge?: () => void;
}

const EXIT_PLEDGE_TEXT = "Tôi chấp nhận kết thúc sớm phiên tập trung";

export const FocusRoomScreen: React.FC<FocusRoomScreenProps> = ({
  isOpen = true,
  initialMinutes = 25,
  onExit,
  onSessionComplete,
  onRequestTypingChallenge,
}) => {
  // Session Configuration & State
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [secondsRemaining, setSecondsRemaining] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Study Mode & Harvest Modal States
  const [isStudyMode, setIsStudyMode] = useState<boolean>(false);
  const [showHarvestModal, setShowHarvestModal] = useState<boolean>(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  // Load config for conversion ratios
  useEffect(() => {
    api.getAppConfig().then((c) => {
      if (c) setAppConfig(c);
    }).catch(() => {});
  }, []);

  const studyRequired = appConfig?.study_minutes_required ?? 60;
  const rewardQuota = appConfig?.reward_quota_minutes ?? 15;

  const rewardForecast = useMemo(() => {
    const duration = Math.max(0, Math.floor(Number(selectedMinutes)) || 0);
    const req = Math.max(1, Math.floor(Number(studyRequired)) || 60);
    const reward = Math.max(0, Math.floor(Number(rewardQuota)) || 15);
    return Math.floor((duration / req) * reward);
  }, [selectedMinutes, studyRequired, rewardQuota]);

  const minMinutesForOneReward = useMemo(() => {
    const req = Math.max(1, Math.floor(Number(studyRequired)) || 60);
    const reward = Math.max(0, Math.floor(Number(rewardQuota)) || 15);
    return reward > 0 ? Math.ceil(req / reward) : 0;
  }, [studyRequired, rewardQuota]);

  // Gamification & Completion Results
  const [xpEarned, setXpEarned] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(128);

  // Early Exit Safeguard Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPledgeInput, setExitPledgeInput] = useState('');
  const [exitCooldown, setExitCooldown] = useState(15);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synchronize when initialMinutes prop changes
  useEffect(() => {
    if (!isRunning && !isCompleted) {
      setSelectedMinutes(initialMinutes);
      setTotalSeconds(initialMinutes * 60);
      setSecondsRemaining(initialMinutes * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMinutes]);

  // Handle Fullscreen & Kiosk Lock Hooks with Tauri Backend
  useEffect(() => {
    if (!isOpen) return;

    const setupKiosk = async () => {
      try {
        const win = getCurrentWindow();
        await win.setFullscreen(true);
        await win.setAlwaysOnTop(true);
        setIsFullscreen(true);
      } catch (e) {
        // Fallback for standard browser environment
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
          } catch {
            // Browser policy may require direct user gesture
          }
        }
      }

      try {
        await invoke('enter_focus_room', { duration_minutes: selectedMinutes });
      } catch (e) {
        console.warn('[FocusRoom] enter_focus_room IPC fallback:', e);
      }
    };

    setupKiosk();

    return () => {
      // Release hooks on cleanup
      const releaseKiosk = async () => {
        try {
          await invoke('exit_focus_room', { completed: false, minutes_elapsed: 0 });
        } catch {
          // Fallback
        }

        try {
          const win = getCurrentWindow();
          await win.setFullscreen(false);
          await win.setAlwaysOnTop(false);
        } catch {
          if (document.fullscreenElement && document.exitFullscreen) {
            try {
              await document.exitFullscreen();
            } catch {
              // Ignore
            }
          }
        }
      };
      releaseKiosk();
    };
  }, [isOpen]);

  // Main Countdown Timer Interval
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSessionCompletion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, selectedMinutes]);

  // Early Exit 15-second Cooldown Timer
  useEffect(() => {
    if (!showExitModal) return;
    setExitCooldown(15);
    setExitPledgeInput('');

    const cooldownTimer = setInterval(() => {
      setExitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(cooldownTimer);
  }, [showExitModal]);

  // Play Harmonic Victory Chime via Web Audio API on session completion
  const playVictoryChime = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const chimeNotes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

      chimeNotes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + index * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + index * 0.12);
        osc.stop(ctx.currentTime + index * 0.12 + 1.3);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Handle Session Completion
  const handleSessionCompletion = async () => {
    setIsRunning(false);

    // Study Mode interceptor: do NOT show standard celebration modal
    if (isStudyMode) {
      playVictoryChime();
      setShowHarvestModal(true);
      return;
    }

    setIsCompleted(true);
    playVictoryChime();

    const earned = selectedMinutes * 10; // 10 XP per minute
    setXpEarned(earned);

    // Call Rust Backend to record session and update heatmap
    try {
      const res = await invoke<FocusSessionResult>('record_focus_session', {
        duration_minutes: selectedMinutes,
        session_type: 'deep_focus',
      });
      if (res?.xp_earned) {
        setXpEarned(res.xp_earned);
      }
      if (res?.new_streak) {
        setCurrentStreak(res.new_streak);
      }
    } catch (e) {
      console.warn('[FocusRoom] record_focus_session IPC fallback:', e);
      setCurrentStreak((prev) => prev + 1);
    }

    try {
      await invoke('exit_focus_room', { completed: true, minutes_elapsed: selectedMinutes });
    } catch {
      // Fallback
    }

    onSessionComplete?.(selectedMinutes, earned);
  };

  // Handle Harvest Report Submission Success
  const handleHarvestSuccess = async (result: StudyRewardResult) => {
    setShowHarvestModal(false);
    playVictoryChime();

    if (result.xp_earned) {
      setXpEarned(result.xp_earned);
    }
    setCurrentStreak((prev) => prev + 1);

    try {
      await invoke('exit_focus_room', { completed: true, minutes_elapsed: selectedMinutes });
    } catch {
      // Fallback
    }

    onSessionComplete?.(selectedMinutes, result.xp_earned);
    handleReset();
  };

  // Toggle Play / Pause
  const handleTogglePlayPause = () => {
    if (isCompleted) {
      // Start fresh session if completed
      setIsCompleted(false);
      setSecondsRemaining(selectedMinutes * 60);
      setTotalSeconds(selectedMinutes * 60);
      setIsRunning(true);
      return;
    }

    if (!isRunning) {
      // Starting or resuming session
      setIsRunning(true);
      try {
        invoke('enter_focus_room', { duration_minutes: selectedMinutes }).catch(() => {});
      } catch {
        // Fallback
      }
    } else {
      // Pausing session
      setIsRunning(false);
    }
  };

  // Reset Timer
  const handleReset = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setSecondsRemaining(selectedMinutes * 60);
    setTotalSeconds(selectedMinutes * 60);
  };

  // Select Duration
  const handleSelectDuration = (mins: number) => {
    if (!isRunning) {
      setSelectedMinutes(mins);
      setTotalSeconds(mins * 60);
      setSecondsRemaining(mins * 60);
      setIsCompleted(false);
    }
  };

  // Toggle Fullscreen Mode
  const handleToggleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const current = await win.isFullscreen();
      await win.setFullscreen(!current);
      setIsFullscreen(!current);
    } catch {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
      } else {
        document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Request Exit Screen
  const handleRequestExit = () => {
    if (isRunning && !isCompleted && secondsRemaining > 0) {
      // Impose mindful exit friction: either trigger typing challenge modal or show exit pledge modal
      if (onRequestTypingChallenge) {
        onRequestTypingChallenge();
      } else {
        setShowExitModal(true);
      }
    } else {
      // Safe to exit immediately
      executeExit();
    }
  };

  // Confirm Early Exit after pledge & cooldown
  const handleConfirmEarlyExit = () => {
    if (exitPledgeInput.trim() === EXIT_PLEDGE_TEXT && exitCooldown === 0) {
      setShowExitModal(false);
      setIsRunning(false);
      executeExit();
    }
  };

  const executeExit = async () => {
    try {
      const elapsedMins = Math.round((totalSeconds - secondsRemaining) / 60);
      await invoke('exit_focus_room', { completed: isCompleted, minutes_elapsed: elapsedMins });
    } catch {
      // Fallback
    }
    onExit?.();
  };

  // Generate 80 randomized background stars
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${(i * 1.27 * 79) % 100}%`,
      top: `${(i * 3.14 * 61) % 100}%`,
      size: `${1 + ((i * 7) % 3)}px`,
      opacity: 0.2 + ((i * 13) % 80) / 100,
      duration: `${3 + (i % 4)}s`,
      delay: `${(i % 5) * 0.7}s`,
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden select-none z-50 flex flex-col justify-between bg-[#030712] font-sans">
      {/* ------- */}
      {/* 1. DEEP SPACE COSMOS BACKGROUND (Matches cain_focus_room.jpg 100%)       */}
      {/* ------- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Base Cosmos Gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, #0a1128 0%, #060b1b 45%, #030611 100%)',
          }}
        />

        {/* Glowing Nebula Halos */}
        {/* Cyan / Blue Nebula (Left region matching mockup) */}
        <div 
          className="absolute -top-1/4 -left-1/4 w-[85vw] h-[85vh] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.18) 0%, rgba(30, 64, 175, 0.12) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Purple / Galactic Magenta Nebula (Right region & Milky Way band matching mockup) */}
        <div 
          className="absolute top-1/4 -right-1/4 w-[95vw] h-[95vh] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.16) 0%, rgba(217, 70, 239, 0.10) 35%, rgba(67, 56, 202, 0.08) 60%, transparent 75%)',
            filter: 'blur(90px)',
          }}
        />

        {/* Vortex Behind Timer Ring */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.09) 0%, rgba(124, 58, 237, 0.07) 50%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Twinkling Starfield */}
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white pointer-events-none animate-pulse"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              animationDuration: star.duration,
              animationDelay: star.delay,
              boxShadow: star.size === '3px' ? '0 0 6px rgba(255, 255, 255, 0.9)' : 'none',
            }}
          />
        ))}
      </div>

      {/* ------- */}
      {/* 2. TOP REGION (Spacing for Zen Immersion)                                  */}
      {/* ------- */}
      <div className="relative z-10 w-full pt-8 px-8 flex items-center justify-between pointer-events-none">
        <div className="opacity-0">Focus Guard</div>
      </div>

      {/* ------- */}
      {/* 3. CENTER REGION: TIMER RING & MOTIVATIONAL QUOTE                         */}
      {/* ------- */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-4">
        {/* Mode Selector Segmented Toggle Pills */}
        <div className="mb-5 flex flex-col items-center gap-2.5 pointer-events-auto">
          <div 
            className="flex items-center p-1 rounded-2xl border border-white/10 backdrop-blur-md shadow-lg"
            style={{ background: 'rgba(15, 23, 42, 0.7)' }}
          >
            <button
              type="button"
              onClick={() => !isRunning && setIsStudyMode(false)}
              disabled={isRunning}
              title={isRunning ? "Đang chạy phiên tập trung - Không thể đổi chế độ" : "Chuyển sang chế độ Tập trung sâu"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                !isStudyMode
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              } ${isRunning ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <Sparkles size={14} className={!isStudyMode ? 'text-cyan-400' : 'text-slate-400'} />
              <span>Tập trung sâu</span>
            </button>

            <button
              type="button"
              onClick={() => !isRunning && setIsStudyMode(true)}
              disabled={isRunning}
              title={isRunning ? "Đang chạy phiên tập trung - Không thể đổi chế độ" : "Chuyển sang Chế độ Học tập"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isStudyMode
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              } ${isRunning ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <GraduationCap size={15} className={isStudyMode ? 'text-amber-400' : 'text-slate-400'} />
              <span>Chế độ Học tập (Study-to-Earn)</span>
            </button>
          </div>

          {/* Dynamic Real-time Reward Forecast Badge */}
          {isStudyMode && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-fade-in">
              <GraduationCap size={14} className="shrink-0 text-amber-400" />
              <span>
                {rewardForecast > 0 ? (
                  <>
                    🎓 Dự kiến nhận: <strong className="font-bold text-amber-200 font-mono">+{rewardForecast} phút</strong> giải trí khi hoàn thành (Tỷ lệ: {studyRequired}p học = {rewardQuota}p chơi)
                  </>
                ) : (
                  <>
                    ⚠️ Dự kiến nhận: 0 phút giải trí (Cần học tối thiểu {minMinutesForOneReward} phút để nhận 1 phút thưởng)
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Central Circular Timer Ring */}
        <TimerRing
          secondsRemaining={secondsRemaining}
          totalSeconds={totalSeconds}
          isRunning={isRunning}
          selectedMinutes={selectedMinutes}
          onTogglePlayPause={handleTogglePlayPause}
          onReset={handleReset}
          onSelectDuration={handleSelectDuration}
          availableDurations={[15, 25, 45, 60, 90]}
        />

        {/* Motivational Zen Quote Card */}
        <div className="mt-8">
          <MotivationalQuote intervalMs={24000} />
        </div>
      </div>

      {/* ------- */}
      {/* 4. BOTTOM BAR CONTROLS (Matches cain_focus_room.jpg 100%)                  */}
      {/* ------- */}
      <div className="relative z-10 w-full pb-8 px-8 flex items-center justify-between pointer-events-auto">
        {/* Left Control: AMBIENCE & Center: AUDIO PILLS */}
        <div className="flex-1">
          <MusicWidget />
        </div>

        {/* Right Controls: Fullscreen Toggle & Exit Buttons */}
        <div className="flex items-center gap-3 ml-4">
          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer text-slate-300 hover:text-white"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Close / Exit Button matching cain_focus_room.jpg */}
          <button
            type="button"
            onClick={handleRequestExit}
            title="Thoát Không Gian Tĩnh Tâm"
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer text-slate-300 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ------- */}
      {/* 5. CELEBRATION SUMMARY MODAL (Upon Session Completion)                     */}
      {/* ------- */}
      {isCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl animate-fade-in">
          <div 
            className="relative w-[480px] max-w-[92vw] rounded-3xl p-8 text-center overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(7, 12, 30, 0.98) 100%)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              boxShadow: '0 0 50px rgba(0, 240, 255, 0.25)',
            }}
          >
            {/* Top Glowing Trophy Icon */}
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-cyan-500/20 border border-cyan-400/50 shadow-[0_0_25px_rgba(0,240,255,0.4)]">
              <Award size={36} className="text-cyan-300 animate-bounce" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-wide uppercase">
              PHIÊN TẬP TRUNG HOÀN THÀNH!
            </h2>

            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Bạn đã hoàn thành xuất sắc <span className="text-cyan-300 font-bold">{selectedMinutes} phút</span> rèn luyện ý chí và kỷ luật thép trong không gian vũ trụ.
            </p>

            {/* Metrics Earned Row */}
            <div className="grid grid-cols-2 gap-3 my-6">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-cyan-400 font-extrabold text-xl font-mono">
                  <Sparkles size={18} />
                  <span>+{xpEarned}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  XP Nhận Được
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xl font-mono">
                  <Flame size={18} />
                  <span>{currentStreak} Ngày</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  Chuỗi Kỷ Luật
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-wider uppercase text-white bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 border border-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Play size={16} className="fill-white" />
                <span>Bắt Đầu Phiên Mới</span>
              </button>

              <button
                type="button"
                onClick={executeExit}
                className="py-3 px-5 rounded-xl font-semibold text-sm text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all cursor-pointer"
              >
                Trở Về
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------- */}
      {/* 6. MINDFUL EARLY EXIT CONFIRMATION MODAL                                  */}
      {/* ------- */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-fade-in">
          <div 
            className="relative w-[480px] max-w-[92vw] rounded-3xl p-7 text-center overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              boxShadow: '0 0 50px rgba(244, 63, 94, 0.2)',
            }}
          >
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-rose-500/20 border border-rose-500/40 text-rose-400">
              <AlertTriangle size={28} />
            </div>

            <h3 className="text-xl font-bold text-white tracking-wide">
              Dừng Sớm Phiên Tập Trung?
            </h3>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Bạn đang ở trong Không Gian Tĩnh Tâm. Hãy dành {exitCooldown} giây để hít thở sâu và cân nhắc trước khi phá vỡ cam kết với chính mình.
            </p>

            <div className="mt-5 p-4 rounded-2xl bg-slate-950/60 border border-white/10 text-left">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1.5">
                Nhập lại chính xác câu sau để xác nhận:
              </span>
              <div className="text-xs font-mono font-bold text-slate-200 bg-white/5 p-2 rounded-lg mb-2.5 select-none">
                "{EXIT_PLEDGE_TEXT}"
              </div>
              <input
                type="text"
                value={exitPledgeInput}
                onChange={(e) => setExitPledgeInput(e.target.value)}
                placeholder="Nhập lại câu trên để xác nhận..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Flame size={15} />
                <span>Tiếp Tục Rèn Luyện</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmEarlyExit}
                disabled={exitPledgeInput.trim() !== EXIT_PLEDGE_TEXT || exitCooldown > 0}
                className={`
                  py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5
                  ${exitPledgeInput.trim() === EXIT_PLEDGE_TEXT && exitCooldown === 0
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                    : 'bg-slate-800/80 text-slate-500 border border-white/5 cursor-not-allowed'
                  }
                `}
              >
                <CheckCircle2 size={15} />
                <span>{exitCooldown > 0 ? `Chờ (${exitCooldown}s)` : 'Xác Nhận Thoát'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------- */}
      {/* 7. STUDY HARVEST REPORT MODAL (Proof of Work)                               */}
      {/* ------- */}
      {showHarvestModal && (
        <StudyHarvestReportModal
          isOpen={showHarvestModal}
          studyDurationMinutes={selectedMinutes}
          studyRequired={studyRequired}
          rewardQuota={rewardQuota}
          onSuccess={handleHarvestSuccess}
        />
      )}
    </div>
  );
};
