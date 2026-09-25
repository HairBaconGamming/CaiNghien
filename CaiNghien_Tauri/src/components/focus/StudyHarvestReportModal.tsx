import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  GraduationCap, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ShieldAlert, 
  BookOpen,
  Loader2
} from 'lucide-react';
import { api, StudyRewardResult } from '../../services/api';

export interface StudyHarvestReportModalProps {
  isOpen: boolean;
  studyDurationMinutes: number;
  studyRequired?: number;
  rewardQuota?: number;
  onSuccess: (result: StudyRewardResult) => void;
}

export interface WordCountAnalysis {
  totalWords: number;
  uniqueWords: number;
  uniqueRatio: number;
  isValid: boolean;
  message: string;
}

/**
 * Valid Word Counting Engine Specification Implementation
 * Strict Unicode regex & Vietnamese diacritics support.
 */
export function analyzeHarvestText(text: string): WordCountAnalysis {
  if (!text || !text.trim()) {
    return {
      totalWords: 0,
      uniqueWords: 0,
      uniqueRatio: 0,
      isValid: false,
      message: "Chưa có nội dung",
    };
  }

  // Normalize Unicode to Canonical Composition (NFC)
  const normalized = text.normalize("NFC").trim();

  // 1. Split on any whitespace sequence (spaces, tabs, newlines)
  const rawTokens = normalized.split(/\s+/);

  // 2. Filter & clean each token: strip leading and trailing punctuation
  const validWords = rawTokens
    .map((token) => {
      // Strip leading and trailing punctuation (including Vietnamese unicode quotes, dashes, brackets)
      return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    })
    .filter((cleaned) => {
      // Must contain at least 2 alphanumeric/letter characters to count as a genuine word
      return cleaned.length >= 2;
    });

  const totalWords = validWords.length;
  const uniqueWordsSet = new Set(validWords.map((w) => w.toLowerCase()));
  const uniqueWords = uniqueWordsSet.size;
  const uniqueRatio = totalWords > 0 ? (uniqueWords / totalWords) * 100 : 0;

  // Anti-spam heuristic: if >= 100 words, must have at least 15 unique words (not typing 1 word 100 times)
  const isDiverse = totalWords >= 100 ? uniqueWords >= 15 : true;
  const isValid = totalWords >= 100 && isDiverse;

  let message = "";
  if (totalWords < 100) {
    message = `Còn thiếu ${100 - totalWords} từ để đủ điều kiện`;
  } else if (!isDiverse) {
    message = "Nội dung quá đơn điệu, vui lòng viết tóm tắt thực chất";
  } else {
    message = "Đạt tiêu chuẩn bài thu hoạch! Sẵn sàng nhận thưởng";
  }

  return { totalWords, uniqueWords, uniqueRatio, isValid, message };
}

