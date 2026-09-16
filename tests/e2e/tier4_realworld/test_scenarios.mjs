/**
 * Tier 4: Real-World Application Scenarios (End-to-End User Journeys)
 * Authoritative Source: TEST_INFRA.md §Real-World Application Scenarios (Tier 4)
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assert } from '../test_framework.mjs';
import {
  evaluateSchedule,
  recordDailyDiscipline,
  validateMindfulnessTyping,
  createFocusRoomStateMachine,
  applyPenalty,
  calculateDisciplineStreak,
  generateHeatmapGrid,
  validateAppConfig
} from '../core_logic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/sample_pledges.json'), 'utf8'));

registry.setContext(4, 'Real-World End-to-End User Journeys');

defineTest('T4_SCENARIO_01', 'Scenario 1: Normal Workday Flow (R1, R2 Auto-block and Discipline Logging)', () => {
  // Initial state: User starts day with 3-day streak
  let config = {
    protection_enabled: false,
    blocked_domains: ['facebook.com', 'tiktok.com', 'youtube.com'],
    level: 2,
    xp: 300,
    streak: 3,
    daily_stats: {},
    daily_history: {
      '2026-09-13': { focus_minutes: 360, violations: 0, is_clean: true },
      '2026-09-14': { focus_minutes: 420, violations: 0, is_clean: true },
      '2026-09-15': { focus_minutes: 400, violations: 0, is_clean: true }
    },
    total_focus_hours: 19,
    violations_count: 0,
    schedule: {
      enabled: true,
      start_time: '08:00',
      end_time: '17:00',
      days_of_week: [1, 2, 3, 4, 5] // Mon-Fri
    }
  };

  // Step 1: 07:30 AM before work -> Schedule inactive
  const preWork = evaluateSchedule(config.schedule, '07:30', 3); // Wednesday
  assertFalse(preWork.active, 'Schedule should be inactive at 07:30');

  // Step 2: 08:00 AM work starts -> Schedule automatically activates
  const workStart = evaluateSchedule(config.schedule, '08:00', 3);
  assertTrue(workStart.active, 'Schedule activates auto-block at 08:00');
  config.protection_enabled = true;

  // Step 3: Midday check at 12:30 PM -> Schedule remains active
  const midDay = evaluateSchedule(config.schedule, '12:30', 3);
  assertTrue(midDay.active, 'Schedule remains active midday');

  // Step 4: 17:00 PM workday ends -> Schedule deactivates
  const workEnd = evaluateSchedule(config.schedule, '17:00', 3);
  assertFalse(workEnd.active, 'Schedule deactivates at 17:00');
  config.protection_enabled = false;

  // Step 5: Day stats recorded: 480 minutes focus, 0 violations
  config = recordDailyDiscipline(config, '2026-09-16', 480, 0);

  // Verification: Streak increments from 3 to 4, Heatmap intensity is maximum
  assertEqual(config.streak, 4, 'Streak must advance to 4');
  assertEqual(config.total_focus_hours, 27, 'Total focus hours must reflect +8 hours');
  const grid = generateHeatmapGrid(config.daily_history, '2026-09-16', '2026-09-16');
  assertEqual(grid[0].intensity, 4, '480 minutes yields intensity tier 4');
});

defineTest('T4_SCENARIO_02', 'Scenario 2: Relapse Attempt & Penalty (R3 Mindfulness Barrier -> R5 Wipeout)', () => {
  // Initial state: Experienced user with Level 5, 2500 XP, 14-day streak
  let config = {
    protection_enabled: true,
    blocked_domains: ['facebook.com', 'tiktok.com'],
    level: 5,
    xp: 2500,
    streak: 14,
    daily_stats: { '2026-09-16': 60 },
    daily_history: {
      '2026-09-15': { focus_minutes: 300, violations: 0, is_clean: true }
    },
    total_focus_hours: 60,
    violations_count: 0
  };

  // Step 1: User experiences craving, attempts unlock
  const pledge = fixtures.canonical_pledge;

  // Step 2: User encounters 50-word mindfulness typing barrier
  // User attempts hurried typing with typos
  const hurriedInput = 'Toi cam ket giu vung ky luat khong dau hang truoc cam do nhat thoi...';
  const checkHurried = validateMindfulnessTyping(pledge, hurriedInput);
  assertFalse(checkHurried.valid, 'Hurried typo input must be blocked');

  // Step 3: User abandons or forces stop request -> Penalty triggers
  config = applyPenalty(config, '2026-09-16');

  // Step 4: Verification of complete penalty reset
  assertEqual(config.level, 1, 'Level wiped to 1');
  assertEqual(config.xp, 0, 'XP wiped to 0');
  assertEqual(config.streak, 0, 'Streak wiped to 0');
  assertEqual(config.violations_count, 1, 'Violations count incremented');
  assertFalse(config.daily_history['2026-09-16'].is_clean, 'Heatmap marks day as violated');

  const validation = validateAppConfig(config);
  assertTrue(validation.valid, 'Config remains schema-compliant post-penalty');
});

defineTest('T4_SCENARIO_03', 'Scenario 3: Focus Room Deep Work (R4 Fullscreen Kiosk -> R1 Heatmap Update)', () => {
  // Step 1: User initiates 60-minute Focus Room session
  const room = createFocusRoomStateMachine();
  const enterResult = room.enter();
  assertTrue(enterResult.success, 'Entered Focus Room');
  assertTrue(room.getState().taskbarHidden, 'Taskbar hidden');

  // Step 2: During session, user inadvertently presses Alt+Tab to check browser
  const altTabBlocked = room.isKeySuppressed('Alt+Tab');
  assertTrue(altTabBlocked, 'Alt+Tab shortcut blocked');

  // Step 3: User tries Windows key
  const winBlocked = room.isKeySuppressed('Win');
  assertTrue(winBlocked, 'Windows key blocked');

  // Step 4: Regular typing for notes continues without interruption
  assertFalse(room.isKeySuppressed('KeyT'));
  assertFalse(room.isKeySuppressed('Space'));

  // Step 5: Session timer finishes -> Exit Focus Room
  room.exit();
  assertFalse(room.getState().inFocusRoom);
  assertFalse(room.getState().taskbarHidden);

  // Step 6: Log 60 minutes deep work to daily history
  let config = {
    level: 1,
    xp: 50,
    streak: 0,
    daily_stats: {},
    daily_history: {},
    total_focus_hours: 0,
    violations_count: 0
  };
  config = recordDailyDiscipline(config, '2026-09-16', 60, 0);
  assertEqual(config.daily_history['2026-09-16'].focus_minutes, 60);
  assertTrue(config.daily_history['2026-09-16'].is_clean);
});

defineTest('T4_SCENARIO_04', 'Scenario 4: Schedule Overlap & Manual Override (R2 Schedule, R3 Typing, R5 Penalty)', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  let config = {
    protection_enabled: true,
    level: 3,
    xp: 800,
    streak: 5,
    daily_stats: {},
    violations_count: 0
  };

  // Step 1: At 14:00 on Thursday, schedule is active
  const schedActive = evaluateSchedule(schedule, '14:00', 4);
  assertTrue(schedActive.active);

  // Step 2: User attempts manual override to disable protection
  const pledge = fixtures.canonical_pledge;

  // Step 3: User completes 100% exact typing pledge
  const exactTyping = validateMindfulnessTyping(pledge, pledge);
  assertTrue(exactTyping.valid, 'Mindfulness pledge passed exactly');

  // Step 4: App prompts confirmation: overriding active schedule will trigger penalty
  // User accepts penalty to proceed with emergency unlock
  config = applyPenalty(config, '2026-09-16');
  config.protection_enabled = false;

  // Step 5: Verification of penalty application
  assertEqual(config.level, 1);
  assertEqual(config.xp, 0);
  assertEqual(config.streak, 0);
  assertEqual(config.violations_count, 1);
  assertFalse(config.protection_enabled);
});

defineTest('T4_SCENARIO_05', 'Scenario 5: Post-Penalty Rebuilding (R5 Clean Restart -> R1 Multi-Day Streak Rebuilding)', () => {
  // Step 1: Start from post-penalty state
  let config = {
    protection_enabled: true,
    blocked_domains: ['gambling.com'],
    level: 1,
    xp: 0,
    streak: 0,
    daily_stats: {},
    daily_history: {
      '2026-09-13': { focus_minutes: 40, violations: 1, is_clean: false } // Day of penalty
    },
    total_focus_hours: 0,
    violations_count: 1
  };

  assertEqual(config.streak, 0, 'Initial streak is 0 post-penalty');

  // Step 2: Day 1 of recovery (2026-09-14): 180 min focus, 0 violations
  config = recordDailyDiscipline(config, '2026-09-14', 180, 0);
  assertEqual(config.streak, 1, 'Streak becomes 1 on day 1 clean');

  // Step 3: Day 2 of recovery (2026-09-15): 240 min focus, 0 violations
  config = recordDailyDiscipline(config, '2026-09-15', 240, 0);
  assertEqual(config.streak, 2, 'Streak becomes 2 on day 2 clean');

  // Step 4: Day 3 of recovery (2026-09-16): 300 min focus, 0 violations
  config = recordDailyDiscipline(config, '2026-09-16', 300, 0);
  assertEqual(config.streak, 3, 'Streak becomes 3 on day 3 clean');

  // Step 5: Heatmap visualization reflects recovery arc
  const grid = generateHeatmapGrid(config.daily_history, '2026-09-13', '2026-09-16');
  assertEqual(grid.length, 4);
  assertFalse(grid[0].is_clean, 'Day of penalty remains flagged as violation');
  assertTrue(grid[1].is_clean, 'Rebuild Day 1 is clean');
  assertTrue(grid[2].is_clean, 'Rebuild Day 2 is clean');
  assertTrue(grid[3].is_clean, 'Rebuild Day 3 is clean');
});
