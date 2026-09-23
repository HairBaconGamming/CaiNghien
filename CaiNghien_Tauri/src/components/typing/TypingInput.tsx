import React, { useRef, useEffect } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';

export interface TypingInputProps {
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onPasteBlocked?: () => void;
  onRestart?: () => void;
  onNewChallenge?: () => void;
  difficulty?: 'novice' | 'stargazer' | 'quantum';
  onDifficultyChange?: (diff: 'novice' | 'stargazer' | 'quantum') => void;
  showControls?: boolean;
  className?: string;
}

export const TypingInput: React.FC<TypingInputProps> = ({
  onChange,
  onKeyDown,
  placeholder = 'Gõ đoạn văn mẫu ở trên vào đây...',
  disabled = false,
  autoFocus = true,
  onPasteBlocked,
  onRestart,
  onNewChallenge,
  difficulty = 'quantum',
  onDifficultyChange,
  showControls = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (autoFocus && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (onPasteBlocked) {
      onPasteBlocked();
    }
  };

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    
    const onNativeInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      onChangeRef.current(target.value.normalize('NFC'));
    };

    el.addEventListener('input', onNativeInput);
    return () => el.removeEventListener('input', onNativeInput);
  }, []);

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Optional Companion Controls: Difficulty & Reset */}
      {showControls && (
        <div className="flex items-center justify-between px-1 text-xs">
          {/* Difficulty Switcher */}
          {onDifficultyChange && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/60 border border-white/10 backdrop-blur-md">
              {(['novice', 'stargazer', 'quantum'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => onDifficultyChange(diff)}
                  className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
                    difficulty === diff
                      ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Bắt đầu lại thử thách"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Bắt đầu lại</span>
              </button>
            )}

            {onNewChallenge && (
              <button
                type="button"
                onClick={onNewChallenge}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 hover:text-white transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                title="Tải văn bản cosmic khác"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Thử thách mới</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cyber Neon Glowing Input Box */}
      <div
        onClick={handleContainerClick}
        className="relative group p-[1.5px] rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.35)] focus-within:shadow-[0_0_24px_rgba(0,240,255,0.5),0_0_36px_rgba(168,85,247,0.45)] transition-all duration-300 cursor-text"
      >
        <div className="w-full bg-[#070c1e]/90 rounded-[14.5px] px-4 py-3 md:py-3.5 flex items-center backdrop-blur-xl">
          <input
            ref={inputRef}
            type="text"
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full bg-transparent text-white font-sans text-sm md:text-base outline-none tracking-normal placeholder-slate-600 disabled:opacity-50"
            aria-label="Typing input box"
          />
        </div>
      </div>
    </div>
  );
};

export default TypingInput;
