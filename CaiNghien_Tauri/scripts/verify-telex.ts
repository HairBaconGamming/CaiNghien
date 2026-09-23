import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  processTelexKey,
  processTelexSequence,
  handleTelexInput,
  normalizeUoHorn,
  TypingInput,
} from "../src/components/typing/TypingInput";
import { inHouseEngine } from "vn-telex";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=================================================");
console.log("   AUTOMATED VERIFICATION: CUSTOM TELEX ENGINE   ");
console.log("=================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------
// TEST 1: Acceptance Criteria Mock Test — feeding ['t', 'o', 'o', 'i'] -> 'tôi'
// ---------------------------------------------------------------------
runTest("Mock test: Feeding ['t', 'o', 'o', 'i'] into processTelexSequence yields 'tôi'", () => {
  const result = processTelexSequence(["t", "o", "o", "i"]);
  assert.equal(result, "tôi", `Expected 'tôi', got '${result}'`);
});

runTest("Mock test: Feeding string 'tooi' into processTelexSequence yields 'tôi'", () => {
  const result = processTelexSequence("tooi");
  assert.equal(result, "tôi", `Expected 'tôi', got '${result}'`);
});

runTest("Mock test: Step-by-step feeding via handleTelexInput yields 'tôi'", () => {
  let text = "";
  const chars = ["t", "o", "o", "i"];
  for (const char of chars) {
    text = handleTelexInput(text, char);
  }
  assert.equal(text, "tôi", `Expected 'tôi', got '${text}'`);
});

runTest("Mock test: Step-by-step feeding via processTelexKey caret tracking yields 'tôi'", () => {
  let text = "";
  let caret = 0;
  const chars = ["t", "o", "o", "i"];
  for (const char of chars) {
    const res = processTelexKey(text, caret, char);
    text = res.text;
    caret = res.caret;
  }
  assert.equal(text, "tôi", `Expected 'tôi', got '${text}'`);
  assert.equal(caret, 3, `Expected caret 3, got ${caret}`);
});

runTest("Mock test: TypingInput static method transform(['t', 'o', 'o', 'i']) yields 'tôi'", () => {
  const result = TypingInput.transform(["t", "o", "o", "i"]);
  assert.equal(result, "tôi", `Expected 'tôi', got '${result}'`);
});

// ---------------------------------------------------------------------
// TEST 2: Vietnamese vocabulary & diacritics coverage
// ---------------------------------------------------------------------
const vocabularyCases: [string[], string, string][] = [
  [["t", "i", "e", "e", "n", "g", "s"], "tiếng", "Sắc (s) on ê"],
  [["v", "i", "e", "e", "t", "j"], "việt", "Nặng (j) on ê"],
  [["t", "o", "o", "i", "s"], "tối", "Sắc (s) on ô"],
  [["d", "d", "a", "w", "n", "g"], "đăng", "Trăng (w) on a and d->đ"],
  [["d", "d", "i"], "đi", "D to đ"],
  [["c", "h", "u", "y", "e", "e", "n", "j"], "chuyện", "Circumflex + Nặng tone"],
  [["h", "o", "c", "j"], "học", "Nặng (j) on o"],
  [["k", "h", "o", "e", "r"], "khỏe", "Hỏi (r) on e"],
  [["n", "h", "a", "y", "r"], "nhảy", "Hỏi tone (r) on ay -> nhảy"],
  [["n", "h", "a", "a", "y", "r"], "nhẩy", "Circumflex (aa) + Hỏi tone (r) -> nhẩy"],
  [["v", "u", "w", "a", "f"], "vừa", "Horn (w) on u + Huyền tone (f) -> vừa"],
  [["n", "u", "w", "o", "w", "c", "s"], "nước", "Horn (w) on u/o + Sắc (double w)"],
  // Standard Vietnamese Telex single-w on 'uo' diphthongs (uow -> ươ)
  [["n", "u", "o", "w", "c", "s"], "nước", "Single w on uo (nuowcs) -> nước"],
  [["d", "d", "u", "o", "w", "c", "j"], "được", "Single w on uo (dduowcj) -> được"],
  [["t", "h", "u", "o", "w", "n", "g", "f"], "thường", "Single w on uo (thuowngf) -> thường"],
  [["n", "g", "u", "o", "w", "i", "f"], "người", "Single w on uo (nguowif) -> người"],
  [["c", "u", "o", "w", "i", "f"], "cười", "Single w on uo (cuowif) -> cười"],
  [["m", "u", "o", "w", "i", "f"], "mười", "Single w on uo (muowif) -> mười"],
  [["t", "r", "u", "o", "w", "c", "s"], "trước", "Single w on uo (truowcs) -> trước"],
  [["b", "u", "o", "w", "c", "s"], "bước", "Single w on uo (buowcs) -> bước"],
  // Standard Vietnamese Telex 'w' as 'ư'
  [["w"], "ư", "Standalone w -> ư"],
  [["w", "w"], "w", "Toggle ww -> w"],
  [["w", "n", "g"], "ưng", "wng -> ưng"],
  [["w", "n", "g", "s"], "ứng", "wngs -> ứng"],
  [["w", "a"], "ưa", "wa -> ưa"],
  [["w", "a", "r"], "ửa", "war -> ửa"],
  [["n", "h", "w"], "như", "nhw -> như"],
  [["n", "h", "w", "n", "g"], "nhưng", "nhwng -> nhưng"],
  [["t", "h", "w"], "thư", "thw -> thư"],
  [["t", "w", "f"], "từ", "twf -> từ"],
  [["s", "w", "j"], "sự", "swj -> sự"],
  [["r", "u", "o", "w", "u", "j"], "rượu", "ruowuj -> rượu"],
  [["h", "u", "o", "w", "u"], "hươu", "huowu -> hươu"],
  [["b", "u", "o", "w", "m", "s"], "bướm", "buowms -> bướm"],
  [["l", "u", "o", "w", "n"], "lươn", "luown -> lươn"],
  [["v", "u", "o", "w", "j", "n"], "vượn", "vuowjn -> vượn"],
  [["t", "r", "u", "o", "w", "n", "g", "f"], "trường", "truowngf -> trường"],
  [["k", "h", "u", "y", "e", "e", "n", "r"], "khuyển", "khuyeenr -> khuyển"],
  // Reverting horn on u in words preserves the vowel u (tuww -> tuw, not tw!)
  [["t", "u", "w", "w"], "tuw", "tuww toggles horn off u preserving vowel (tuw)"],
  [["n", "h", "u", "w", "w"], "nhuw", "nhuww toggles horn off u preserving vowel (nhuw)"],
  // Standard Vietnamese Telex triphthong typing with trailing w (ruouwj -> rượu, huouw -> hươu)
  [["r", "u", "o", "u", "w", "j"], "rượu", "ruouwj (natural triphthong typing) -> rượu"],
  [["h", "u", "o", "u", "w"], "hươu", "huouw (natural triphthong typing) -> hươu"],
  [["b", "u", "o", "u", "w", "s"], "bướu", "buouws (natural triphthong typing) -> bướu"],
];

for (const [inputChars, expected, desc] of vocabularyCases) {
  runTest(`Vocabulary test: ${inputChars.join("")} -> '${expected}' (${desc})`, () => {
    const result = processTelexSequence(inputChars);
    assert.equal(result, expected, `Expected '${expected}', got '${result}'`);
  });
}

// ---------------------------------------------------------------------
// TEST 3: Uppercase & Title Case typing
// ---------------------------------------------------------------------
runTest("Uppercase test: ['T', 'O', 'O', 'I'] -> 'TÔI'", () => {
  const result = processTelexSequence(["T", "O", "O", "I"]);
  assert.equal(result, "TÔI", `Expected 'TÔI', got '${result}'`);
});

runTest("Title case test: 'Tieengs Vieetj' -> 'Tiếng Việt'", () => {
  const result = processTelexSequence("Tieengs Vieetj");
  assert.equal(result, "Tiếng Việt", `Expected 'Tiếng Việt', got '${result}'`);
});

runTest("Uppercase D: 'DD' -> 'Đ' and 'DDi' -> 'Đi'", () => {
  assert.equal(processTelexSequence("DD"), "Đ");
  assert.equal(processTelexSequence("DDi"), "Đi");
});

runTest("Uppercase UOW: 'DDUOWCJ' -> 'ĐƯỢC'", () => {
  assert.equal(processTelexSequence("DDUOWCJ"), "ĐƯỢC");
});

runTest("TitleCase UOW: 'Dduowcj' -> 'Được' and 'Thuowngf' -> 'Thường'", () => {
  assert.equal(processTelexSequence("Dduowcj"), "Được");
  assert.equal(processTelexSequence("Thuowngf"), "Thường");
});

runTest("Uppercase W standalone & toggle: 'W' -> 'Ư' and 'WW' -> 'W'", () => {
  assert.equal(processTelexSequence("W"), "Ư");
  assert.equal(processTelexSequence("WW"), "W");
});

runTest("TitleCase W words: 'Wng' -> 'Ưng', 'Wngs' -> 'Ứng', 'Nhwng' -> 'Nhưng', 'Thw' -> 'Thư'", () => {
  assert.equal(processTelexSequence("Wng"), "Ưng");
  assert.equal(processTelexSequence("Wngs"), "Ứng");
  assert.equal(processTelexSequence("Nhwng"), "Nhưng");
  assert.equal(processTelexSequence("Thw"), "Thư");
});

runTest("Uppercase W words: 'WNGS' -> 'ỨNG', 'NHWNG' -> 'NHƯNG', 'THW' -> 'THƯ'", () => {
  assert.equal(processTelexSequence("WNGS"), "ỨNG");
  assert.equal(processTelexSequence("NHWNG"), "NHƯNG");
  assert.equal(processTelexSequence("THW"), "THƯ");
});

runTest("Latin chaining for www: 'www' -> 'ww' and 'wwww' -> 'www'", () => {
  assert.equal(processTelexSequence("www"), "ww");
  assert.equal(processTelexSequence("wwww"), "www");
});

runTest("Full sentence test: Cosmic typing challenge placeholder", () => {
  const result = processTelexSequence("Con caos naau nhanh nhejn nhayr qua...");
  assert.equal(result, "Con cáo nâu nhanh nhẹn nhảy qua...");
});

runTest("Tone removal with z: 'tooisz' -> 'tôi'", () => {
  assert.equal(processTelexSequence("tooisz"), "tôi");
});

runTest("Tone toggle undo: 'tooiss' -> 'tôis'", () => {
  assert.equal(processTelexSequence("tooiss"), "tôis");
});

runTest("Circumflex toggle undo: 'tooo' -> 'too'", () => {
  assert.equal(processTelexSequence("tooo"), "too");
});

runTest("Punctuation & numbers sentence test", () => {
  const result = processTelexSequence("Xin chaof, tooi laf 1 nguowif Vieetj Nam!");
  assert.equal(result, "Xin chào, tôi là 1 người Việt Nam!");
});

runTest("Caret editing in middle: inserting 'o' inside 'toi' yields 'tôi'", () => {
  const res = processTelexKey("toi", 2, "o");
  assert.equal(res.text, "tôi");
  assert.equal(res.handled, true);
});

runTest("normalizeUoHorn utility function correctly normalizes uơ to ươ", () => {
  assert.equal(normalizeUoHorn("đuợc"), "được");
  assert.equal(normalizeUoHorn("ĐUỢC"), "ĐƯỢC");
  assert.equal(normalizeUoHorn("thuờng"), "thường");
});

// ---------------------------------------------------------------------
// TEST 4: Direct third-party npm engine verification
// ---------------------------------------------------------------------
runTest("Third-party engine: inHouseEngine is exported by 'vn-telex'", () => {
  assert.ok(inHouseEngine, "inHouseEngine should exist");
  assert.equal(typeof inHouseEngine.transform, "function", "transform should be a function");
});

runTest("Third-party engine: direct transform of 'to' + 'o' yields 'tô'", () => {
  const res = inHouseEngine.transform("to", 2, "o", "telex");
  assert.equal(res.handled, true, "Should be handled");
  assert.equal(res.text, "tô", "Should produce 'tô'");
});

// ---------------------------------------------------------------------
// TEST 5: Codebase Inspection (Agent-as-judge compliance)
// ---------------------------------------------------------------------
runTest("Source code review: TypingInput.tsx imports third-party npm telex library", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  const hasNpmImport =
    content.includes('from "vn-telex"') ||
    content.includes("from 'vn-telex'") ||
    content.includes('from "@liam-public/browser-vietnamese-ime"');

  assert.ok(hasNpmImport, "TypingInput.tsx must import from vn-telex or @liam-public/browser-vietnamese-ime");
});