export const StudyHarvestReportModal: React.FC<StudyHarvestReportModalProps> = ({
  isOpen,
  studyDurationMinutes,
  studyRequired = 60,
  rewardQuota = 15,
  onSuccess,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPasteToast, setShowPasteToast] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const lastTextLengthRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Calculate projected reward quota
  const earnedQuota = useMemo(() => {
    const duration = Math.max(0, Math.floor(Number(studyDurationMinutes)) || 0);
    const req = Math.max(1, Math.floor(Number(studyRequired)) || 60);
    const reward = Math.max(0, Math.floor(Number(rewardQuota)) || 15);
    return Math.floor((duration / req) * reward);
  }, [studyDurationMinutes, studyRequired, rewardQuota]);

  // Word analysis memo
  const analysis = useMemo(() => analyzeHarvestText(text), [text]);

  // Auto-dismiss warning toast
  useEffect(() => {
    if (!showPasteToast) return;
    const timer = setTimeout(() => {
      setShowPasteToast(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [showPasteToast]);

  // Modal Lockdown: Intercept Escape key globally to prevent closing
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isOpen]);

  // Focus textarea on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Paste event handler
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setWarningMessage('Copy-paste bị vô hiệu hóa! Vui lòng tự gõ để hoàn thành báo cáo thu hoạch.');
    setShowPasteToast(true);
  };

  // 2. Keyboard shortcuts interceptor (Ctrl+V, Cmd+V, Shift+Insert, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Intercept Ctrl+V or Cmd+V
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      e.stopPropagation();
      setWarningMessage('Phím tắt dán văn bản bị khóa trong bài thu hoạch.');
      setShowPasteToast(true);
      return;
    }

    // Intercept Shift+Insert or Ctrl+Insert (alternative paste)
    if ((e.shiftKey || e.ctrlKey) && e.key === 'Insert') {
      e.preventDefault();
      e.stopPropagation();
      setWarningMessage('Phím tắt dán văn bản bị khóa trong bài thu hoạch.');
      setShowPasteToast(true);
      return;
    }

    // Modal Lockdown: Intercept Escape key
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  // 3. Mouse right-click context menu interceptor
  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setWarningMessage('Chuột phải bị khóa để tránh dán văn bản.');
    setShowPasteToast(true);
  };

  // 4. Drag & Drop interceptors
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setWarningMessage('Thao tác kéo thả văn bản bị chặn.');
    setShowPasteToast(true);
  };

  // 5. Input change handler with Keystroke Burst Velocity Guard
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const delta = newText.length - lastTextLengthRef.current;

    // Burst Guard: if input length jumps suddenly by > 10 chars, reject simulated paste
    if (delta > 10) {
      setWarningMessage('Phát hiện văn bản nhập quá nhanh! Nghi vấn dán văn bản tự động.');
      setShowPasteToast(true);
      return;
    }

    lastTextLengthRef.current = newText.length;
    setText(newText);
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!analysis.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.submitStudyReport(text, studyDurationMinutes);
      onSuccess(result);
    } catch (err: any) {
      console.error('[StudyHarvestReportModal] Submit error:', err);
      const msg = typeof err === 'string' 
        ? err 
        : err?.message || 'Lỗi khi nộp bài thu hoạch. Vui lòng kiểm tra lại.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  const progressPercent = Math.min(100, Math.round((analysis.totalWords / 100) * 100));

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl animate-fade-in select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="relative w-[680px] max-w-[95vw] max-h-[92vh] flex flex-col rounded-3xl p-6 sm:p-8 overflow-hidden shadow-2xl border border-cyan-500/30 text-white"
        style={{
          background: 'linear-gradient(135deg, rgba(10, 18, 38, 0.96) 0%, rgba(4, 9, 23, 0.98) 100%)',
          boxShadow: '0 0 60px rgba(0, 240, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Anti-Paste Toast Alert */}
        {showPasteToast && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-semibold shadow-[0_0_20px_rgba(244,63,94,0.4)] backdrop-blur-md animate-bounce">
            <ShieldAlert size={16} className="text-rose-400 shrink-0" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.3)] shrink-0">
            <GraduationCap size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Proof of Work
              </span>
              <span className="text-xs text-slate-400">
                Phiên học: {studyDurationMinutes} phút
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase mt-1">
              Báo Cáo Thu Hoạch Học Tập
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Hãy viết đoạn văn tóm tắt nội dung vừa học (tối thiểu 100 từ) để nhận thưởng <span className="text-cyan-300 font-bold">+{earnedQuota} phút Quota</span> giải trí.
            </p>
          </div>
        </div>

        {/* Anti-Paste Banner */}
        <div className="mb-4 p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center gap-2.5 text-xs text-slate-300">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300">Chống gian lận:</strong> Tính năng dán (Copy-Paste), chuột phải và kéo thả đã bị khóa. Hãy tự tay gõ kiến thức bạn vừa tiếp thu.
          </span>
        </div>

        {/* Textarea Input with Strict Anti-Paste Event Listeners */}
        <div className="relative flex-1 flex flex-col min-h-[180px] mb-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInputChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            placeholder="Viết tóm tắt nội dung bạn đã học được trong phiên vừa qua... (Tối thiểu 100 từ có nghĩa, không lặp lại từ đơn điệu)"
            className="w-full h-44 sm:h-52 p-4 rounded-2xl bg-slate-950/80 border border-white/15 text-white placeholder-slate-500 font-sans text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 resize-none transition-all leading-relaxed"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {/* Word Count Live Status Bar */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Counter Badge */}
              <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors ${
                analysis.isValid
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}>
                {analysis.isValid ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
                <span>{analysis.totalWords} / 100 từ</span>
              </div>

              {/* Unique words counter */}
              <span className="text-xs text-slate-400">
                ({analysis.uniqueWords} từ khác nhau)
              </span>
            </div>

            {/* Validation Message */}
            <span className={`text-xs font-medium ${
              analysis.isValid ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {analysis.message}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden mt-2.5">
            <div 
              className={`h-full transition-all duration-300 ${
                analysis.isValid 
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' 
                  : 'bg-gradient-to-r from-amber-400 to-orange-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error message from backend */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Button: Strictly disabled until >= 100 valid diverse words */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!analysis.isValid || isSubmitting}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 ${
              analysis.isValid && !isSubmitting
                ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white border border-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                : 'bg-slate-800/60 text-slate-500 border border-white/5 cursor-not-allowed opacity-60'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin text-cyan-300" />
                <span>Đang ghi nhận phần thưởng...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} className={analysis.isValid ? 'text-cyan-200' : 'text-slate-500'} />
                <span>Nộp bài thu hoạch & Nhận +{earnedQuota} phút Quota</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
