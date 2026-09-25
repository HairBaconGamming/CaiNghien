import assert from "node:assert/strict";

/**
 * WordCountAnalysis interface according to specification
 * spec_miner_study_earn/handoff.md:192-198
 */
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
 * Reference: spec_miner_study_earn/handoff.md:200-239
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

  // Normalize Unicode to Canonical Decomposition / Composition (NFC)
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

export function runWordCounterTests() {
  console.log("=================================================");
  console.log("   TEST SUITE: WORD COUNTER & VIETNAMESE NLP    ");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}`);
      console.error(`       ${err.message}`);
      throw err;
    }
  }

  // 1. Empty & Whitespace Inputs
  test("Empty text returns 0 words and isValid: false", () => {
    const res = analyzeHarvestText("");
    assert.equal(res.totalWords, 0);
    assert.equal(res.isValid, false);
    assert.equal(res.message, "Chưa có nội dung");
  });

  test("Whitespace-only text (spaces, tabs, newlines) returns 0 words", () => {
    const res = analyzeHarvestText("   \t  \n  \r\n   ");
    assert.equal(res.totalWords, 0);
    assert.equal(res.isValid, false);
  });

  // 2. Exact Boundary: 99 words vs 100 words
  test("Exact boundary: 99 valid words -> isValid is FALSE, submit blocked", () => {
    const words99 = Array.from({ length: 99 }, (_, i) => `từ_số_${i + 1}`).join(" ");
    const res = analyzeHarvestText(words99);
    assert.equal(res.totalWords, 99, `Expected 99 words, got ${res.totalWords}`);
    assert.equal(res.isValid, false, "99 words must NOT be valid");
    assert.equal(res.message, "Còn thiếu 1 từ để đủ điều kiện");
  });

  test("Exact boundary: 100 valid words with high diversity -> isValid is TRUE", () => {
    const words100 = Array.from({ length: 100 }, (_, i) => `kiến_thức_${i + 1}`).join(" ");
    const res = analyzeHarvestText(words100);
    assert.equal(res.totalWords, 100, `Expected 100 words, got ${res.totalWords}`);
    assert.equal(res.isValid, true, "100 words must be valid");
    assert.equal(res.uniqueWords, 100);
    assert.equal(res.message, "Đạt tiêu chuẩn bài thu hoạch! Sẵn sàng nhận thưởng");
  });

  test("Upper boundary: 101 valid words -> isValid is TRUE", () => {
    const words101 = Array.from({ length: 101 }, (_, i) => `bài_học_${i + 1}`).join(" ");
    const res = analyzeHarvestText(words101);
    assert.equal(res.totalWords, 101);
    assert.equal(res.isValid, true);
  });

  // 3. Single Character and Symbol Filtering
  test("Single character tokens are rejected (length < 2)", () => {
    const singleChars = "a b c d e f g h i j k l m n o p q r s t u v w x y z";
    const res = analyzeHarvestText(singleChars);
    assert.equal(res.totalWords, 0, "Single-letter tokens must be discarded");
  });

  test("Pure punctuation and symbol tokens are ignored", () => {
    const symbols = "... --- *** +++ === ___ ~~~ ??? !!! ;;; :::";
    const res = analyzeHarvestText(symbols);
    assert.equal(res.totalWords, 0, "Pure symbol sequences must count as 0 words");
  });

  test("Punctuation stripped from word edges preserves valid core word", () => {
    const text = '"toán," !lý! (hóa) [sinh] {văn} "sử..." \'địa\'';
    const res = analyzeHarvestText(text);
    assert.equal(res.totalWords, 7, `Expected 7 cleaned words, got ${res.totalWords}`);
  });

  // 4. Anti-Spam Heuristics
  test("Anti-spam: Repeated single word 100 times fails diversity check", () => {
    const spam = Array(100).fill("học").join(" ");
    const res = analyzeHarvestText(spam);
    assert.equal(res.totalWords, 100);
    assert.equal(res.uniqueWords, 1);
    assert.equal(res.isValid, false, "100 repeats of single word must fail diversity");
    assert.equal(res.message, "Nội dung quá đơn điệu, vui lòng viết tóm tắt thực chất");
  });

  test("Anti-spam: 3 alternating words repeated 100 times fails diversity check (unique < 15)", () => {
    const alternating = Array.from({ length: 100 }, (_, i) => ["toán", "lý", "hóa"][i % 3]).join(" ");
    const res = analyzeHarvestText(alternating);
    assert.equal(res.totalWords, 100);
    assert.equal(res.uniqueWords, 3);
    assert.equal(res.isValid, false, "3 unique words out of 100 must fail diversity");
  });

  test("Anti-spam: Single character spam repeated 100 times yields 0 valid words", () => {
    const spam = Array(100).fill("a").join(" ");
    const res = analyzeHarvestText(spam);
    assert.equal(res.totalWords, 0);
    assert.equal(res.isValid, false);
  });

  // 5. Vietnamese Diacritics and NLP
  test("Vietnamese tone marks correctly recognized as valid words", () => {
    const tones = "tiếng việt tối học nghĩ khỏe nhảy vừa nước được";
    const res = analyzeHarvestText(tones);
    assert.equal(res.totalWords, 10);
    assert.equal(res.uniqueWords, 10);
  });

  test("Vietnamese modified vowels and consonants (Ă, Â, Đ, Ê, Ô, Ơ, Ư)", () => {
    const vowels = "nghiên cứu trường phương khuyên được thưởng phát triển";
    const res = analyzeHarvestText(vowels);
    assert.equal(res.totalWords, 9);
  });

  test("Mixed Vietnamese and English technical terminology", () => {
    const mixed = "thuật toán Dijkstra và cấu trúc dữ liệu Graph trong TypeScript React";
    const res = analyzeHarvestText(mixed);
    assert.equal(res.totalWords, 12);
  });

  test("Case insensitivity in unique word counting", () => {
    const text = "Đại Học đại học ĐẠI HỌC Đại học";
    const res = analyzeHarvestText(text);
    assert.equal(res.totalWords, 8); // 4 times "Đại Học" = 8 words
    assert.equal(res.uniqueWords, 2); // "đại" and "học"
  });

  // 6. Realistic 100+ Word Academic Reflection
  test("Authentic 105-word Vietnamese academic reflection passes all checks", () => {
    const academicText = `
      Hôm nay trong phiên học tập trung kéo dài sáu mươi phút, tôi đã nghiên cứu sâu về
      kiến trúc phần mềm hướng dịch vụ và các nguyên lý thiết kế hệ thống phân tán.
      Tôi đã nắm vững cách tổ chức luồng dữ liệu một chiều giữa React frontend và Rust backend
      thông qua cơ chế gọi lệnh bất đồng bộ IPC trong framework Tauri.
      Đặc biệt, tôi đã thực hành viết các bài kiểm thử tự động nhằm đảm bảo tính toàn vẹn
      của dữ liệu khi lưu trữ vào cơ sở dữ liệu SQLite và tệp cấu hình JSON.
      Ngoài ra, tôi cũng đã tìm hiểu về các giải thuật phát hiện và ngăn chặn hành vi gian lận
      trong quá trình nhập liệu báo cáo thu hoạch, bảo đảm người học rèn luyện tính kỷ luật cao.
    `.trim();

    const res = analyzeHarvestText(academicText);
    assert(res.totalWords >= 100, `Expected >= 100 words, got ${res.totalWords}`);
    assert(res.uniqueWords >= 15, `Expected >= 15 unique words, got ${res.uniqueWords}`);
    assert.equal(res.isValid, true, "Authentic academic summary must be valid");
  });

  console.log(`\nWord Counter Suite Complete: ${passed} / ${total} tests passed.\n`);
  return { passed, total };
}

// Direct execution support
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runWordCounterTests();
}