runTest("Source code review: TypingInput.tsx does NOT rely on onComposition events", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(!content.includes("onCompositionStart"), "Should not use onCompositionStart");
  assert.ok(!content.includes("onCompositionEnd"), "Should not use onCompositionEnd");
  assert.ok(!content.includes("isComposing"), "Should not rely on isComposing state");
});

runTest("Source code review: TypingInput.tsx contains Unikey/EVKey warning message (R2)", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  const requiredWarning = "Vui lòng TẮT Unikey/EVKey (chuyển sang tiếng Anh) trước khi gõ để tránh xung đột";
  assert.ok(content.includes(requiredWarning), `Should contain warning text: "${requiredWarning}"`);
});

// ---------------------------------------------------------------------
// TEST 6: Simulated DOM Input Interaction
// ---------------------------------------------------------------------
runTest("DOM simulation: Typing sequence into synthetic input simulates keystroke flow", () => {
  let simulatedInputValue = "";
  let caretPos = 0;
  const onChangeCalls: string[] = [];

  const handleSimulatedKeyDown = (key: string) => {
    const res = processTelexKey(simulatedInputValue, caretPos, key);
    simulatedInputValue = res.text;
    caretPos = res.caret;
    onChangeCalls.push(simulatedInputValue);
  };

  ["t", "o", "o", "i"].forEach(handleSimulatedKeyDown);

  assert.equal(simulatedInputValue, "tôi");
  assert.deepEqual(onChangeCalls, ["t", "to", "tô", "tôi"]);
});

