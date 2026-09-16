/**
 * Empirical Adversarial Verification Harness
 * Challenger 1: Penalty System (R5) & Heatmap/History (R1)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  applyPenalty,
  calculateDisciplineStreak,
  generateHeatmapGrid,
  recordDailyDiscipline,
  validateAppConfig
} from './e2e/core_logic.mjs';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Not equal'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Deep equality failed'}: expected ${expectedStr}, got ${actualStr}`);
  }
}

console.log('================================================================');
console.log('CHALLENGER 1: EMPIRICAL ADVERSARIAL VERIFICATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: EXTREME INITIAL STATES ON PENALTY SYSTEM (R5)
// -----------------------------------------------------------------------------
console.log('--- Section 1: Adversarial Extreme State Testing (R5 Penalty) ---');

runTest('R5 Extreme State: Level 100, 50,000 XP, 365 streak, massive daily_stats', () => {
  const extremeDailyStats = {};
  for (let i = 1; i <= 365; i++) {
    extremeDailyStats[`2025-01-${String(i).padStart(3, '0')}`] = 120 + (i % 300);
  }

  const extremeConfig = {
    protection_enabled: true,
    blocked_domains: ['facebook.com', 'tiktok.com', 'youtube.com'],
    level: 100,
    xp: 50000,
    streak: 365,
    daily_stats: extremeDailyStats,
    total_focus_hours: 1500,
    violations_count: 5,
    daily_history: {
      '2026-09-15': { focus_minutes: 360, violations: 0, is_clean: true }
    }
  };

  const todayStr = '2026-09-16';
  const penalized = applyPenalty(extremeConfig, todayStr);

  assertEqual(penalized.level, 1, 'Level must be reset to exactly 1');
  assertEqual(penalized.xp, 0, 'XP must be reset to exactly 0');
  assertEqual(penalized.streak, 0, 'Streak must be reset to exactly 0');
  assertDeepEqual(penalized.daily_stats, {}, 'daily_stats must be emptied');
  assertEqual(penalized.violations_count, 6, 'violations_count must increment from 5 to 6');

  // Verify daily_history has today recorded as violation
  assert(penalized.daily_history[todayStr] !== undefined, 'Today must exist in daily_history');
  assertEqual(penalized.daily_history[todayStr].violations, 1, 'Violations count for today must be 1');
  assertEqual(penalized.daily_history[todayStr].is_clean, false, 'Today must be marked is_clean: false');
});

runTest('R5 Repeated Cascading Penalties under extreme load', () => {
  let config = {
    protection_enabled: true,
    blocked_domains: ['x.com'],
    level: 99,
    xp: 999999,
    streak: 500,
    daily_stats: { '2026-09-16': 1000 },
    total_focus_hours: 5000,
    violations_count: 0
  };

  for (let cycle = 1; cycle <= 100; cycle++) {
    config = applyPenalty(config, '2026-09-16');
    assertEqual(config.level, 1, `Cycle ${cycle}: level must be 1`);
    assertEqual(config.xp, 0, `Cycle ${cycle}: xp must be 0`);
    assertEqual(config.streak, 0, `Cycle ${cycle}: streak must be 0`);
    assertDeepEqual(config.daily_stats, {}, `Cycle ${cycle}: daily_stats must be empty`);
    assertEqual(config.violations_count, cycle, `Cycle ${cycle}: violations_count must match cycle count`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 2: LIVE %APPDATA% CONFIG.JSON FILE STATE PERSISTENCE VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- Section 2: Windows %APPDATA% Live State Mutation Verification ---');

runTest('Live %APPDATA% mutation: Inject extreme state, run CLI runner, assert exact disk contents', () => {
  const appData = process.env.APPDATA;
  assert(appData, 'APPDATA environment variable must be defined');

  const appDataDir = path.join(appData, 'com.cainghien.desktop');
  const configPath = path.join(appDataDir, 'config.json');
  const backupPath = path.join(appDataDir, 'config.json.challenger_bak');

  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }

  // Backup original config if exists
  let hadOriginal = false;
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backupPath);
    hadOriginal = true;
  }

  try {
    // 1. Inject extreme initial state
    const injectedState = {
      schema: 2,
      saved_at: new Date().toISOString(),
      data: {
        protection_enabled: true,
        blocked_domains: ['badsite1.com', 'badsite2.com'],
        level: 100,
        xp: 50000,
        streak: 365,
        daily_stats: {
          '2026-09-14': 300,
          '2026-09-15': 420,
          '2026-09-16': 180
        },
        daily_history: {
          '2026-09-15': { focus_minutes: 420, violations: 0, is_clean: true }
        },
        total_focus_hours: 2500,
        violations_count: 7,
        schedule: {
          enabled: true,
          start_time: '08:00',
          end_time: '17:00',
          days_of_week: [1, 2, 3, 4, 5]
        }
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(injectedState, null, 2), 'utf8');

    // 2. Execute CLI penalty runner mimicking --penalty flag
    const cliOutput = execSync(`node tests/e2e/cli_penalty_runner.mjs --penalty`, {
      encoding: 'utf8',
      cwd: process.cwd()
    });
    assert(cliOutput.includes('Successfully applied penalty'), 'CLI runner should report success');

    // 3. Read directly from disk
    const diskContent = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    const diskJson = JSON.parse(diskContent);
    const diskData = diskJson.data ? diskJson.data : diskJson;

    // 4. Assert all extreme values were properly wiped/mutated
    assertEqual(diskData.level, 1, 'Disk level must be 1');
    assertEqual(diskData.xp, 0, 'Disk xp must be 0');
    assertEqual(diskData.streak, 0, 'Disk streak must be 0');
    assertDeepEqual(diskData.daily_stats, {}, 'Disk daily_stats must be empty object');
    assertEqual(diskData.violations_count, 8, 'Disk violations_count must be incremented to 8');
    assertEqual(diskData.protection_enabled, true, 'Disk protection_enabled must be preserved');
    assertEqual(diskData.blocked_domains.length, 2, 'Blocked domains must be preserved');
    assertEqual(diskData.schedule.enabled, true, 'Schedule must be preserved');
  } finally {
    // 5. Restore original config
    if (hadOriginal && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, configPath);
      fs.unlinkSync(backupPath);
    }
  }
});

// -----------------------------------------------------------------------------
// SECTION 3: HEATMAP DATA EDGE CASES (R1)
// -----------------------------------------------------------------------------
console.log('\n--- Section 3: Heatmap Data Edge Cases (R1) ---');

runTest('Heatmap Leap Year: Feb 28 -> Feb 29 -> Mar 1 contiguous streak', () => {
  const history = {
    '2024-02-27': { focus_minutes: 100, violations: 0, is_clean: true },
    '2024-02-28': { focus_minutes: 150, violations: 0, is_clean: true },
    '2024-02-29': { focus_minutes: 200, violations: 0, is_clean: true }, // Leap day
    '2024-03-01': { focus_minutes: 120, violations: 0, is_clean: true },
    '2024-03-02': { focus_minutes: 180, violations: 0, is_clean: true }
  };

  const streak = calculateDisciplineStreak(history, '2024-03-02');
  assertEqual(streak, 5, 'Unbroken streak across leap day must equal 5');

  const grid = generateHeatmapGrid(history, '2024-02-28', '2024-03-01');
  assertEqual(grid.length, 3, 'Grid must contain 3 dates');
  assertEqual(grid[0].date, '2024-02-28');
  assertEqual(grid[1].date, '2024-02-29');
  assertEqual(grid[2].date, '2024-03-01');
  assertEqual(grid[1].intensity, 3, '200 min on Feb 29 should be tier 3 intensity');
});

runTest('Heatmap Leap Year Non-Leap Year Check: Feb 29 missing in 2025', () => {
  // In 2025 (non leap year), Feb 28 -> Mar 1
  const history = {
    '2025-02-28': { focus_minutes: 120, violations: 0, is_clean: true },
    '2025-03-01': { focus_minutes: 180, violations: 0, is_clean: true }
  };

  const streak = calculateDisciplineStreak(history, '2025-03-01');
  assertEqual(streak, 2, 'Streak in non-leap year Feb 28 to Mar 1 must be 2');
});

runTest('Heatmap Year Rollover: Dec 30 -> Dec 31 -> Jan 1 -> Jan 2', () => {
  const rolloverHistory = {
    '2025-12-29': { focus_minutes: 60, violations: 0, is_clean: true },
    '2025-12-30': { focus_minutes: 120, violations: 0, is_clean: true },
    '2025-12-31': { focus_minutes: 240, violations: 0, is_clean: true },
    '2026-01-01': { focus_minutes: 180, violations: 0, is_clean: true },
    '2026-01-02': { focus_minutes: 300, violations: 0, is_clean: true }
  };

  const streak = calculateDisciplineStreak(rolloverHistory, '2026-01-02');
  assertEqual(streak, 5, 'Streak across year rollover boundary must equal 5');

  const grid = generateHeatmapGrid(rolloverHistory, '2025-12-30', '2026-01-02');
  assertEqual(grid.length, 4, 'Grid across year boundary must contain 4 days');
  assertEqual(grid[0].date, '2025-12-30');
  assertEqual(grid[1].date, '2025-12-31');
  assertEqual(grid[2].date, '2026-01-01');
  assertEqual(grid[3].date, '2026-01-02');
});

runTest('Heatmap 0 focus minutes vs clean status: 0 minutes breaks clean streak', () => {
  const baseConfig = {
    level: 2,
    xp: 100,
    streak: 3,
    daily_stats: {},
    daily_history: {
      '2026-09-14': { focus_minutes: 120, violations: 0, is_clean: true },
      '2026-09-15': { focus_minutes: 180, violations: 0, is_clean: true }
    },
    total_focus_hours: 5,
    violations_count: 0
  };

  // Record day with 0 minutes and 0 violations
  const recorded = recordDailyDiscipline(baseConfig, '2026-09-16', 0, 0);
  const rec = recorded.daily_history['2026-09-16'];

  // A day with 0 focus minutes CANNOT be clean (no discipline performed)
  assertEqual(rec.focus_minutes, 0);
  assertEqual(rec.is_clean, false, '0 focus minutes must yield is_clean: false');

  // Streak on 2026-09-16 must be broken to 0
  assertEqual(recorded.streak, 0, 'Streak must break to 0 on 0 focus minutes');
});

runTest('Heatmap 0 focus minutes grid intensity: must be 0 (uncolored)', () => {
  const history = {
    '2026-09-16': { focus_minutes: 0, violations: 0, is_clean: false }
  };

  const grid = generateHeatmapGrid(history, '2026-09-16', '2026-09-16');
  assertEqual(grid[0].intensity, 0, 'Intensity for 0 minutes must be 0');
});

runTest('Heatmap intensity threshold ladder: 1-60 -> 1, 61-180 -> 2, 181-300 -> 3, >300 -> 4', () => {
  const history = {
    '2026-09-01': { focus_minutes: 1, violations: 0, is_clean: true },
    '2026-09-02': { focus_minutes: 60, violations: 0, is_clean: true },
    '2026-09-03': { focus_minutes: 61, violations: 0, is_clean: true },
    '2026-09-04': { focus_minutes: 180, violations: 0, is_clean: true },
    '2026-09-05': { focus_minutes: 181, violations: 0, is_clean: true },
    '2026-09-06': { focus_minutes: 300, violations: 0, is_clean: true },
    '2026-09-07': { focus_minutes: 301, violations: 0, is_clean: true },
    '2026-09-08': { focus_minutes: 1440, violations: 0, is_clean: true }
  };

  const grid = generateHeatmapGrid(history, '2026-09-01', '2026-09-08');
  assertEqual(grid[0].intensity, 1, '1 min -> Tier 1');
  assertEqual(grid[1].intensity, 1, '60 min -> Tier 1');
  assertEqual(grid[2].intensity, 2, '61 min -> Tier 2');
  assertEqual(grid[3].intensity, 2, '180 min -> Tier 2');
  assertEqual(grid[4].intensity, 3, '181 min -> Tier 3');
  assertEqual(grid[5].intensity, 3, '300 min -> Tier 3');
  assertEqual(grid[6].intensity, 4, '301 min -> Tier 4');
  assertEqual(grid[7].intensity, 4, '1440 min -> Tier 4');
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
