import React, { useState, useEffect } from 'react';

export interface QuoteItem {
  quote: string;
  author: string;
}

export const DEFAULT_QUOTES: QuoteItem[] = [
  {
    quote: "TĨNH LẶNG LÀ SỨC MẠNH CỦA TÂM TRÍ",
    author: "– Thiền sư Thích Nhất Hạnh",
  },
  {
    quote: "KỶ LUẬT LÀ CẦU NỐI GIỮA MỤC TIÊU VÀ THÀNH TỰU ĐÍCH THỰC",
    author: "– Jim Rohn",
  },
  {
    quote: "TẬP TRUNG LÀ NÓI KHÔNG VỚI 1.000 ĐIỀU TỐT ĐỂ LÀM 1 ĐIỀU VĨ ĐẠI",
    author: "– Steve Jobs",
  },
  {
    quote: "CHIẾN THẮNG VẠN QUÂN KHÔNG BẰNG TỰ CHIẾN THẮNG CHÍNH MÌNH",
    author: "– Đức Phật Thích Ca Mâu Ni",
  },
  {
    quote: "CHÚNG TA LÀ MỘT CÁCH ĐỂ VŨ TRỤ TỰ HIỂU CHÍNH MÌNH",
    author: "– Carl Sagan",
  },
  {
    quote: "KHÔNG PHẢI VÌ MỌI THỨ KHÓ KHĂN NÊN TA KHÔNG DÁM, MÀ VÌ TA KHÔNG DÁM NÊN MỌI THỨ MỚI KHÓ KHĂN",
    author: "– Seneca",
  },
  {
    quote: "TÂM TĨNH NHƯ MẶT NƯỚC HỒ THU, KHÔNG SÓNG GIÓ NÀO LAY CHUYỂN ĐƯỢC Ý CHÍ",
    author: "– Trang Tử",
  },
  {
    quote: "HÃY LÀ CHỦ NHÂN CỦA TÂM TRÍ, ĐỪNG ĐỂ TÂM TRÍ LÀM NÔ LỆ CỦA CẢM XÚC",
    author: "– Marcus Aurelius",
  },
];

export interface MotivationalQuoteProps {
  quotes?: QuoteItem[];
  intervalMs?: number;
  className?: string;
}

export const MotivationalQuote: React.FC<MotivationalQuoteProps> = ({
  quotes = DEFAULT_QUOTES,
  intervalMs = 22000,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (quotes.length <= 1) return;

    const timer = setInterval(() => {
      // Trigger fade out
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % quotes.length);
        setIsFading(false);
      }, 500);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [quotes.length, intervalMs]);

  const handleNextQuote = () => {
    if (quotes.length <= 1 || isFading) return;
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % quotes.length);
      setIsFading(false);
    }, 400);
  };

  const currentQuote = quotes[currentIndex] || DEFAULT_QUOTES[0];

  return (
    <div
      onClick={handleNextQuote}
      title="Nhấn để đổi câu trích dẫn"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleNextQuote();
        }
      }}
      className={`
        relative w-[540px] max-w-[90vw] mx-auto text-center cursor-pointer select-none
        rounded-2xl px-7 py-4 md:py-5 transition-all duration-300
        hover:border-white/20 active:scale-[0.99]
        ${className}
      `}
      style={{
        background: 'rgba(13, 21, 39, 0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
      }}
    >
      <div
        className={`transition-all duration-500 transform ${
          isFading ? 'opacity-0 translate-y-2 scale-98' : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        {/* Quote text matching cain_focus_room.jpg */}
        <p className="text-[15px] md:text-[17px] font-bold text-slate-100 tracking-wide leading-snug uppercase">
          “{currentQuote.quote.replace(/^[“"]|[”"]$/g, '')}”
        </p>

        {/* Author attribution */}
        <span className="text-[12px] md:text-[13px] text-slate-400 italic mt-2 block font-normal tracking-normal">
          {currentQuote.author}
        </span>
      </div>
    </div>
  );
};
