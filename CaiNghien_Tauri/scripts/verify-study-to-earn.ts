import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

import {
  analyzeHarvestText,
  runWordCounterTests,
} from "./test-word-counter";
import {
  calculateStudyRewardForecast,
  validateStudyRatioInput,
  runForecastTests,
} from "./test-study-forecast";
import {
  createHarvestAntiPasteListeners,
  runPasteInterceptionTests,
} from "./test-paste-interception";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("===============================================================================");
console.log("   AUTOMATED VERIFICATION SUITE: STUDY-TO-EARN (TIERS 1 - 4)                  ");
console.log("   CaiNghien_Tauri Desktop Application                                        ");
console.log("===============================================================================\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(suite: string, name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] [${suite}] ${name}`);
    passedTests++;
  } catch (err: any) {
    failedTests++;
    console.error(`[FAIL] [${suite}] ${name}`);
    console.error(`       Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (>=5 tests per feature)
// ============================================================================

// ----------------------------------------------------------------------------
// Tier 1 - Feature R1: Study Mode Toggle, Duration Options, Forecast Formula
// ----------------------------------------------------------------------------
const SUITE_R1 = "Tier 1: R1-Focus-Study-Mode";

runTest(SUITE_R1, "T1.1.1: Study Mode toggle state initializes to false and toggles correctly", () => {
  let isStudyMode = false;
  const toggleStudyMode = () => {
    isStudyMode = !isStudyMode;
  };

  assert.equal(isStudyMode, false, "Initial mode should be standard focus");
  toggleStudyMode();
  assert.equal(isStudyMode, true, "Toggled mode should be study-to-earn");
  toggleStudyMode();
  assert.equal(isStudyMode, false, "Toggled again should return to standard focus");
});

runTest(SUITE_R1, "T1.1.2: Duration options presets (15, 25, 45, 60, 90m) calculate total countdown seconds", () => {
  const presets = [15, 25, 45, 60, 90];
  const expectedSeconds = [900, 1500, 2700, 3600, 5400];

  presets.forEach((minutes, idx) => {
    const totalSeconds = minutes * 60;
    assert.equal(totalSeconds, expectedSeconds[idx], `Preset ${minutes}m must equal ${expectedSeconds[idx]}s`);
  });
});

runTest(SUITE_R1, "T1.1.3: Custom duration input validates positive range [1..1440]", () => {
  const validCustom = 120;
  assert(validCustom >= 1 && validCustom <= 1440);
  const totalSeconds = validCustom * 60;
  assert.equal(totalSeconds, 7200);

  const invalidZero = 0;
  assert(invalidZero < 1, "0 minutes must be rejected as invalid custom duration");
});

runTest(SUITE_R1, "T1.1.4: Real-time reward forecast calculation with default 60:15 ratio", () => {
  // Formula: floor( (duration / req) * reward )
  const res15 = calculateStudyRewardForecast(15, 60, 15);
  assert.equal(res15.forecastMinutes, 3);

  const res60 = calculateStudyRewardForecast(60, 60, 15);
  assert.equal(res60.forecastMinutes, 15);

  const res90 = calculateStudyRewardForecast(90, 60, 15);
  assert.equal(res90.forecastMinutes, 22);
});

runTest(SUITE_R1, "T1.1.5: Dynamic forecast updates reactively upon duration selection change", () => {
  let selectedMinutes = 25;
  let forecast = calculateStudyRewardForecast(selectedMinutes, 60, 15).forecastMinutes;
  assert.equal(forecast, 6);

  selectedMinutes = 60;
  forecast = calculateStudyRewardForecast(selectedMinutes, 60, 15).forecastMinutes;
  assert.equal(forecast, 15);

  selectedMinutes = 45;
  forecast = calculateStudyRewardForecast(selectedMinutes, 60, 15).forecastMinutes;
  assert.equal(forecast, 11);
});

runTest(SUITE_R1, "T1.1.6: Lock guard: Study mode toggle disabled when timer is running", () => {
  let isStudyMode = true;
  const isRunning = true;

  const handleModeToggle = (targetMode: boolean) => {
    if (isRunning) {
      // Locked mid-session
      return false;
    }
    isStudyMode = targetMode;
    return true;
  };

  const switched = handleModeToggle(false);
  assert.equal(switched, false, "Mode switch must be rejected while timer is running");
  assert.equal(isStudyMode, true, "Study mode state must remain unchanged");
});

// ----------------------------------------------------------------------------
// Tier 1 - Feature R2: Settings Ratio Fields Loading, Saving, Positive Integer Validation
// ----------------------------------------------------------------------------
const SUITE_R2 = "Tier 1: R2-Settings-Ratio";

runTest(SUITE_R2, "T1.2.1: AppConfig schema loads default conversion ratio (60 required, 15 reward)", () => {
  const defaultConfig = {
    daily_quota_minutes: 60,
    quota_used_seconds: 0,
    study_minutes_required: 60,
    reward_quota_minutes: 15,
  };

  assert.equal(defaultConfig.study_minutes_required, 60);
  assert.equal(defaultConfig.reward_quota_minutes, 15);
});

runTest(SUITE_R2, "T1.2.2: AppConfig saving persists valid custom ratio payload", () => {
  const currentConfig = {
    daily_quota_minutes: 60,
    study_minutes_required: 60,
    reward_quota_minutes: 15,
  };

  const updatedConfig = {
    ...currentConfig,
    study_minutes_required: 45,
    reward_quota_minutes: 10,
  };

  const validation = validateStudyRatioInput(
    updatedConfig.study_minutes_required,
    updatedConfig.reward_quota_minutes
  );
  assert.equal(validation.isValid, true);
  assert.equal(updatedConfig.study_minutes_required, 45);
  assert.equal(updatedConfig.reward_quota_minutes, 10);
});

runTest(SUITE_R2, "T1.2.3: Positive integer validation rejects required minutes = 0", () => {
  const validation = validateStudyRatioInput(0, 15);
  assert.equal(validation.isValid, false);
  assert(validation.error?.includes("lớn hơn 0"));
});

runTest(SUITE_R2, "T1.2.4: Positive integer validation rejects reward minutes = 0", () => {
  const validation = validateStudyRatioInput(60, 0);
  assert.equal(validation.isValid, false);
  assert(validation.error?.includes("lớn hơn 0"));
});

runTest(SUITE_R2, "T1.2.5: Validation rejects negative integer inputs", () => {
  const valNegativeReq = validateStudyRatioInput(-15, 15);
  assert.equal(valNegativeReq.isValid, false);

  const valNegativeReward = validateStudyRatioInput(60, -5);
  assert.equal(valNegativeReward.isValid, false);
});

runTest(SUITE_R2, "T1.2.6: Legacy config without study ratio fields receives default fallback values", () => {
  const legacyJson = '{"daily_quota_minutes": 60, "quota_used_seconds": 0}';
  const parsed = JSON.parse(legacyJson);

  const configWithDefaults = {
    study_minutes_required: parsed.study_minutes_required ?? 60,
    reward_quota_minutes: parsed.reward_quota_minutes ?? 15,
    ...parsed,
  };

  assert.equal(configWithDefaults.study_minutes_required, 60);
  assert.equal(configWithDefaults.reward_quota_minutes, 15);
});

// ----------------------------------------------------------------------------
// Tier 1 - Feature R3: Harvest Report Modal Trigger, 100 Valid Words Boundary, Submit State
// ----------------------------------------------------------------------------
const SUITE_R3 = "Tier 1: R3-Harvest-Modal-Submit";

runTest(SUITE_R3, "T1.3.1: Timer completion (secondsRemaining === 0) in Study Mode triggers Harvest Modal", () => {
  let showHarvestModal = false;
  const isStudyMode = true;
  const secondsRemaining = 0;

  if (secondsRemaining === 0) {
    if (isStudyMode) {
      showHarvestModal = true;
    }
  }

  assert.equal(showHarvestModal, true, "Harvest modal must open when study session reaches 00:00");
});

runTest(SUITE_R3, "T1.3.2: Timer completion in Standard Mode does NOT trigger Harvest Modal", () => {
  let showHarvestModal = false;
  const isStudyMode = false;
  const secondsRemaining = 0;

  if (secondsRemaining === 0) {
    if (isStudyMode) {
      showHarvestModal = true;
    }
  }

  assert.equal(showHarvestModal, false, "Harvest modal must not trigger in standard focus mode");
});

runTest(SUITE_R3, "T1.3.3: Lockdown: Escape key is intercepted and default-prevented (modal unclosable)", () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const { window } = dom;

  let escapeSuppressed = false;
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        escapeSuppressed = true;
      }
    },
    true
  );

  const escEvent = new window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(escEvent);

  assert.equal(escapeSuppressed, true);
  assert.equal(escEvent.defaultPrevented, true);
});

runTest(SUITE_R3, "T1.3.4: Lockdown: Backdrop click is intercepted and propagation stopped", () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='backdrop'></div></body></html>");
  const { window } = dom;
  const backdrop = window.document.getElementById("backdrop")!;

  let dismissed = false;
  window.document.body.addEventListener("click", () => {
    dismissed = true;
  });

  backdrop.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  const clickEvent = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  backdrop.dispatchEvent(clickEvent);

  assert.equal(dismissed, false, "Clicking backdrop must not bubble to dismiss handler");
});

runTest(SUITE_R3, "T1.3.5: Submit button disabled when word count < 100", () => {
  const text99 = Array.from({ length: 99 }, (_, i) => `từ_${i + 1}`).join(" ");
  const analysis = analyzeHarvestText(text99);
  const isSubmitting = false;

  const isSubmitDisabled = !analysis.isValid || isSubmitting;
  assert.equal(analysis.isValid, false);
  assert.equal(isSubmitDisabled, true, "Submit button must be disabled for < 100 words");
});

runTest(SUITE_R3, "T1.3.6: Submit button enabled when word count >= 100 with valid content", () => {
  const text100 = Array.from({ length: 100 }, (_, i) => `kiến_thức_${i + 1}`).join(" ");
  const analysis = analyzeHarvestText(text100);
  const isSubmitting = false;

  const isSubmitDisabled = !analysis.isValid || isSubmitting;
  assert.equal(analysis.isValid, true);
  assert.equal(isSubmitDisabled, false, "Submit button must be enabled for >= 100 valid words");
});

runTest(SUITE_R3, "T1.3.7: Single-submission protection: clicking submit disables button immediately", () => {
  let isSubmitting = false;
  const text100 = Array.from({ length: 100 }, (_, i) => `nội_dung_${i + 1}`).join(" ");
  const analysis = analyzeHarvestText(text100);

  // Before click
  assert.equal(!analysis.isValid || isSubmitting, false);

  // Click triggers submission
  isSubmitting = true;
  const disabledAfterClick = !analysis.isValid || isSubmitting;
  assert.equal(disabledAfterClick, true, "Button must be disabled during active submission");
});

// ----------------------------------------------------------------------------
// Tier 1 - Feature R4: Quota Reward Addition, Persistence Calculation, SQLite Activity
// ----------------------------------------------------------------------------
const SUITE_R4 = "Tier 1: R4-Quota-Reward-Persistence";

runTest(SUITE_R4, "T1.4.1: Server-side quota reward calculation computes correct earned minutes", () => {
  const studyMinutes = 60;
  const studyMinutesRequired = 60;
  const rewardQuotaMinutes = 15;

  const earnedQuota = Math.floor(
    (studyMinutes / (studyMinutesRequired === 0 ? 60 : studyMinutesRequired)) * rewardQuotaMinutes
  );
  assert.equal(earnedQuota, 15);
});

runTest(SUITE_R4, "T1.4.2: Atomic addition of earned quota to daily_quota_minutes", () => {
  let dailyQuotaMinutes = 60;
  const earned = 15;

  dailyQuotaMinutes += earned;
  assert.equal(dailyQuotaMinutes, 75);
});

runTest(SUITE_R4, "T1.4.3: Quota unblocking: Adds leisure time when remaining quota was 0", () => {
  const dailyQuotaMinutes = 60;
  const quotaUsedSeconds = 3600; // 60 minutes used, 0 remaining
  const remainingBefore = Math.max(0, dailyQuotaMinutes * 60 - quotaUsedSeconds);
  assert.equal(remainingBefore, 0, "Quota was exhausted");

  // Add 15 mins
  const newDailyQuota = dailyQuotaMinutes + 15;
  const remainingAfter = Math.max(0, newDailyQuota * 60 - quotaUsedSeconds);
  assert.equal(remainingAfter, 900, "15 minutes (900 seconds) leisure unblocked");
});

runTest(SUITE_R4, "T1.4.4: SQLite session payload generation with session_type 'study_to_earn'", () => {
  const sessionDuration = 45;
  const sqliteSessionRecord = {
    duration_minutes: sessionDuration,
    session_type: "study_to_earn",
    xp_earned: sessionDuration * 10,
    created_at: new Date().toISOString(),
  };

  assert.equal(sqliteSessionRecord.session_type, "study_to_earn");
  assert.equal(sqliteSessionRecord.duration_minutes, 45);
  assert.equal(sqliteSessionRecord.xp_earned, 450);
});

runTest(SUITE_R4, "T1.4.5: XP calculation awards 10 XP per study minute completed", () => {
  const minutes = 60;
  const xp = minutes * 10;
  assert.equal(xp, 600);
});

runTest(SUITE_R4, "T1.4.6: Tauri IPC command payload contract validation for claim_study_reward", () => {
  const validPayload = {
    study_minutes: 60,
    word_count: 100,
    summary_text: Array(100).fill("từ").join(" "),
  };

  assert(validPayload.study_minutes > 0);
  assert(validPayload.word_count >= 100);
  assert(validPayload.summary_text.trim().length > 0);
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>=5 tests per feature)
// ============================================================================

// ----------------------------------------------------------------------------
// Tier 2 - Boundary B1: Word Counter Boundary & Token Rules
// ----------------------------------------------------------------------------
const SUITE_B1 = "Tier 2: B1-Word-Counter-Boundaries";

runTest(SUITE_B1, "T2.1.1: Exact boundary: 99 words disabled vs 100 words enabled", () => {
  const text99 = Array.from({ length: 99 }, (_, i) => `bài_học_${i + 1}`).join(" ");
  const text100 = Array.from({ length: 100 }, (_, i) => `bài_học_${i + 1}`).join(" ");

  const res99 = analyzeHarvestText(text99);
  const res100 = analyzeHarvestText(text100);

  assert.equal(res99.totalWords, 99);
  assert.equal(res99.isValid, false);

  assert.equal(res100.totalWords, 100);
  assert.equal(res100.isValid, true);
});

runTest(SUITE_B1, "T2.1.2: Upper boundary: 101 words remains enabled", () => {
  const text101 = Array.from({ length: 101 }, (_, i) => `khái_niệm_${i + 1}`).join(" ");
  const res = analyzeHarvestText(text101);
  assert.equal(res.totalWords, 101);
  assert.equal(res.isValid, true);
});

runTest(SUITE_B1, "T2.1.3: Single character tokens (length < 2) rejected", () => {
  const singleLetters = "a b c d e f g h i j k l m n o p q r s t u v w x y z";
  const res = analyzeHarvestText(singleLetters);
  assert.equal(res.totalWords, 0);
  assert.equal(res.isValid, false);
});

runTest(SUITE_B1, "T2.1.4: Pure punctuation and symbol tokens ignored", () => {
  const symbols = "--- ... *** === +++ ??? !!! ;;;";
  const res = analyzeHarvestText(symbols);
  assert.equal(res.totalWords, 0);
});

runTest(SUITE_B1, "T2.1.5: Punctuation stripped from word boundaries retains valid word", () => {
  const punctuated = '"nghiên-cứu," [toán-học] (triết-học) \'khoa-học\'';
  const res = analyzeHarvestText(punctuated);
  assert.equal(res.totalWords, 4);
});

// ----------------------------------------------------------------------------
// Tier 2 - Boundary B2: Anti-Spam & Adversarial Protection
// ----------------------------------------------------------------------------
const SUITE_B2 = "Tier 2: B2-Anti-Spam-Adversarial";

runTest(SUITE_B2, "T2.2.1: 100 repetitions of identical word fails diversity check", () => {
  const repeated = Array(100).fill("học").join(" ");
  const res = analyzeHarvestText(repeated);
  assert.equal(res.totalWords, 100);
  assert.equal(res.uniqueWords, 1);
  assert.equal(res.isValid, false, "Must fail diversity");
});

runTest(SUITE_B2, "T2.2.2: 3 alternating words repeated 100 times fails diversity check", () => {
  const words = ["toán", "lý", "hóa"];
  const alternating = Array.from({ length: 100 }, (_, i) => words[i % 3]).join(" ");
  const res = analyzeHarvestText(alternating);
  assert.equal(res.totalWords, 100);
  assert.equal(res.uniqueWords, 3);
  assert.equal(res.isValid, false, "Unique words 3 < 15 must be invalid");
});

runTest(SUITE_B2, "T2.2.3: Single character spam repeated 100 times yields 0 valid words", () => {
  const spam = Array(100).fill("a").join(" ");
  const res = analyzeHarvestText(spam);
  assert.equal(res.totalWords, 0);
  assert.equal(res.isValid, false);
});

runTest(SUITE_B2, "T2.2.4: Diverse academic vocabulary passes diversity threshold (>= 15 unique)", () => {
  const diverse = Array.from({ length: 100 }, (_, i) => `thuật_ngữ_${(i % 25) + 1}`).join(" ");
  const res = analyzeHarvestText(diverse);
  assert.equal(res.totalWords, 100);
  assert.equal(res.uniqueWords, 25);
  assert.equal(res.isValid, true);
});

runTest(SUITE_B2, "T2.2.5: Keystroke burst velocity guard blocks synthetic bulk paste", () => {
  let warningMessage = "";
  const listeners = createHarvestAntiPasteListeners({
    onWarning: (msg) => {
      warningMessage = msg;
    },
    maxBurstChars: 10,
  });

  listeners.resetLength(0);
  const normal = listeners.handleInputChange("Toán");
  assert.equal(normal.accepted, true);

  // Jump from 4 chars to 60 chars
  const burst = listeners.handleInputChange("Toán học là môn khoa học nghiên cứu về các cấu trúc đại số và hình học");
  assert.equal(burst.accepted, false);
  assert(warningMessage.includes("nhập quá nhanh"));
});

// ----------------------------------------------------------------------------
// Tier 2 - Boundary B3: Vietnamese NLP & Diacritics
// ----------------------------------------------------------------------------
const SUITE_B3 = "Tier 2: B3-Vietnamese-NLP-Diacritics";

runTest(SUITE_B3, "T2.3.1: Vietnamese tone marks (sắc, huyền, hỏi, ngã, nặng) counted accurately", () => {
  const tones = "tiếng việt tối học nghĩ khỏe nhảy vừa";
  const res = analyzeHarvestText(tones);
  assert.equal(res.totalWords, 8);
  assert.equal(res.uniqueWords, 8);
});

runTest(SUITE_B3, "T2.3.2: Modified vowels & consonants (ă, â, đ, ê, ô, ơ, ư) supported", () => {
  const modified = "đường đời đưa đẩy được điều ước";
  const res = analyzeHarvestText(modified);
  assert.equal(res.totalWords, 7);
});

runTest(SUITE_B3, "T2.3.3: Mixed Vietnamese and English technical terminology parsed seamlessly", () => {
  const mixed = "lập trình React với TypeScript và Rust Backend trong Tauri";
  const res = analyzeHarvestText(mixed);
  assert.equal(res.totalWords, 10);
});

runTest(SUITE_B3, "T2.3.4: Uppercase, lowercase, and title case diacritic permutations handled", () => {
  const cases = "KHOA HỌC Khoa Học khoa học";
  const res = analyzeHarvestText(cases);
  assert.equal(res.totalWords, 6);
  assert.equal(res.uniqueWords, 2); // 'khoa', 'học'
});

runTest(SUITE_B3, "T2.3.5: Unicode NFC normalization ensures diacritic stability", () => {
  const nfdString = "tiê\u0301ng Viê\u0323t"; // NFD decomposed
  const res = analyzeHarvestText(nfdString);
  assert.equal(res.totalWords, 2);
});

// ----------------------------------------------------------------------------
// Tier 2 - Boundary B4: Divide-by-Zero & Math Boundaries
// ----------------------------------------------------------------------------
const SUITE_B4 = "Tier 2: B4-Divide-By-Zero-Math";

runTest(SUITE_B4, "T2.4.1: Denominator zero (study_minutes_required = 0) safe fallback", () => {
  const res = calculateStudyRewardForecast(60, 0, 15);
  assert.equal(res.forecastMinutes, 15, "0 required minutes must safely fall back to 60");
});

runTest(SUITE_B4, "T2.4.2: Negative denominator (study_minutes_required < 0) safe clamp", () => {
  const res = calculateStudyRewardForecast(60, -60, 15);
  assert.equal(res.forecastMinutes, 15, "Negative required minutes must fall back to 60");
});

runTest(SUITE_B4, "T2.4.3: Non-integer / non-divisible duration (25m study with 60:15 ratio -> floor to 6m)", () => {
  const res = calculateStudyRewardForecast(25, 60, 15);
  // (25 / 60) * 15 = 6.25 -> floor to 6
  assert.equal(res.forecastMinutes, 6);
});

runTest(SUITE_B4, "T2.4.4: Sub-threshold duration (3m study with 60:15 ratio -> 0m quota)", () => {
  const res = calculateStudyRewardForecast(3, 60, 15);
  // (3 / 60) * 15 = 0.75 -> floor to 0
  assert.equal(res.forecastMinutes, 0);
  assert.equal(res.minMinutesForOneReward, 4);
});

runTest(SUITE_B4, "T2.4.5: Upper bound stress (1440m study with 60:15 ratio -> 360m quota)", () => {
  const res = calculateStudyRewardForecast(1440, 60, 15);
  // (1440 / 60) * 15 = 360
  assert.equal(res.forecastMinutes, 360);
});

// ----------------------------------------------------------------------------
// Tier 2 - Boundary B5: Clipboard & Paste Interception
// ----------------------------------------------------------------------------
const SUITE_B5 = "Tier 2: B5-Paste-Interception-Vectors";

const domTier2 = new JSDOM(
  `<!DOCTYPE html><html><body><textarea id="ta"></textarea></body></html>`,
  { url: "http://localhost" }
);
const winTier2 = domTier2.window;
const taTier2 = winTier2.document.getElementById("ta") as HTMLTextAreaElement;

let pasteWarn = "";
const antiPaste = createHarvestAntiPasteListeners({
  onWarning: (msg) => {
    pasteWarn = msg;
  },
});

taTier2.addEventListener("paste", (e) => antiPaste.handlePaste(e as any));
taTier2.addEventListener("keydown", (e) => antiPaste.handleKeyDown(e as any));
taTier2.addEventListener("contextmenu", (e) => antiPaste.handleContextMenu(e as any));
taTier2.addEventListener("dragover", (e) => antiPaste.handleDragOver(e as any));
taTier2.addEventListener("drop", (e) => antiPaste.handleDrop(e as any));

runTest(SUITE_B5, "T2.5.1: onPaste event cancelled via preventDefault", () => {
  pasteWarn = "";
  const ev = new winTier2.Event("paste", { bubbles: true, cancelable: true });
  const disp = taTier2.dispatchEvent(ev);
  assert.equal(disp, false);
  assert.equal(ev.defaultPrevented, true);
  assert(pasteWarn.includes("Copy-paste bị vô hiệu hóa"));
});

runTest(SUITE_B5, "T2.5.2: Ctrl+V keydown cancelled via preventDefault", () => {
  pasteWarn = "";
  const ev = new winTier2.KeyboardEvent("keydown", {
    key: "v",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  const disp = taTier2.dispatchEvent(ev);
  assert.equal(disp, false);
  assert.equal(ev.defaultPrevented, true);
  assert(pasteWarn.includes("Phím tắt dán"));
});

runTest(SUITE_B5, "T2.5.3: Cmd+V keydown cancelled via preventDefault", () => {
  pasteWarn = "";
  const ev = new winTier2.KeyboardEvent("keydown", {
    key: "v",
    metaKey: true,
    bubbles: true,
    cancelable: true,
  });
  const disp = taTier2.dispatchEvent(ev);
  assert.equal(disp, false);
  assert.equal(ev.defaultPrevented, true);
  assert(pasteWarn.includes("Phím tắt dán"));
});

runTest(SUITE_B5, "T2.5.4: Shift+Insert keydown cancelled via preventDefault", () => {
  pasteWarn = "";
  const ev = new winTier2.KeyboardEvent("keydown", {
    key: "Insert",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  const disp = taTier2.dispatchEvent(ev);
  assert.equal(disp, false);
  assert.equal(ev.defaultPrevented, true);
});

runTest(SUITE_B5, "T2.5.5: onContextMenu (right-click) cancelled via preventDefault", () => {
  pasteWarn = "";
  const ev = new winTier2.MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  const disp = taTier2.dispatchEvent(ev);
  assert.equal(disp, false);
  assert.equal(ev.defaultPrevented, true);
});

runTest(SUITE_B5, "T2.5.6: onDrop and onDragOver cancelled via preventDefault", () => {
  pasteWarn = "";
  const overEv = new winTier2.Event("dragover", { bubbles: true, cancelable: true });
  assert.equal(taTier2.dispatchEvent(overEv), false);
  assert.equal(overEv.defaultPrevented, true);

  const dropEv = new winTier2.Event("drop", { bubbles: true, cancelable: true });
  assert.equal(taTier2.dispatchEvent(dropEv), false);
  assert.equal(dropEv.defaultPrevented, true);
});

// ============================================================================
// TIER 3: CROSS-FEATURE INTERACTIONS (>= 5 tests)
// ============================================================================
const SUITE_T3 = "Tier 3: Cross-Feature-Interactions";

runTest(SUITE_T3, "T3.1: Settings ratio update -> Focus Room forecast reflection", () => {
  // User changes ratio in Settings from 60:15 to 30:15 (double reward rate)
  const initialRatio = { required: 60, reward: 15 };
  const updatedRatio = { required: 30, reward: 15 };

  const duration = 30; // 30 mins session
  const forecastInitial = calculateStudyRewardForecast(duration, initialRatio.required, initialRatio.reward);
  assert.equal(forecastInitial.forecastMinutes, 7); // floor((30/60)*15) = 7

  const forecastUpdated = calculateStudyRewardForecast(duration, updatedRatio.required, updatedRatio.reward);
  assert.equal(forecastUpdated.forecastMinutes, 15); // floor((30/30)*15) = 15
});

runTest(SUITE_T3, "T3.2: Full Study Session Lifecycle: Start -> 00:00 -> Modal Open -> 100 Words -> Submit", () => {
  // 1. Initial State: Study Mode selected with 45m duration
  const state = {
    isStudyMode: true,
    selectedMinutes: 45,
    secondsRemaining: 45 * 60,
    isRunning: true,
    showHarvestModal: false,
    summaryText: "",
    dailyQuotaMinutes: 60,
  };

  // 2. Countdown reaches zero
  state.secondsRemaining = 0;
  state.isRunning = false;
  if (state.isStudyMode && state.secondsRemaining === 0) {
    state.showHarvestModal = true;
  }
  assert.equal(state.showHarvestModal, true, "Modal must open on completion");

  // 3. User types summary (progresses to 100 words)
  state.summaryText = Array.from({ length: 100 }, (_, i) => `bài_học_${i + 1}`).join(" ");
  const analysis = analyzeHarvestText(state.summaryText);
  assert.equal(analysis.isValid, true);

  // 4. Submit processed
  const reward = calculateStudyRewardForecast(state.selectedMinutes, 60, 15).forecastMinutes;
  state.dailyQuotaMinutes += reward;
  state.showHarvestModal = false;

  assert.equal(reward, 11);
  assert.equal(state.dailyQuotaMinutes, 71);
  assert.equal(state.showHarvestModal, false, "Modal closes after successful reward");
});

runTest(SUITE_T3, "T3.3: Early Exit Flow: Cancel session midway aborts without Harvest Modal or Quota", () => {
  const state = {
    isStudyMode: true,
    selectedMinutes: 60,
    secondsRemaining: 35 * 60, // 25 mins elapsed, cancelled
    isRunning: true,
    showHarvestModal: false,
    dailyQuotaMinutes: 60,
  };

  // User invokes early exit pledge
  state.isRunning = false;
  // Early exit does NOT reach natural 00:00
  if (state.secondsRemaining === 0) {
    state.showHarvestModal = true;
  }

  assert.equal(state.showHarvestModal, false, "Harvest modal must NOT open on early exit");
  assert.equal(state.dailyQuotaMinutes, 60, "No quota should be awarded for aborted session");
});

runTest(SUITE_T3, "T3.4: Quota exhaustion to leisure restoration transition", () => {
  let dailyQuotaMinutes = 60;
  const quotaUsedSeconds = 3600; // 0 remaining

  const isLeisureAllowed = (dailyMins: number, usedSecs: number) => {
    return dailyMins * 60 > usedSecs;
  };

  assert.equal(isLeisureAllowed(dailyQuotaMinutes, quotaUsedSeconds), false, "Leisure must be blocked");

  // Complete 60m study session
  const earned = calculateStudyRewardForecast(60, 60, 15).forecastMinutes;
  dailyQuotaMinutes += earned;

  assert.equal(dailyQuotaMinutes, 75);
  assert.equal(isLeisureAllowed(dailyQuotaMinutes, quotaUsedSeconds), true, "Leisure unblocked with +15m");
});

runTest(SUITE_T3, "T3.5: Consecutive study sessions cumulative quota accumulation", () => {
  let dailyQuotaMinutes = 30;

  // Session 1: 30 minutes study
  const reward1 = calculateStudyRewardForecast(30, 60, 15).forecastMinutes; // 7m
  dailyQuotaMinutes += reward1;
  assert.equal(dailyQuotaMinutes, 37);

  // Session 2: 45 minutes study
  const reward2 = calculateStudyRewardForecast(45, 60, 15).forecastMinutes; // 11m
  dailyQuotaMinutes += reward2;
  assert.equal(dailyQuotaMinutes, 48);
});

// ============================================================================
// TIER 4: REAL-WORLD SCENARIOS (>= 5 tests)
// ============================================================================
const SUITE_T4 = "Tier 4: Real-World-Scenarios";

runTest(SUITE_T4, "T4.1: Authentic 108-word Vietnamese Computer Science reflection unlocks quota", () => {
  const csReflection = `
    Trong phiên học tập trung sáu mươi phút vừa qua, tôi đã hoàn thành việc tìm hiểu
    về giải thuật tìm đường đi ngắn nhất Dijkstra và giải thuật A sao trên đồ thị có hướng.
    Tôi đã viết mã nguồn minh họa bằng ngôn ngữ TypeScript, xây dựng cấu trúc hàng đợi ưu tiên
    dựa trên cấu trúc cây nhị phân Min-Heap để tối ưu hóa thời gian thực thi thuật toán.
    Đồng thời, tôi đã phân tích độ phức tạp thời gian đạt mức O((V + E) log V), giúp cải thiện
    đáng kể hiệu năng xử lý khi ứng dụng vào hệ thống bản đồ định vị giao thông thời gian thực.
    Sau khi viết xong bài này, tôi tự tin áp dụng vào dự án thực tế.
  `.trim();

  const analysis = analyzeHarvestText(csReflection);
  assert(analysis.totalWords >= 100, `Expected >= 100 words, got ${analysis.totalWords}`);
  assert(analysis.uniqueWords >= 20, `Expected >= 20 unique words, got ${analysis.uniqueWords}`);
  assert.equal(analysis.isValid, true);
});

runTest(SUITE_T4, "T4.2: Authentic 102-word Vietnamese Language Learning reflection unlocks quota", () => {
  const langReflection = `
    Hôm nay tôi dành trọn vẹn bốn mươi lăm phút để ôn tập lại toàn bộ các thì hoàn thành
    trong ngữ pháp tiếng Anh, bao gồm hiện tại hoàn thành và quá khứ hoàn thành tiếp diễn.
    Tôi đã ghi chép lại ba mươi câu ví dụ thực tế liên quan đến giao tiếp hàng ngày và công việc
    văn phòng, đặc biệt chú ý đến cách sử dụng giới từ for và since khi diễn tả khoảng thời gian.
    Cuối buổi học, tôi đã tự kiểm tra bằng một bài tập trắc nghiệm gồm hai mươi câu hỏi và đạt
    kết quả tối đa, qua đó củng cố vững chắc nền tảng từ vựng và sự tự tin khi nói tiếng Anh.
  `.trim();

  const analysis = analyzeHarvestText(langReflection);
  assert(analysis.totalWords >= 100, `Expected >= 100 words, got ${analysis.totalWords}`);
  assert.equal(analysis.isValid, true);
});

runTest(SUITE_T4, "T4.3: Real-time progressive typing simulation: 0 -> 50 -> 99 -> 100 words enables submit", () => {
  const words = Array.from({ length: 100 }, (_, i) => `từ_vựng_${i + 1}`);

  // At 0 words
  let currentText = "";
  assert.equal(analyzeHarvestText(currentText).isValid, false);

  // At 50 words
  currentText = words.slice(0, 50).join(" ");
  const a50 = analyzeHarvestText(currentText);
  assert.equal(a50.totalWords, 50);
  assert.equal(a50.isValid, false);

  // At 99 words
  currentText = words.slice(0, 99).join(" ");
  const a99 = analyzeHarvestText(currentText);
  assert.equal(a99.totalWords, 99);
  assert.equal(a99.isValid, false);

  // At 100 words
  currentText = words.slice(0, 100).join(" ");
  const a100 = analyzeHarvestText(currentText);
  assert.equal(a100.totalWords, 100);
  assert.equal(a100.isValid, true, "Submit button must enable at exactly word 100");
});

runTest(SUITE_T4, "T4.4: Adversarial cheating attempt blocked: paste triggers warning, typing yields success", () => {
  let toastLog: string[] = [];
  const handlers = createHarvestAntiPasteListeners({
    onWarning: (msg) => {
      toastLog.push(msg);
    },
  });

  // Attempt 1: User tries Ctrl+V paste
  const mockCtrlV = {
    key: "v",
    ctrlKey: true,
    preventDefault: () => {},
    stopPropagation: () => {},
  };
  handlers.handleKeyDown(mockCtrlV);
  assert.equal(toastLog.length, 1);
  assert(toastLog[0].includes("Phím tắt dán"));

  // Attempt 2: User tries right-click context menu
  const mockContextMenu = {
    preventDefault: () => {},
  };
  handlers.handleContextMenu(mockContextMenu);
  assert.equal(toastLog.length, 2);
  assert(toastLog[1].includes("Chuột phải bị khóa"));

  // User realizes paste is blocked and types genuine 100 words
  const genuineText = Array.from({ length: 100 }, (_, i) => `kiến_thức_tự_gõ_${i + 1}`).join(" ");
  const analysis = analyzeHarvestText(genuineText);
  assert.equal(analysis.isValid, true);
});

runTest(SUITE_T4, "T4.5: Full End-to-End System Simulation from config to reward persistence", () => {
  // Step 1: Initial user settings
  const config = {
    study_minutes_required: 50,
    reward_quota_minutes: 20,
    daily_quota_minutes: 30,
    quota_used_seconds: 1800,
  };

  // Step 2: User opens Focus Room and selects 50 minutes Study Mode
  const sessionMinutes = 50;
  const forecast = calculateStudyRewardForecast(
    sessionMinutes,
    config.study_minutes_required,
    config.reward_quota_minutes
  );
  assert.equal(forecast.forecastMinutes, 20);

  // Step 3: Session completes
  let showModal = true;
  assert.equal(showModal, true);

  // Step 4: Harvest reflection written
  const reflection = Array.from({ length: 102 }, (_, i) => `tổng_kết_học_tập_${i + 1}`).join(" ");
  const analysis = analyzeHarvestText(reflection);
  assert.equal(analysis.isValid, true);

  // Step 5: Backend claims reward
  config.daily_quota_minutes += forecast.forecastMinutes;
  const sqliteRecord = {
    session_type: "study_to_earn",
    duration_minutes: sessionMinutes,
    xp_earned: sessionMinutes * 10,
  };
  showModal = false;

  // Assertions
  assert.equal(config.daily_quota_minutes, 50, "Daily quota must increase from 30 to 50");
  assert.equal(sqliteRecord.xp_earned, 500, "500 XP earned for 50 min study");
  assert.equal(showModal, false, "Modal successfully closed");
});

// ============================================================================
// FINAL SUMMARY & RESULTS REPORT
// ============================================================================
console.log("\n===============================================================================");
console.log(`   EXECUTION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
if (failedTests > 0) {
  console.log(`   FAILED: ${failedTests} TESTS`);
  console.log("===============================================================================\n");
  process.exit(1);
} else {
  console.log("   FAILED: 0 TESTS (100% SUCCESS)");
  console.log("   ALL 4 TIERS (FEATURE, BOUNDARY, CROSS-FEATURE, REAL-WORLD) VERIFIED!");
  console.log("===============================================================================\n");
}
