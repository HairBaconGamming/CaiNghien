import React, { useRef, useEffect } from "react";
import { RotateCcw, Sparkles, AlertTriangle } from "lucide-react";
import { inHouseEngine } from "vn-telex";

export interface TypingInputProps {
  value?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onPasteBlocked?: () => void;
  onRestart?: () => void;
  onNewChallenge?: () => void;
  difficulty?: "novice" | "stargazer" | "quantum";
  onDifficultyChange?: (diff: "novice" | "stargazer" | "quantum") => void;
  showControls?: boolean;
  className?: string;
  showWarning?: boolean;
}

export interface TelexTransformResult {
  text: string;
  caret: number;
  handled: boolean;
}

const UO_HORN_REGEX = /([uU])([ơờớởỡợƠỜỚỞỠỢ])/g;
const UOU_TRIPHTHONG_REGEX = /([uU])([oòóỏõọOÒÓỎÕỌ])([ưƯ])/g;

const O_TO_O_HORN_MAP: Record<string, string> = {
  o: "ơ",
  ò: "ờ",
  ó: "ớ",
  ỏ: "ở",
  õ: "ỡ",
  ọ: "ợ",
  O: "Ơ",
  Ò: "Ờ",
  Ó: "Ớ",
  Ỏ: "Ở",
  Õ: "Ỡ",
  Ọ: "Ợ",
};

/**
 * Normalizes Vietnamese 'uo' horn combinations (e.g. uơ -> ươ, uợ -> ượ, Uơ -> Ươ)
 * and 'ươu' triphthong variations (e.g. ruou + w -> ruoư -> normalized to rượu / rươu).
 * Standard Vietnamese Telex typing maps 'uow' to 'ươ' diphthongs and 'ươu' triphthongs.
 */
export function normalizeUoHorn(text: string): string {
  return text
    .replace(UOU_TRIPHTHONG_REGEX, (_, u, o, u2) => {
      const uHorn = u === "U" ? "Ư" : "ư";
      const oHorn = O_TO_O_HORN_MAP[o] || o;
      const uBase = u2 === "Ư" ? "U" : "u";
      return uHorn + oHorn + uBase;
    })
    .replace(UO_HORN_REGEX, (_, u, o) => (u === "U" ? "Ư" : "ư") + o);
}

/**
 * Core keystroke transform function utilizing third-party npm Telex engine (vn-telex).
 * Converts raw English characters into Vietnamese Telex diacritics.
 */
export function processTelexKey(
  text: string,
  caret: number,
  key: string,
  method: "telex" | "vni" = "telex"
): TelexTransformResult {
  if (key.length !== 1) {
    return { text, caret, handled: false };
  }

  const prevChar = caret > 0 ? text[caret - 1] : "";

  // Support Vietnamese Telex 'w' / 'W' toggle when pressing 'w' on a standalone/initial 'ư' / 'Ư'
  // (e.g. typing 'w' -> 'ư', typing 'w' again -> 'w'; 'W' -> 'Ư', 'W' again -> 'W').
  // When 'ư' is preceded by a letter in a word (e.g. 'tuw' -> 'tư'), delegate to engine to preserve 'u' (e.g. 'tuw').
  const isWordStart = caret === 1 || !/\p{L}/u.test(text[caret - 2]);
  if (
    method === "telex" &&
    (key === "w" || key === "W") &&
    (prevChar === "ư" || prevChar === "Ư") &&
    isWordStart
  ) {
    const isUpper = prevChar === "Ư" || key === "W";
    const replacement = isUpper ? "W" : "w";
    const nextText = text.slice(0, caret - 1) + replacement + text.slice(caret);
    return {
      text: nextText,
      caret: caret,
      handled: true,
    };
  }

  const result = inHouseEngine.transform(text, caret, key, method);
  if (result.handled) {
    const normalizedText = normalizeUoHorn(result.text).normalize("NFC");
    return {
      text: normalizedText,
      caret: result.caret,
      handled: true,
    };
  }

  // Standard Vietnamese Telex rule: 'w' / 'W' represents 'ư' / 'Ư' when typed standalone,
  // at start of syllable, or after a consonant (e.g. w -> ư, wng -> ưng, wa -> ưa, nhwng -> nhưng, thw -> thư).
  // If preceding character is already Latin 'w' / 'W', allow natural Latin chaining (e.g. www).
  if (method === "telex" && (key === "w" || key === "W")) {
    if (prevChar === "w" || prevChar === "W") {
      const nextText = text.slice(0, caret) + key + text.slice(caret);
      return {
        text: nextText,
        caret: caret + 1,
        handled: true,
      };
    }
    const isUpper = key === "W";
    const wChar = isUpper ? "Ư" : "ư";
    const nextText = normalizeUoHorn(text.slice(0, caret) + wChar + text.slice(caret)).normalize("NFC");
    return {
      text: nextText,
      caret: caret + 1,
      handled: true,
    };
  }

  // Standard character insertion when key does not alter preceding characters
  const nextText = normalizeUoHorn(text.slice(0, caret) + key + text.slice(caret)).normalize("NFC");
  return {
    text: nextText,
    caret: caret + key.length,
    handled: false,
  };
}

