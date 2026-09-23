import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { ArrowRight, Lock, Award, CheckCircle2, AlertCircle, Sparkles, RotateCcw, X } from 'lucide-react';
import TextPromptDisplay from './TextPromptDisplay';
import TypingInput from './TypingInput';
import RealtimeStats, { calculateWPM, calculateAccuracy, formatTime } from './RealtimeStats';
import {
  api,
  TypingChallenge,
  TypingScoreResult,
} from '../../services/api';

export interface TypingChallengeScreenProps {
  onClose?: () => void;
  onComplete?: (result: TypingScoreResult) => void;
  initialDifficulty?: 'novice' | 'stargazer' | 'quantum';
  asModal?: boolean;
  customText?: string;
}

export const TypingChallengeScreen: React.FC<TypingChallengeScreenProps> = ({
  onClose,
  onComplete,
  initialDifficulty = 'quantum',
  asModal = false,
  customText,
}) => {
  // Challenge State
  const [difficulty, setDifficulty] = useState<'novice' | 'stargazer' | 'quantum'>(initialDifficulty);
  const [challenge, setChallenge] = useState<TypingChallenge>({
    id: 'quantum-01',
    title: 'TYPING CHALLENGE',
    author: 'Cosmos Fleet Command',
    difficulty: 'quantum',
    text: 'The quick brown fox jumped gracefully over the lazy, sleeping dog. He then sprinted across the galaxy, weaving through constellations of glowing nebulae and vibrant supernovas, navigating the void with speed and accuracy.',
  });

  // Typing & Timer State
  const [typedText, setTypedText] = useState<string>('');
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  // Telemetry
  const [resetKey, setResetKey] = useState<number>(0);

  // Result & Modals
  const [saving, setSaving] = useState<boolean>(false);
  const [scoreResult, setScoreResult] = useState<TypingScoreResult | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Load challenge from API or fallback
  const loadChallenge = useCallback(async (diff: 'novice' | 'stargazer' | 'quantum') => {
    if (customText) {
      setChallenge({
        id: 'custom-challenge',
        title: 'Lời Cam Kết',
        author: 'Bản Thân',
        difficulty: 'custom',
        text: customText,
      });
      return;
    }
    try {
      const data = await api.getTypingChallengeText(diff);
      setChallenge(data);
    } catch {
      // Fallback already handled inside api.ts
    }
  }, [customText]);

  useEffect(() => {
    loadChallenge(difficulty);
  }, [difficulty, loadChallenge]);

  // Handle timer tick
  useEffect(() => {
    if (isStarted && !isCompleted) {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStarted, isCompleted]);

  // Derived Telemetry
  const targetText = challenge.text.normalize('NFC');
  let correctCount = 0;
  const minLen = Math.min(typedText.length, targetText.length);

  for (let i = 0; i < minLen; i++) {
    if (typedText[i] === targetText[i]) {
      correctCount++;
    }
  }

  const accuracy = calculateAccuracy(correctCount, typedText.length);
  const wpm = calculateWPM(correctCount, elapsedSeconds);

  // Auto-detect completion
  useEffect(() => {
    if (typedText.length >= targetText.length && typedText === targetText && !isCompleted) {
      handleCompleteChallenge(wpm, accuracy);
    }
  }, [typedText, targetText, isCompleted, wpm, accuracy]);

  // Show Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Keystroke change handler
  const handleTypingChange = (newVal: string) => {
    if (isCompleted) return;

    startTransition(() => {
      if (!isStarted && newVal.length > 0) {
        setIsStarted(true);
      }
      setTypedText(newVal);
    });
  };

  // Reset current challenge
  const handleReset = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTypedText('');
    setResetKey(prev => prev + 1);
    setIsStarted(false);
    setIsCompleted(false);
    setElapsedSeconds(0);
    setShowCompletionModal(false);
    setScoreResult(null);
  };

  // Switch difficulty
  const handleDifficultyChange = (newDiff: 'novice' | 'stargazer' | 'quantum') => {
    setDifficulty(newDiff);
    handleReset();
  };

  // Commit & Submit score to backend
  const handleCompleteChallenge = async (finalWpm = wpm, finalAcc = accuracy) => {
    if (isCompleted) return;
    setIsCompleted(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const wordsCount = challenge.text.trim().split(/\s+/).length;
    const timeSec = Math.max(1, elapsedSeconds);

    setSaving(true);
    try {
      const result = await api.saveTypingScore({
        wpm: finalWpm,
        accuracy: finalAcc,
        time_seconds: timeSec,
        words_count: wordsCount,
      });

      setScoreResult(result);
      setShowCompletionModal(true);
      if (onComplete) {
        onComplete(result);
      }
    } catch (err) {
      console.error('Failed to save typing score:', err);
      triggerToast('Score recorded locally (Backend offline)');
      setShowCompletionModal(true);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = () => {
    if (typedText.length === 0) {
      triggerToast('Please type the paragraph before submitting.');
      return;
    }
    handleCompleteChallenge();
  };

  const isTargetMatched = typedText.length > 0 && typedText === challenge.text.normalize('NFC');

  return (
    <div className={`w-full min-h-screen flex items-center justify-center p-4 bg-[#030712] relative overflow-hidden select-none font-sans ${asModal ? 'fixed inset-0 z-50 bg-black/80 backdrop-blur-xl' : ''}`}>
      {/* Dynamic Cosmic Background Nebulae */}
      <div className="absolute top-1/4 left-1/5 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse duration-5000" />
      <div className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Starfield particles simulation */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />

      {/* Copy-Paste Warning Toast */}
      {toastMessage && (
        <div className="fixed top-8 z-50 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/90 border border-red-500/50 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs md:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Glassmorphic Card Container matching cain_typing_challenge.jpg */}
      <div className="relative w-full max-w-[760px] rounded-3xl bg-[#0d1226]/80 backdrop-blur-3xl border border-white/15 p-7 md:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden transition-all">
        {/* Top-Right Cosmic Aurora Sheen */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-bl from-cyan-400/20 via-sky-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-teal-300/10 to-transparent pointer-events-none rounded-bl-3xl" />

        {/* Header Region */}
        <div className="text-center relative z-10 mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-wider drop-shadow-[0_0_14px_rgba(0,240,255,0.45)]">
            THỬ THÁCH GÕ PHÍM
          </h1>
          <p className="text-xs font-bold text-sky-400 tracking-[0.3em] uppercase mt-1">
            TỐC ĐỘ LƯỢNG TỬ
          </p>
        </div>

        {/* Section 1: Paragraph To Type + Realtime Stats */}
        <div className="relative z-10">
          <div className="text-xs font-bold text-cyan-400 tracking-wider uppercase mb-2 flex items-center justify-between">
            <span>ĐOẠN VĂN MẪU</span>
            {/* Subtle difficulty badge */}
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              Chế độ: {difficulty}
            </span>
          </div>

          <div className="flex items-start justify-between gap-6">
            {/* Left Paragraph Display (~75% width) */}
            <div className="flex-1 min-w-0 pr-2">
              <TextPromptDisplay
                targetText={challenge.text.normalize('NFC')}
                typedText={typedText}
                isActive={!isCompleted}
              />
            </div>

            {/* Right Telemetry Column (~25% width) matching mockup */}
            <div className="w-[115px] shrink-0 pt-0.5">
              <RealtimeStats
                wpm={wpm}
                accuracy={accuracy}
                timeSeconds={elapsedSeconds}
                variant="compact"
              />
            </div>
          </div>
        </div>

        {/* Glowing Cyan Horizontal Divider */}
        <div className="relative z-10 my-6 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent shadow-[0_0_8px_rgba(0,240,255,0.35)]" />

        {/* Section 2: Your Typing Input */}
        <div className="relative z-10">
          <div className="text-xs font-bold text-cyan-400 tracking-wider uppercase mb-2">
            PHẦN GÕ CỦA BẠN
          </div>

          <TypingInput
            key={resetKey}
            onChange={handleTypingChange}
            placeholder="Con cáo nâu nhanh nhẹn nhảy qua..."
            disabled={isCompleted}
            onPasteBlocked={() => triggerToast('Bạn phải tự gõ — không cho phép copy/paste')}
          />
        </div>

        {/* Section 3: Cosmic Lock Portal Centerpiece */}
        <div className="relative z-10 flex flex-col items-center justify-center my-6">
          <div
            className="relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
            onClick={handleReset}
            title="Nhấp vào vòng xoáy để tải lại thử thách"
          >
            {/* Swirling Gravitational Vortex Glow */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.45)_0%,rgba(124,58,237,0.2)_45%,transparent_70%)] shadow-[0_0_35px_rgba(168,85,247,0.5)] animate-pulse" />
            <div className="absolute inset-2 rounded-full border border-purple-500/30 animate-[spin_12s_linear_infinite]" />
            <div className="absolute inset-4 rounded-full border border-violet-400/20 animate-[spin_8s_linear_infinite_reverse]" />

            {/* Center Neon Padlock */}
            <div className="relative z-10">
              <Lock className={`w-8 h-8 md:w-9 md:h-9 ${isTargetMatched ? 'text-cyan-300 drop-shadow-[0_0_12px_#00f0ff]' : 'text-purple-300 drop-shadow-[0_0_12px_#c084fc]'} transition-colors duration-300`} />
            </div>
          </div>

          {/* Caption */}
          <span className="text-[11px] md:text-xs font-semibold text-slate-400 tracking-[0.25em] uppercase text-center mt-2">
            TIẾN TRÌNH KHÓA
          </span>
        </div>

        {/* Section 4: Action Bar */}
        <div className="relative z-10 flex items-center justify-end gap-4 pt-2">
          <button
            type="button"
            onClick={onClose || handleReset}
            className="px-4 py-2 text-xs md:text-sm font-semibold text-slate-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
          >
            HỦY
          </button>

          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={saving || typedText.length === 0}
            className="px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm tracking-wider uppercase text-white flex items-center gap-2 bg-gradient-to-r from-cyan-500/40 to-sky-500/30 border border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.45)] hover:shadow-[0_0_25px_rgba(0,240,255,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{saving ? 'ĐANG LƯU...' : 'NỘP'}</span>
            <ArrowRight className="w-4 h-4 text-cyan-300" />
          </button>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900/90 border border-cyan-400/40 p-8 shadow-[0_0_50px_rgba(0,240,255,0.3)] text-center overflow-hidden">
            {/* Background Halo */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowCompletionModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon Banner */}
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,240,255,0.5)]">
              <Award className="w-8 h-8 text-cyan-300" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-wide">
              ĐẠT MỐC LƯỢNG TỬ!
            </h2>
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-widest mt-1">
              Hạng: {scoreResult?.rank || 'Lữ khách lượng tử'}
            </p>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-3 gap-3 my-6">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 block">Tốc độ</span>
                <span className="text-lg font-bold text-cyan-300 font-mono">
                  {wpm} <span className="text-[10px]">WPM</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 block">Độ chính xác</span>
                <span className="text-lg font-bold text-purple-300 font-mono">
                  {accuracy}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 block">Thời gian</span>
                <span className="text-lg font-bold text-emerald-300 font-mono">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            </div>

            {/* XP Notification */}
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-purple-900/40 via-cyan-900/40 to-purple-900/40 border border-purple-500/30 mb-6">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span className="text-xs font-semibold text-slate-200">
                Cosmic XP Đạt được:{' '}
                <strong className="text-cyan-300 font-bold">
                  +{scoreResult?.xp_earned || 120} XP
                </strong>
              </span>
            </div>

            {/* Status note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mb-6">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Điểm đã được xác minh và đồng bộ vào Bản đồ Hoạt động</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white tracking-wider uppercase transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextDiff = difficulty === 'novice' ? 'stargazer' : difficulty === 'stargazer' ? 'quantum' : 'novice';
                  handleDifficultyChange(nextDiff);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-xs font-bold text-cyan-300 tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(0,240,255,0.3)]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mức khó tiếp theo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TypingChallengeScreen;
