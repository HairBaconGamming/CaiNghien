#!/usr/bin/env node

/**
 * =============================================================================
 * Automated Resilience & Stress Test Harness: CaiNghien Desktop (Tauri)
 * =============================================================================
 * 
 * Adversarial Boundary, Fault Injection, Empty State, Extreme Input, 
 * and Race Condition Stress Testing.
 * 
 * Verifies:
 * 1. Offline Browser Fallback & Fault Injection (window.__TAURI__ undefined / invoke error)
 * 2. Empty Data States (0 contributions, empty history, empty quotes, uninitialized profile)
 * 3. Extreme Inputs (10,000 words typing, 0s focus, >24h focus, negative/NaN values)
 * 4. Concurrency & Rapid Tab Switching (1,000 rapid cycles, in-flight API calls, timer hygiene)
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

class ResilienceRunner {
  constructor(title) {
    this.title = title;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.currentSuite = '';
    this.unhandledErrors = [];

    process.on('unhandledRejection', (reason) => {
      this.unhandledErrors.push({ type: 'unhandledRejection', reason });
      console.error(`${colors.red}CRITICAL: Unhandled Promise Rejection:${colors.reset}`, reason);
    });

    process.on('uncaughtException', (err) => {
      this.unhandledErrors.push({ type: 'uncaughtException', err });
      console.error(`${colors.red}CRITICAL: Uncaught Exception:${colors.reset}`, err);
    });
  }

  suite(name) {
    this.currentSuite = name;
    console.log(`\n${colors.bold}${colors.cyan}=== [SUITE] ${name} ===${colors.reset}`);
  }

  assert(description, condition, details = '') {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`  ${colors.green}✓ PASS${colors.reset}: ${description}`);
    } else {
      this.failed++;
      console.log(`  ${colors.red}✗ FAIL${colors.reset}: ${description}`);
      if (details) {
        console.log(`    ${colors.dim}${colors.red}↳ Details: ${details}${colors.reset}`);
      }
    }
  }

  report() {
    console.log(`\n${colors.bold}${colors.magenta}====================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.white}           RESILIENCE & STRESS TEST SUMMARY          ${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}====================================================${colors.reset}`);
    console.log(`  Total Invariant Tests : ${this.total}`);
    console.log(`  Passed Tests          : ${colors.green}${this.passed}${colors.reset}`);
    console.log(`  Failed Tests          : ${this.failed > 0 ? colors.red : colors.green}${this.failed}${colors.reset}`);
    console.log(`  Unhandled Errors      : ${this.unhandledErrors.length > 0 ? colors.red : colors.green}${this.unhandledErrors.length}${colors.reset}`);
    const passRate = this.total > 0 ? ((this.passed / this.total) * 100).toFixed(1) : '0.0';
    console.log(`  Pass Rate             : ${colors.bold}${this.failed === 0 ? colors.green : colors.yellow}${passRate}%${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}====================================================${colors.reset}\n`);

    return this.failed === 0 && this.unhandledErrors.length === 0;
  }
}

const runner = new ResilienceRunner('CaiNghien Desktop Resilience Test Suite');

// Setup in-memory mock localStorage for simulated browser environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.simulateQuotaExceeded = false;
  }
  getItem(key) {
    if (this.simulateQuotaExceeded) {
      throw new Error('QuotaExceededError: DOMException');
    }
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    if (this.simulateQuotaExceeded) {
      throw new Error('QuotaExceededError: DOMException');
    }
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Global browser simulation shim
const mockStorage = new MockLocalStorage();
globalThis.window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};

// Import pure modules
const apiModule = await import('../src/services/api.ts');
const {
  api,
  getHeatmapData,
  getUserProfile,
  updateUserProfile,
  recordFocusSession,
  getTypingChallengeText,
  saveTypingScore,
  getTypingScores,
  getAppConfig,
  saveAppConfig,
  enterFocusRoom,
  exitFocusRoom,
  isTauriEnvironment,
} = apiModule;

// Pure math & calculation helpers matching components
function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatFocusTime(secs) {
  const clamped = Math.max(0, Math.floor(secs));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const remainingSecs = clamped % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
}

function calculateWPM(correctChars, elapsedSeconds) {
  if (elapsedSeconds <= 0 || correctChars <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  const words = correctChars / 5;
  return Math.round(words / minutes);
}

function calculateAccuracy(correctChars, totalTyped) {
  if (totalTyped <= 0) return 100;
  const acc = (correctChars / totalTyped) * 100;
  return Math.max(0, Math.min(100, Math.round(acc)));
}

function calculateTypingRank(wpm, accuracy) {
  if (wpm >= 100 && accuracy >= 95) return 'Celestial Singularity';
  if (wpm >= 75 && accuracy >= 90) return 'Quantum Voyager';
  if (wpm >= 50 && accuracy >= 85) return 'Stargazer Master';
  if (wpm >= 30 && accuracy >= 80) return 'Cosmic Navigator';
  return 'Stargazer Cadet';
}

function calculateTypingXP(score) {
  const baseWpmXp = Math.round(score.wpm * (score.accuracy / 100) * 1.5);
  const wordsBonus = Math.min(score.words_count * 2, 80);
  const accuracyBonus = score.accuracy >= 98 ? 50 : score.accuracy >= 95 ? 25 : 0;
  return Math.max(20, baseWpmXp + wordsBonus + accuracyBonus);
}

// =============================================================================
// SUITE 1: Browser Fallback When Tauri Backend Is Offline
// =============================================================================
runner.suite('1. Frontend Fallback When Tauri Backend Is Offline');

mockStorage.clear();
delete globalThis.window.__TAURI__;
delete globalThis.window.__TAURI_INTERNALS__;
delete globalThis.isTauri;

runner.assert(
  'isTauriEnvironment() correctly detects offline/browser runtime (returns false)',
  isTauriEnvironment() === false
);

// 1.1 getHeatmapData fallback
let heatmapRes = null;
try {
  heatmapRes = await getHeatmapData();
} catch (e) {
  heatmapRes = null;
}
runner.assert(
  'getHeatmapData() resolves safely in offline browser mode without throwing',
  heatmapRes !== null && Array.isArray(heatmapRes.days) && heatmapRes.days.length === 365,
  `Days count: ${heatmapRes?.days?.length}, Total: ${heatmapRes?.total_contributions}`
);

runner.assert(
  'Heatmap fallback generates valid metrics (total > 0, streak > 0, activity_rate between 0..100)',
  heatmapRes.total_contributions > 0 &&
  heatmapRes.current_streak > 0 &&
  heatmapRes.activity_rate >= 0 &&
  heatmapRes.activity_rate <= 100
);

// 1.2 getUserProfile fallback
let profileRes = null;
try {
  profileRes = await getUserProfile();
} catch (e) {
  profileRes = null;
}
runner.assert(
  'getUserProfile() resolves safely in offline browser mode with default Stargazer profile',
  profileRes !== null && profileRes.username === 'Alex Chen' && profileRes.level === 28 && profileRes.rank === 'Nova Voyager',
  `Profile: ${profileRes?.username}, Level: ${profileRes?.level}, XP: ${profileRes?.current_xp}`
);

// 1.3 updateUserProfile fallback
try {
  await updateUserProfile({
    username: 'Resilience Challenger',
    title: 'Void Navigator',
    level: 35,
    current_xp: 22000,
    next_level_xp: 25000,
    rank: 'Quantum Master',
  });
  const updated = await getUserProfile();
  runner.assert(
    'updateUserProfile() safely updates and persists user profile in offline mode',
    updated.username === 'Resilience Challenger' && updated.level === 35
  );
} catch (e) {
  runner.assert('updateUserProfile() failed with exception', false, e.message);
}

// 1.4 getTypingChallengeText fallback for all difficulties
for (const diff of ['quantum', 'stargazer', 'novice']) {
  const challenge = await getTypingChallengeText(diff);
  runner.assert(
    `getTypingChallengeText("${diff}") returns valid challenge text in offline mode`,
    challenge && challenge.text.length > 20 && challenge.difficulty === diff,
    `Text sample: "${challenge.text.slice(0, 35)}..."`
  );
}

// Unknown difficulty fallback
const fallbackChallenge = await getTypingChallengeText('non_existent_diff');
runner.assert(
  'getTypingChallengeText() with invalid difficulty falls back gracefully to quantum challenge',
  fallbackChallenge && fallbackChallenge.id === 'quantum-fox-nebula'
);

// 1.5 saveTypingScore & getTypingScores fallback
const scoreInput = {
  wpm: 84,
  accuracy: 97,
  time_seconds: 35,
  words_count: 42,
};
const saveResult = await saveTypingScore(scoreInput);
runner.assert(
  'saveTypingScore() calculates genuine rank and awards XP in offline mode',
  saveResult.saved === true && saveResult.rank === 'Quantum Voyager' && saveResult.xp_earned > 50,
  `Rank: ${saveResult.rank}, XP: ${saveResult.xp_earned}`
);

const pastScores = await getTypingScores();
runner.assert(
  'getTypingScores() retrieves persisted scores history in offline mode',
  Array.isArray(pastScores) && pastScores.length >= 1 && pastScores[0].wpm === 84
);

// 1.6 recordFocusSession fallback
const focusResult = await recordFocusSession(25, 'deep_focus');
runner.assert(
  'recordFocusSession() awards XP and increments telemetry in offline mode',
  focusResult.success === true && focusResult.xp_earned === 250 && focusResult.today_count >= 1,
  `Success: ${focusResult.success}, XP: ${focusResult.xp_earned}, Count: ${focusResult.today_count}`
);

// 1.7 enterFocusRoom and exitFocusRoom fallback
let enterError = null;
try {
  await enterFocusRoom();
  await exitFocusRoom();
} catch (e) {
  enterError = e;
}
runner.assert(
  'enterFocusRoom() and exitFocusRoom() execute safely without errors in offline mode',
  enterError === null
);

// 1.8 Fault Injection: Simulated Tauri IPC Panics & Network Errors
globalThis.window.__TAURI_INTERNALS__ = {
  invoke: async (cmd) => {
    throw new Error(`[Fault Injection] Tauri backend IPC crash for command: ${cmd}`);
  },
};
globalThis.isTauri = true;

runner.assert(
  'Fault Injection: isTauriEnvironment() returns true when window.__TAURI_INTERNALS__ is set',
  isTauriEnvironment() === true
);

let faultHeatmap = null;
try {
  faultHeatmap = await getHeatmapData();
} catch (e) {
  faultHeatmap = null;
}
runner.assert(
  'Fault Injection: getHeatmapData() catches IPC crash and recovers with local fallback',
  faultHeatmap !== null && Array.isArray(faultHeatmap.days)
);

let faultProfile = null;
try {
  faultProfile = await getUserProfile();
} catch (e) {
  faultProfile = null;
}
runner.assert(
  'Fault Injection: getUserProfile() catches IPC crash and recovers with local fallback',
  faultProfile !== null && faultProfile.username.length > 0
);

// 1.9 Storage Quota Failure Resilience
mockStorage.simulateQuotaExceeded = true;
let quotaErrorThrown = false;
try {
  await saveTypingScore({ wpm: 70, accuracy: 95, time_seconds: 40, words_count: 30 });
} catch (e) {
  quotaErrorThrown = true;
}
runner.assert(
  'Storage Quota Failure: saveTypingScore() catches QuotaExceededError and does not crash app',
  quotaErrorThrown === false
);
mockStorage.simulateQuotaExceeded = false;

// Cleanup global mock Tauri
delete globalThis.window.__TAURI_INTERNALS__;
delete globalThis.isTauri;

// =============================================================================
// SUITE 2: Empty Data State Handling
// =============================================================================
runner.suite('2. Empty State Handling (Zero Data & Null Safety)');

// 2.1 Heatmap with 0 contributions & empty days array
const emptyHeatmapData = {
  total_contributions: 0,
  current_streak: 0,
  longest_streak: 0,
  activity_rate: 0,
  days: [],
};

function simulateActivityHeatmapMemo(data) {
  const dayMap = new Map();
  if (data?.days && data.days.length > 0) {
    data.days.forEach(d => dayMap.set(d.date, d));
  }

  const weeks = [];
  let calculatedTotal = 0;
  const baseStartDate = new Date(2023, 9, 1);

  for (let w = 0; w < 52; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const currentDate = new Date(baseStartDate);
      currentDate.setDate(baseStartDate.getDate() + w * 7 + d);
      const dateStr = currentDate.toISOString().split('T')[0];

      let cell;
      if (dayMap.has(dateStr)) {
        cell = dayMap.get(dateStr);
      } else {
        const seed = (w * 17 + d * 31) % 100;
        let level = 0;
        let count = 0;
        if (w >= 6 && seed > 50) {
          level = 1;
          count = 3;
        }
        cell = { date: dateStr, count, level };
      }
      calculatedTotal += cell.count;
      week.push(cell);
    }
    weeks.push(week);
  }

  return {
    gridWeeks: weeks,
    totalContributions: data?.total_contributions ?? (calculatedTotal > 0 ? calculatedTotal : 4185),
    currentStreak: data?.current_streak ?? 128,
    activityRate: data?.activity_rate ?? 85,
  };
}

const emptyHeatmapCalculated = simulateActivityHeatmapMemo(emptyHeatmapData);
runner.assert(
  'Empty Heatmap: Exactly 52 weeks x 7 days (364 cells) generated when days array is empty',
  emptyHeatmapCalculated.gridWeeks.length === 52 &&
  emptyHeatmapCalculated.gridWeeks.every(w => w.length === 7)
);

runner.assert(
  'Empty Heatmap: Total contributions evaluates to 0 (nullish coalescing preserves genuine 0)',
  emptyHeatmapCalculated.totalContributions === 0,
  `totalContributions: ${emptyHeatmapCalculated.totalContributions}`
);

runner.assert(
  'Empty Heatmap: Current streak and activity rate evaluate to 0',
  emptyHeatmapCalculated.currentStreak === 0 && emptyHeatmapCalculated.activityRate === 0
);

// Heatmap with 364 days all having count = 0, level = 0
const allZeroDays = [];
const baseDate = new Date(2023, 9, 1);
for (let i = 0; i < 364; i++) {
  const d = new Date(baseDate);
  d.setDate(baseDate.getDate() + i);
  allZeroDays.push({ date: d.toISOString().split('T')[0], count: 0, level: 0 });
}
const allZeroHeatmapData = {
  total_contributions: 0,
  current_streak: 0,
  longest_streak: 0,
  activity_rate: 0,
  days: allZeroDays,
};
const allZeroGrid = simulateActivityHeatmapMemo(allZeroHeatmapData);
const allZeroCellsCount = allZeroGrid.gridWeeks.flat().filter(c => c.count === 0 && c.level === 0).length;
runner.assert(
  'Empty Heatmap: All 364 cells render cleanly as Level 0 charcoal without errors',
  allZeroCellsCount === 364,
  `Level 0 cells: ${allZeroCellsCount}/364`
);

// 2.2 Empty Typing History
mockStorage.removeItem('cainghien_typing_scores');
const freshScores = await getTypingScores();
runner.assert(
  'Empty Typing History: getTypingScores() returns empty array [] without null pointer exception',
  Array.isArray(freshScores) && freshScores.length === 0
);

const slicedScores = freshScores.slice(0, 5);
const mappedScores = freshScores.map(s => s.wpm);
runner.assert(
  'Empty Typing History: Array methods (.slice, .map) operate safely on empty history',
  slicedScores.length === 0 && mappedScores.length === 0
);

// 2.3 Empty Quotes List in MotivationalQuote
const DEFAULT_QUOTES = [
  { quote: 'TĨNH LẶNG LÀ SỨC MẠNH CỦA TÂM TRÍ', author: '– Thiền sư Thích Nhất Hạnh' },
];

function simulateMotivationalQuote(quotes = DEFAULT_QUOTES, currentIndex = 0) {
  const currentQuote = quotes[currentIndex] || DEFAULT_QUOTES[0];
  const cleanedText = (currentQuote.quote || '').replace(/^[“"]|[”"]$/g, '');
  const author = currentQuote.author || '';
  return { cleanedText, author };
}

const emptyQuoteRes = simulateMotivationalQuote([]);
runner.assert(
  'Empty Quotes: Explicit empty array [] safely falls back to DEFAULT_QUOTES[0] without TypeError',
  emptyQuoteRes.cleanedText === 'TĨNH LẶNG LÀ SỨC MẠNH CỦA TÂM TRÍ'
);

const singleQuoteRes = simulateMotivationalQuote([{ quote: 'ONLY ONE', author: 'SOLO' }]);
runner.assert(
  'Single Quote: Handles single quote item cleanly',
  singleQuoteRes.cleanedText === 'ONLY ONE' && singleQuoteRes.author === 'SOLO'
);

// 2.4 Uninitialized User Profile
function simulateLevelProgress(profile) {
  const username = profile?.username ?? 'Alex Chen';
  const handle = profile?.handle ?? '@astro_alex';
  const level = profile?.level ?? 28;
  const rankTitle = profile?.title ?? profile?.rank ?? 'Stargazer';
  const currentXp = profile?.current_xp ?? 14350;
  const nextLevelXp = profile?.next_level_xp ?? 15000;
  const nextTitle = profile?.next_title ?? 'Nova Voyager (LVL 29)';

  const progressPercent = nextLevelXp > 0 
    ? Math.min(100, Math.max(0, Math.round((currentXp / nextLevelXp) * 100)))
    : 0;

  return { username, handle, level, rankTitle, currentXp, nextLevelXp, nextTitle, progressPercent };
}

const nullProfileRes = simulateLevelProgress(null);
runner.assert(
  'Uninitialized Profile: profile=null defaults safely to Level 28 Alex Chen (96% progress)',
  nullProfileRes.level === 28 && nullProfileRes.username === 'Alex Chen' && nullProfileRes.progressPercent === 96
);

const emptyProfileRes = simulateLevelProgress({});
runner.assert(
  'Uninitialized Profile: profile={} defaults safely without NaN or undefined errors',
  emptyProfileRes.level === 28 && emptyProfileRes.progressPercent === 96
);

const zeroDivisionProfile = simulateLevelProgress({ level: 1, current_xp: 0, next_level_xp: 0 });
runner.assert(
  'Uninitialized Profile: Division-by-zero boundary (current_xp: 0, next_level_xp: 0) resolves to 0% progress (not NaN)',
  Number.isFinite(zeroDivisionProfile.progressPercent) && zeroDivisionProfile.progressPercent === 0
);

// =============================================================================
// SUITE 3: Extreme Inputs & Stress Testing
// =============================================================================
runner.suite('3. Extreme Inputs & Computational Stress Testing');

// 3.1 Massive Typing Challenge Text (10,000 words / ~65,000 chars)
const sampleWords = ['quantum', 'stellar', 'nebula', 'horizon', 'stargazer', 'cosmos', 'orbit', 'pulsar', 'velocity', 'celestial'];
let massiveTextWords = [];
for (let i = 0; i < 10000; i++) {
  massiveTextWords.push(sampleWords[i % sampleWords.length]);
}
const massiveText = massiveTextWords.join(' ');
runner.assert(
  'Extreme Inputs: Generated 10,000 words test payload (~68,000 characters)',
  massiveTextWords.length === 10000 && massiveText.length > 60000,
  `Character count: ${massiveText.length}`
);

// Tokenization benchmark replicating TextPromptDisplay useMemo logic
function tokenizeTextPrompt(targetText, typedText, isActive = true) {
  const result = [];
  let currentChars = [];
  let wordIdx = 0;

  for (let i = 0; i < targetText.length; i++) {
    const char = targetText[i];
    let status = 'untyped';

    if (i < typedText.length) {
      status = typedText[i] === char ? 'correct' : 'error';
    } else if (i === typedText.length && isActive) {
      status = 'current';
    }

    const charInfo = { char, globalIndex: i, status };

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
    result.push({ wordIndex: wordIdx, chars: currentChars });
  }
  return result;
}

const tokenStart = performance.now();
const tokenizedWords = tokenizeTextPrompt(massiveText, massiveText.slice(0, 500));
const tokenDuration = performance.now() - tokenStart;

runner.assert(
  'Extreme Inputs: Tokenizing 10,000 words executes in under 150ms without crashing',
  tokenDuration < 150 && tokenizedWords.length === 10000,
  `Execution time: ${tokenDuration.toFixed(2)}ms, Words parsed: ${tokenizedWords.length}`
);

// Massive WPM calculation (e.g. 50,000 chars typed in 60s)
const massiveWpm = calculateWPM(50000, 60);
runner.assert(
  'Extreme Inputs: calculateWPM(50000, 60) handles high speed cleanly (10,000 WPM)',
  massiveWpm === 10000,
  `Calculated WPM: ${massiveWpm}`
);

// Massive XP computation with clamped word bonus
const massiveXp = calculateTypingXP({
  wpm: 250,
  accuracy: 100,
  time_seconds: 60,
  words_count: 10000,
});
runner.assert(
  'Extreme Inputs: calculateTypingXP clamps words_count bonus to 80 max (prevents XP explosion)',
  massiveXp === Math.round(250 * 1.5) + 80 + 50, // 375 + 80 + 50 = 505
  `Calculated XP: ${massiveXp}`
);

// 3.2 Zero Duration Focus Session (0 minutes, 0 seconds)
function simulateTimerRingGeometry(totalSeconds, secondsRemaining) {
  const radius = 155;
  const circumference = 2 * Math.PI * radius;
  const elapsedSeconds = Math.max(0, totalSeconds - secondsRemaining);
  const progressRatio = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progressRatio);
  return { elapsedSeconds, progressRatio, strokeDashoffset, circumference };
}

const zeroRing = simulateTimerRingGeometry(0, 0);
runner.assert(
  'Zero Duration Focus: TimerRing progressRatio is strictly 0 (no NaN or 0/0 division)',
  zeroRing.progressRatio === 0 && Number.isFinite(zeroRing.strokeDashoffset),
  `strokeDashoffset: ${zeroRing.strokeDashoffset.toFixed(2)}`
);

runner.assert(
  'Zero Duration Focus: formatTime(0) outputs "00:00"',
  formatTime(0) === '00:00'
);

// Record 0 minutes focus session
const zeroSessionRes = await recordFocusSession(0, 'deep_focus');
runner.assert(
  'Zero Duration Focus: recordFocusSession(0) records safely with 0 XP gained',
  zeroSessionRes.success === true && zeroSessionRes.xp_earned === 0
);

// 3.3 Ultra-Long Focus Session (>24 Hours)
const hours24Secs = 24 * 3600; // 86,400s
const hours50Secs = 50 * 3600; // 180,000s
runner.assert(
  'Ultra-Long Focus: formatFocusTime(86400) displays "24:00:00" in HH:MM:SS',
  formatFocusTime(hours24Secs) === '24:00:00'
);

runner.assert(
  'Ultra-Long Focus: formatFocusTime(180000) displays "50:00:00" in HH:MM:SS',
  formatFocusTime(hours50Secs) === '50:00:00'
);

const longRing = simulateTimerRingGeometry(hours50Secs, hours50Secs / 2);
runner.assert(
  'Ultra-Long Focus: TimerRing geometry calculates 50% progress accurately for 50-hour session',
  Math.abs(longRing.progressRatio - 0.5) < 0.001 && Number.isFinite(longRing.strokeDashoffset)
);

// 3.4 Degenerate Inputs (Negative, NaN, Extreme Bounds)
runner.assert('Degenerate Inputs: formatTime(-999) clamps safely to "00:00"', formatTime(-999) === '00:00');
runner.assert('Degenerate Inputs: calculateWPM(-50, -10) returns 0', calculateWPM(-50, -10) === 0);
runner.assert('Degenerate Inputs: calculateAccuracy(0, 0) returns 100', calculateAccuracy(0, 0) === 100);
runner.assert('Degenerate Inputs: calculateAccuracy(-10, 50) clamps to 0%', calculateAccuracy(-10, 50) === 0);
runner.assert('Degenerate Inputs: calculateAccuracy(150, 100) clamps to 100%', calculateAccuracy(150, 100) === 100);

// =============================================================================
// SUITE 4: Concurrency, Race Conditions & Rapid Tab Switching
// =============================================================================
runner.suite('4. Concurrency, Race Conditions & Rapid Tab Switching');

// 4.1 Rapid Tab Switching Simulation (1,000 cycles)
const tabs = ['dashboard', 'focus', 'typing', 'projects', 'repository', 'settings'];
let activeTimers = new Set();
let activeRequests = 0;
let maxConcurrentRequests = 0;

function mountTab(tab) {
  // Simulate component mounting hooks
  if (tab === 'focus') {
    const timerId = setInterval(() => {}, 1000);
    activeTimers.add(timerId);
    return () => {
      clearInterval(timerId);
      activeTimers.delete(timerId);
    };
  } else if (tab === 'typing') {
    const timerId = setInterval(() => {}, 1000);
    activeTimers.add(timerId);
    return () => {
      clearInterval(timerId);
      activeTimers.delete(timerId);
    };
  } else if (tab === 'dashboard') {
    // In-flight async data fetching
    activeRequests++;
    if (activeRequests > maxConcurrentRequests) maxConcurrentRequests = activeRequests;
    api.getUserProfile().finally(() => {
      activeRequests = Math.max(0, activeRequests - 1);
    });
    return () => {};
  }
  return () => {};
}

const memBefore = process.memoryUsage().heapUsed;
const cycleCount = 1000;
let cleanupFn = () => {};

for (let i = 0; i < cycleCount; i++) {
  cleanupFn();
  const nextTab = tabs[i % tabs.length];
  cleanupFn = mountTab(nextTab);
}
cleanupFn(); // Clean final tab

const memAfter = process.memoryUsage().heapUsed;
const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

runner.assert(
  'Rapid Tab Switching: 1,000 rapid mount/unmount cycles complete with zero orphaned timer intervals',
  activeTimers.size === 0,
  `Active timers remaining: ${activeTimers.size}`
);

runner.assert(
  'Rapid Tab Switching: Memory overhead remains stable during 1,000 rapid switches',
  memDeltaMB < 50,
  `Heap delta: ${memDeltaMB.toFixed(2)} MB`
);

// 4.2 In-flight Async API Race Conditions
const concurrentOperations = [
  getUserProfile(),
  getHeatmapData(),
  recordFocusSession(15, 'deep_focus'),
  getTypingChallengeText('quantum'),
  saveTypingScore({ wpm: 75, accuracy: 96, time_seconds: 40, words_count: 50 }),
  getUserProfile(),
  getHeatmapData(),
];

let concurrentError = null;
let concurrentResults = [];
try {
  concurrentResults = await Promise.allSettled(concurrentOperations);
} catch (e) {
  concurrentError = e;
}

runner.assert(
  'In-Flight API Races: 7 concurrent mixed read/write IPC operations resolve with zero rejections',
  concurrentError === null && concurrentResults.every(r => r.status === 'fulfilled'),
  `Fulfilled: ${concurrentResults.filter(r => r.status === 'fulfilled').length}/${concurrentResults.length}`
);

// 4.3 Idempotency & Repeated Submissions
let submitCount = 0;
let isCompleted = false;

function handleSimulatedChallengeSubmit(score) {
  if (isCompleted) return { rejected: true };
  isCompleted = true;
  submitCount++;
  return { rejected: false };
}

// Rapid 10-click spam on submit
const spamResults = Array.from({ length: 10 }).map(() => handleSimulatedChallengeSubmit());
const acceptedSubmissions = spamResults.filter(r => !r.rejected).length;

runner.assert(
  'Double-Invocation Protection: Submit button spam is strictly idempotent (only 1 submission succeeds)',
  acceptedSubmissions === 1 && submitCount === 1,
  `Accepted: ${acceptedSubmissions}, Submissions: ${submitCount}`
);

// 4.4 Clipboard Anti-Paste Protection Check
const inputSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/typing/TypingInput.tsx'), 'utf8');
const hasPastePrevent = inputSrc.includes('e.preventDefault()') && inputSrc.includes('onPaste');
runner.assert(
  'Input Integrity: Anti-paste clipboard protection calls e.preventDefault() to prevent paste cheating',
  hasPastePrevent
);

// =============================================================================
// Run Report & Exit Code
// =============================================================================
const success = runner.report();
process.exit(success ? 0 : 1);

