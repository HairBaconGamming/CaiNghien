import React, { useRef, useEffect } from "react";

export interface TypingInputProps {
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
}

export const TypingInput: React.FC<TypingInputProps> = ({
  onChange,
  onKeyDown,
  disabled = false,
  autoFocus = true,
  onPasteBlocked,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

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
      onChangeRef.current(target.value.normalize("NFC"));
    };

    el.addEventListener("input", onNativeInput);
    return () => el.removeEventListener("input", onNativeInput);
  }, []);

  return (
    <div style={{ padding: "20px", background: "white", borderRadius: "8px", marginTop: "20px", color: "black", width: "100%" }}>
      <p style={{marginBottom: "10px", fontWeight: "bold"}}>TEST RAW INPUT (NO CSS)</p>
      <input
        ref={inputRef}
        type="text"
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
        disabled={disabled}
        placeholder="Gõ tiếng việt vào đây..."
        autoComplete="off"
        spellCheck={false}
        style={{ width: "100%", padding: "15px", fontSize: "18px", color: "black", border: "2px solid red" }}
      />
    </div>
  );
};

export default TypingInput;