runTest("DOM simulation: Typing uow sequence produces proper ươ diphthong", () => {
  let text = "";
  let caret = 0;
  for (const ch of ["d", "d", "u", "o", "w", "c", "j"]) {
    const res = processTelexKey(text, caret, ch);
    text = res.text;
    caret = res.caret;
  }
  assert.equal(text, "được");
});

runTest("Source code review: input has defaultValue={value} for initial controlled render", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");
  assert.ok(content.includes("defaultValue={value}"), "TypingInput must bind defaultValue={value} to input");
});

runTest("Source code review: handlePaste guards onPasteBlocked before preventDefault", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("if (onPasteBlocked) {\n      e.preventDefault();\n      onPasteBlocked();\n    }"),
    "handlePaste should only preventDefault if onPasteBlocked handler is provided"
  );
});

runTest("Source code review: input has onDrop handler guarding onPasteBlocked", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("onDrop="),
    "TypingInput must bind onDrop handler to input"
  );
  assert.ok(
    content.includes("if (onPasteBlocked) {") && content.includes("onPasteBlocked();"),
    "onDrop must guard onPasteBlocked"
  );
});

// ---------------------------------------------------------------------
// TEST 7: Selection Overwrite & State Synchronization
// ---------------------------------------------------------------------
runTest("DOM simulation: Text selection replacement overwrites highlighted range", () => {
  const currentText = "chuyện này";
  // Highlight 'này' (index 7 to 10) and type 'k'
  const start = 7;
  const end = 10;
  const baseText = currentText.slice(0, start) + currentText.slice(end);
  const res = processTelexKey(baseText, start, "k");
  assert.equal(res.text, "chuyện k");
  assert.equal(res.caret, 8);
});

runTest("DOM simulation: Selecting whole input and typing replaces entire content", () => {
  const currentText = "tiếng việt";
  const start = 0;
  const end = currentText.length;
  const baseText = currentText.slice(0, start) + currentText.slice(end);
  const res = processTelexKey(baseText, start, "t");
  assert.equal(res.text, "t");
  assert.equal(res.caret, 1);
});

runTest("Source code review: inputRef synchronizes selection range upon controlled value update", () => {
  const filePath = path.resolve(__dirname, "../src/components/typing/TypingInput.tsx");
  const content = fs.readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("setSelectionRange(value.length, value.length)"),
    "TypingInput should update selection range upon controlled value update"
  );
});

console.log("\n=================================================");
console.log(`   RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log("=================================================");

if (passedTests === totalTests) {
  console.log(">>> ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! <<<");
  process.exit(0);
} else {
  console.error(">>> SOME TESTS FAILED <<<");
  process.exit(1);
}
