import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlertOctagon, CheckCircle2, ShieldCheck, X, Sparkles, HeartHandshake } from 'lucide-react';

interface MindfulnessModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export const MINDFULNESS_PLEDGE = 
  "Tôi xin cam kết giữ vững tâm trí, không để những cám dỗ nhất thời làm suy giảm ý chí và làm gián đoạn mục tiêu dài hạn của bản thân. Tôi nhận thức rõ hành động này, chịu trách nhiệm hoàn toàn cho sự tiến bộ của mình hôm nay.";

export function MindfulnessModal({ isOpen, onCancel, onSuccess }: MindfulnessModalProps) {
  const [typedText, setTypedText] = useState('');
  const [pasteAttempted, setPasteAttempted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedText('');
      setPasteAttempted(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const targetChars = useMemo(() => Array.from(MINDFULNESS_PLEDGE), []);
  const typedChars = useMemo(() => Array.from(typedText), [typedText]);

  // Validation calculation
  const { isMatch, progressPercent, errorCount, correctCount } = useMemo(() => {
    let errors = 0;
    let correct = 0;
    const len = typedChars.length;

    for (let i = 0; i < len; i++) {
      if (i < targetChars.length && typedChars[i] === targetChars[i]) {
        correct++;
      } else {
        errors++;
      }
    }

    const exactMatch = typedText === MINDFULNESS_PLEDGE;
    const percent = Math.min(100, Math.round((correct / targetChars.length) * 100));

    return {
      isMatch: exactMatch,
      progressPercent: percent,
      errorCount: errors,
      correctCount: correct
    };
  }, [typedChars, targetChars, typedText]);

  if (!isOpen) return null;

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteAttempted(true);
    setTimeout(() => setPasteAttempted(false), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent Ctrl+V
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      setPasteAttempted(true);
      setTimeout(() => setPasteAttempted(false), 3000);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content mindfulness-modal-content rose">
        <button onClick={onCancel} className="modal-close" aria-label="Close">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="mindfulness-header">
          <div className="modal-icon-box rose">
            <AlertOctagon size={32} />
          </div>
          <div className="mindfulness-title-wrap">
            <h3 className="modal-title text-rose">Rào cản Chánh niệm</h3>
            <p className="modal-subtitle">
              Hãy chậm lại và suy ngẫm. Để tiếp tục yêu cầu tắt bảo vệ, bạn bắt buộc phải gõ lại chính xác 100% đoạn văn cam kết dưới đây.
            </p>
          </div>
        </div>

        {/* Anti-cheat Paste Warning */}
        {pasteAttempted && (
          <div className="mindfulness-paste-alert">
            <Sparkles size={16} />
            <span>Không được phép dán văn bản! Bạn phải tự tay gõ từng chữ để rèn luyện sự tỉnh thức.</span>
          </div>
        )}

        {/* Pledge Display with Character Feedback */}
        <div className="pledge-display-card custom-scrollbar">
          <div className="pledge-text-render">
            {targetChars.map((char, index) => {
              let charClass = 'char-pending';
              if (index < typedChars.length) {
                if (typedChars[index] === char) {
                  charClass = 'char-correct';
                } else {
                  charClass = 'char-wrong';
                }
              } else if (index === typedChars.length) {
                charClass = 'char-current';
              }

              return (
                <span key={index} className={`pledge-char ${charClass}`}>
                  {char}
                </span>
              );
            })}
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="mindfulness-progress-wrap">
          <div className="mindfulness-stats-row">
            <span className="stats-label">
              Tiến độ chính xác: {correctCount} / {targetChars.length} ký tự
            </span>
            <span className={`stats-percent ${isMatch ? 'text-emerald' : 'text-rose'}`}>
              {progressPercent}%
            </span>
          </div>
          <div className="mindfulness-progress-track">
            <div
              className={`mindfulness-progress-fill ${isMatch ? 'match' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {errorCount > 0 && (
            <div className="mindfulness-error-hint">
              ⚠️ Có {errorCount} ký tự chưa khớp. Vui lòng kiểm tra lại từng chữ có dấu và dấu câu.
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="mindfulness-input-wrap">
          <textarea
            ref={textareaRef}
            className="mindfulness-textarea custom-scrollbar"
            rows={4}
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Bắt đầu gõ từng chữ theo mẫu trên..."
          />
        </div>

        {/* Modal Buttons */}
        <div className="modal-btn-group" style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary-emerald"
          >
            <HeartHandshake size={18} />
            <span>Tôi đã tỉnh táo lại, tiếp tục giữ kỷ luật!</span>
          </button>

          <button
            type="button"
            onClick={onSuccess}
            disabled={!isMatch}
            className={`btn-danger ${!isMatch ? 'btn-disabled' : ''}`}
          >
            <CheckCircle2 size={18} />
            <span>{isMatch ? 'Xác nhận cam kết & Tiếp tục' : `Chưa khớp 100% (${progressPercent}%)`}</span>
          </button>
        </div>

        <div className="mindfulness-disclaimer">
          <ShieldCheck size={14} className="icon-emerald" />
          <span>Vượt qua rào cản này là bước thử thách ý chí trước khi quyết định từ bỏ.</span>
        </div>
      </div>
    </div>
  );
}
