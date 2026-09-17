import React, { useMemo } from 'react';

export interface TextPromptDisplayProps {
  targetText: string;
  typedText: string;
  className?: string;
  isActive?: boolean;
}

interface CharInfo {
  char: string;
  globalIndex: number;
  status: 'correct' | 'error' | 'current' | 'untyped';
}

interface WordInfo {
  wordIndex: number;
  chars: CharInfo[];
  trailingSpace?: CharInfo;
}

export const TextPromptDisplay: React.FC<TextPromptDisplayProps> = ({
  targetText,
  typedText,
  className = '',
  isActive = true,
}) => {
  // Tokenize text into words preserving exact character indexes and spaces
  const words = useMemo<WordInfo[]>(() => {
    const result: WordInfo[] = [];
    let currentChars: CharInfo[] = [];
    let wordIdx = 0;

    for (let i = 0; i < targetText.length; i++) {
      const char = targetText[i];
      let status: CharInfo['status'] = 'untyped';

      if (i < typedText.length) {
        status = typedText[i] === char ? 'correct' : 'error';
      } else if (i === typedText.length && isActive) {
        status = 'current';
      }

      const charInfo: CharInfo = { char, globalIndex: i, status };

      if (char === ' ') {
        result.push({
          wordIndex: wordIdx++,
          chars: currentChars,
          trailingSpace: charInfo,
        });
        currentChars = [];
      } else {
        currentChars.push(charInfo);
      }
    }

    if (currentChars.length > 0) {
      result.push({
        wordIndex: wordIdx,
        chars: currentChars,
      });
    }

    return result;
  }, [targetText, typedText, isActive]);

  // Extra characters typed beyond target length
  const overflowText = useMemo(() => {
    if (typedText.length > targetText.length) {
      return typedText.slice(targetText.length);
    }
    return '';
  }, [typedText, targetText]);

  const renderChar = (c: CharInfo) => {
    switch (c.status) {
      case 'correct':
        return (
          <span
            key={c.globalIndex}
            className="text-white font-medium transition-colors duration-100"
          >
            {c.char}
          </span>
        );

      case 'error':
        return (
          <span
            key={c.globalIndex}
            className="text-[#ef4444] bg-red-500/25 border-b border-red-500 rounded-xs font-semibold"
            title={`Expected '${c.char}', typed '${typedText[c.globalIndex] || ''}'`}
          >
            {c.char === ' ' ? '·' : c.char}
          </span>
        );

      case 'current':
        return (
          <span
            key={c.globalIndex}
            className="relative text-white border-b-2 border-cyan-400 bg-cyan-400/20 rounded-xs shadow-[0_0_8px_#00f0ff] font-medium"
          >
            {c.char}
            <span className="inline-block w-0.5 h-4 bg-cyan-400 align-middle ml-0.5 animate-pulse" />
          </span>
        );

      case 'untyped':
      default:
        return (
          <span
            key={c.globalIndex}
            className="text-slate-400 transition-colors duration-100"
          >
            {c.char}
          </span>
        );
    }
  };

  const renderSpace = (space: CharInfo) => {
    if (space.status === 'error') {
      return (
        <span
          key={space.globalIndex}
          className="inline-block text-[#ef4444] bg-red-500/30 border-b border-red-500 px-0.5 font-bold"
          title="Extra or mistyped space"
        >
          _
        </span>
      );
    }
    if (space.status === 'current') {
      return (
        <span
          key={space.globalIndex}
          className="inline-block border-b-2 border-cyan-400 bg-cyan-400/20 px-0.5 shadow-[0_0_8px_#00f0ff]"
        >
          &nbsp;
        </span>
      );
    }
    return (
      <span key={space.globalIndex} className="inline-block">
        &nbsp;
      </span>
    );
  };

  return (
    <div
      className={`text-sm md:text-base leading-relaxed tracking-normal select-none font-sans ${className}`}
      aria-label="Typing target paragraph"
    >
      {words.map((w) => (
        <React.Fragment key={w.wordIndex}>
          <span className="inline-block whitespace-nowrap">
            {w.chars.map(renderChar)}
          </span>
          {w.trailingSpace && renderSpace(w.trailingSpace)}
        </React.Fragment>
      ))}

      {/* Overflow characters */}
      {overflowText && (
        <span className="text-red-400 bg-red-950/60 border-b border-red-500 rounded-xs font-mono ml-0.5 px-1">
          {overflowText}
        </span>
      )}
    </div>
  );
};

export default TextPromptDisplay;