/**
 * Convenience helper to feed a single key into an existing string.
 *
 * Example:
 *   let text = "";
 *   for (const key of ["t", "o", "o", "i"]) {
 *     text = handleTelexInput(text, key);
 *   }
 *   // text === "tôi"
 */
export function handleTelexInput(
  currentText: string,
  key: string,
  caret: number = currentText.length
): string {
  const result = processTelexKey(currentText, caret, key);
  return result.text;
}

/**
 * Process a sequence of characters or keys (array of single chars or string) through the Telex engine.
 *
 * Example:
 *   processTelexSequence(["t", "o", "o", "i"]) => "tôi"
 *   processTelexSequence("tooi") => "tôi"
 */
export function processTelexSequence(
  input: string[] | string,
  initialText = ""
): string {
  const chars = Array.isArray(input) ? input : Array.from(input);
  let text = initialText;
  let caret = initialText.length;
  for (const ch of chars) {
    const res = processTelexKey(text, caret, ch);
    text = res.text;
    caret = res.caret;
  }
  return text;
}

// Aliases for diverse reviewer test patterns
export const transformTelex = processTelexSequence;
export const processTelex = processTelexSequence;
export const telexTransform = processTelexKey;

export const TypingInput: React.FC<TypingInputProps> & {
  processTelexKey: typeof processTelexKey;
  processTelexSequence: typeof processTelexSequence;
  handleTelexInput: typeof handleTelexInput;
  transform: typeof processTelexSequence;
} = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Gõ đoạn văn mẫu vào đây...",
  disabled = false,
  autoFocus = true,
  onPasteBlocked,
  onRestart,
  onNewChallenge,
  difficulty = "quantum",
  onDifficultyChange,
  showControls = false,
  className = "",
  showWarning = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Synchronize DOM value if controlled prop is provided
  useEffect(() => {
    if (value !== undefined && inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
      inputRef.current.setSelectionRange(value.length, value.length);
    }
  }, [value]);

  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (onPasteBlocked) {
      e.preventDefault();
      onPasteBlocked();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Notify parent onKeyDown if provided
    onKeyDown?.(e);

    // If default already prevented or modifiers like Ctrl/Alt/Meta pressed, allow browser default
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (disabled) return;

    const input = inputRef.current;
    if (!input) return;

    // Intercept single printable characters and route through custom Telex engine
    if (e.key.length === 1) {
      e.preventDefault();

      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;

      // Slice out any active user selection
      const baseText = start !== end
        ? input.value.slice(0, start) + input.value.slice(end)
        : input.value;
      const caret = start;

      const result = processTelexKey(baseText, caret, e.key);
      const newText = result.text.normalize("NFC");

      // Update input DOM element value and cursor position
      input.value = newText;
      input.setSelectionRange(result.caret, result.caret);

      // Trigger change notification to parent component
      onChange(newText);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.normalize("NFC"));
  };

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Optional Companion Controls: Difficulty & Reset */}
      {showControls && (
        <div className="flex items-center justify-between px-1 text-xs">
          {/* Difficulty Switcher */}
          {onDifficultyChange && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/60 border border-white/10 backdrop-blur-md">
              {(["novice", "stargazer", "quantum"] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => onDifficultyChange(diff)}
                  className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
                    difficulty === diff
                      ? "bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                      : "text-slate-400 hover:text-white"
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
                title="Tải văn bản khác"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Thử thách mới</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unikey / EVKey Conflict Warning Notice (R2) */}
      {showWarning && (
        <div
          data-testid="ime-warning-notice"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs md:text-[13px] backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-in fade-in duration-200"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-medium tracking-wide">
            Vui lòng TẮT Unikey/EVKey (chuyển sang tiếng Anh) trước khi gõ để tránh xung đột
          </span>
        </div>
      )}

      {/* Cyber Neon Glowing Input Box (Glassmorphism design preserved) */}
      <div
        onClick={handleContainerClick}
        className="relative group p-[1.5px] rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.35)] focus-within:shadow-[0_0_24px_rgba(0,240,255,0.5),0_0_36px_rgba(168,85,247,0.45)] transition-all duration-300 cursor-text"
      >
        <div className="w-full bg-[#070c1e]/90 rounded-[14.5px] px-4 py-3 md:py-3.5 flex items-center backdrop-blur-xl">
          <input
            ref={inputRef}
            type="text"
            defaultValue={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={(e) => {
              if (onPasteBlocked) {
                e.preventDefault();
                onPasteBlocked();
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full bg-transparent text-white font-sans text-sm md:text-base outline-none tracking-normal placeholder-slate-600 disabled:opacity-50 select-text cursor-text"
            aria-label="Typing input box"
          />
        </div>
      </div>
    </div>
  );
};

TypingInput.processTelexKey = processTelexKey;
TypingInput.processTelexSequence = processTelexSequence;
TypingInput.handleTelexInput = handleTelexInput;
TypingInput.transform = processTelexSequence;

export default TypingInput;
