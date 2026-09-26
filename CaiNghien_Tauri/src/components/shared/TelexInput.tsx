import React, { useRef, useEffect, useCallback } from 'react';
import { processTelexKey } from '../typing/TypingInput';

/**
 * TelexInput — A single-line <input> with built-in Vietnamese Telex engine.
 * Same approach as TypingInput: intercept printable keys in onKeyDown,
 * run them through processTelexKey (vn-telex), and update the DOM directly.
 * User must TURN OFF Unikey/EVKey to avoid double-processing.
 */
export interface TelexInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  autoComplete?: string;
}

export const TelexInput: React.FC<TelexInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  className = '',
  autoComplete = 'off',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync controlled value to DOM
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
      inputRef.current.setSelectionRange(value.length, value.length);
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || disabled) return;

    const input = inputRef.current;
    if (!input) return;

    if (e.key.length === 1) {
      e.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const baseText = start !== end
        ? input.value.slice(0, start) + input.value.slice(end)
        : input.value;
      const caret = start;
      const result = processTelexKey(baseText, caret, e.key);
      const newText = result.text.normalize('NFC');
      input.value = newText;
      input.setSelectionRange(result.caret, result.caret);
      onChange(newText);
    }
  }, [disabled, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.normalize('NFC'));
  }, [onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      className={className}
      aria-label="Telex input"
    />
  );
};

/**
 * TelexTextarea — A multi-line <textarea> with built-in Vietnamese Telex engine.
 * Same mechanism as TelexInput but for textarea.
 */
export interface TelexTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
  onKeyDownExtra?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const TelexTextarea: React.FC<TelexTextareaProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  className = '',
  onPaste,
  onContextMenu,
  onDragOver,
  onDrop,
  onKeyDownExtra,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync controlled value to DOM
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== value) {
      textareaRef.current.value = value;
      textareaRef.current.setSelectionRange(value.length, value.length);
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && !disabled && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [autoFocus, disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow parent extra handling first (e.g. anti-paste interception)
    onKeyDownExtra?.(e);
    if (e.defaultPrevented) return;

    if (e.ctrlKey || e.metaKey || e.altKey || disabled) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Allow Enter key for newlines
    if (e.key === 'Enter') return;

    // Intercept single printable characters and route through Telex engine
    if (e.key.length === 1) {
      e.preventDefault();
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const baseText = start !== end
        ? textarea.value.slice(0, start) + textarea.value.slice(end)
        : textarea.value;
      const caret = start;
      const result = processTelexKey(baseText, caret, e.key);
      const newText = result.text.normalize('NFC');
      textarea.value = newText;
      textarea.setSelectionRange(result.caret, result.caret);
      onChange(newText);
    }
  }, [disabled, onChange, onKeyDownExtra]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value.normalize('NFC'));
  }, [onChange]);

  return (
    <textarea
      ref={textareaRef}
      defaultValue={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={onPaste}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={className}
      aria-label="Telex textarea"
    />
  );
};

export default TelexInput;
