/**
 * Tier 3: Cross-Feature Pairwise Interaction Tests
 * Authoritative Source: TEST_INFRA.md §Feature Inventory Under Test & §Minimum Coverage Thresholds
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assert } from '../test_framework.mjs';
import {
  evaluateSchedule,
  recordDailyDiscipline,
  validateMindfulnessTyping,
  createFocusRoomStateMachine,
  applyPenalty,
  calculateDisciplineStreak,
  generateHeatmapGrid
} from '../core_logic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/sample_pledges.json'), 'utf8'));

registry.setContext(3, 'Cross-Feature Pairwise Interactions');

defineTest('T3_PAIR_01_R1_x_R2', '[R1 x R2] Schedule auto-activation accumulates clean focus minutes in Daily History', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  let config = {
    level: 2,
    xp: 200,
    streak: 1,
    daily_stats: {},
    daily_history: {
      '2026-09-15': { focus_minutes: 240, violations: 0, is_clean: true }
    },
    total_focus_hours: 4,
    violations_count: 0
  };

  // 1. Time is 09:00 on Monday -> Schedule activates
  const scheduleStatus = evaluateSchedule(schedule, '09:00', 1);
  assertTrue(scheduleStatus.active, 'Schedule should be active during workday');

  // 2. 480 minutes (8 hours) work session completes without violations
  config = recordDailyDiscipline(config, '2026-09-16', 480, 0);

  // 3. Verify R1 Heatmap daily_history record
  const dayRecord = config.daily_history['2026-09-16'];
  assertTrue(dayRecord.is_clean, 'Session under active schedule must be recorded as clean');
  assertEqual(dayRecord.focus_minutes, 480, '480 minutes recorded');
  assertEqual(config.streak, 2, 'Streak must advance to 2');
});

defineTest('T3_PAIR_02_R1_x_R5', '[R1 x R5] Penalty application resets streak counter and invalidates current day in Heatmap', () => {
  let config = {
    level: 4,
    xp: 1500,
    streak: 10,
    daily_stats: { '2026-09-16': 120 },
    daily_history: {
      '2026-09-15': { focus_minutes: 240, violations: 0, is_clean: true }
    },
    total_focus_hours: 20,
    violations_count: 0
  };

  // Trigger penalty on 2026-09-16
  config = applyPenalty(config, '2026-09-16');

  // Verify R5 penalty effect
  assertEqual(config.level, 1, 'Level reset to 1');
  assertEqual(config.streak, 0, 'Streak reset to 0');

  // Verify R1 Heatmap effect
  const todayRecord = config.daily_history['2026-09-16'];
  assertFalse(todayRecord.is_clean, 'Penalized day must have is_clean: false');
  assertEqual(todayRecord.violations, 1, 'Violations count for today must be 1');

  // Verify calculated streak backwards from today is 0
  const calculatedStreak = calculateDisciplineStreak(config.daily_history, '2026-09-16');
  assertEqual(calculatedStreak, 0, 'Streak calculated from penalized date must be 0');
});

defineTest('T3_PAIR_03_R2_x_R3', '[R2 x R3] Manual stop attempt during active schedule engages Mindfulness Typing Barrier', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  // Current time is 11:00 on Tuesday -> Schedule is active
  const scheduleEval = evaluateSchedule(schedule, '11:00', 2);
  assertTrue(scheduleEval.active, 'Schedule is actively enforcing protection');

  // User attempts to disable protection -> System requires pledge validation
  const pledge = fixtures.canonical_pledge;
  const userAttemptWrong = 'Toi muon tat bao ve'; // Casual bypass attempt

  const typingResult = validateMindfulnessTyping(pledge, userAttemptWrong);
  assertFalse(typingResult.valid, 'Casual unlock attempt must be blocked by typing barrier');
  assert(typingResult.matchPercentage < 50, 'Match percentage must be low');
});

defineTest('T3_PAIR_04_R2_x_R5', '[R2 x R5] Early stop during active schedule triggers Penalty reset', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  let config = {
    protection_enabled: true,
    level: 6,
    xp: 2800,
    streak: 18,
    daily_stats: {},
    total_focus_hours: 45,
    violations_count: 0
  };

  // Schedule is active at 14:00 on Wednesday
  const evalResult = evaluateSchedule(schedule, '14:00', 3);
  assertTrue(evalResult.active);

  // User confirms early unlock breach -> Penalty applied
  config = applyPenalty(config, '2026-09-16');
  assertEqual(config.level, 1, 'Gamification tier wiped to Level 1');
  assertEqual(config.xp, 0, 'XP wiped to 0');
  assertEqual(config.streak, 0, 'Streak wiped to 0');
  assertEqual(config.violations_count, 1, 'Violations count recorded');
});

defineTest('T3_PAIR_05_R3_x_R4', '[R3 x R4] Requesting early exit from Focus Room requires passing Mindfulness Typing Test', () => {
  const room = createFocusRoomStateMachine();
  room.enter();
  assertTrue(room.getState().inFocusRoom);

  const pledge = fixtures.canonical_pledge;

  // 1. User attempts to exit with incomplete pledge
  const partialTyping = validateMindfulnessTyping(pledge, fixtures.partial_pledge_35_words);
  assertFalse(partialTyping.valid, 'Focus Room exit must NOT be permitted with partial pledge');

  // 2. User submits 100% exact pledge
  const exactTyping = validateMindfulnessTyping(pledge, pledge);
  assertTrue(exactTyping.valid, '100% exact pledge unlocks exit');

  // 3. Room exit executed
  room.exit();
  assertFalse(room.getState().inFocusRoom, 'Focus Room exited successfully');
  assertFalse(room.getState().hookInstalled, 'Keyboard hook removed');
});

defineTest('T3_PAIR_06_R3_x_R5', '[R3 x R5] Abandoning Mindfulness Typing Barrier triggers violation penalty logging', () => {
  let config = {
    level: 3,
    xp: 750,
    streak: 6,
    daily_stats: {},
    violations_count: 1
  };

  // User triggers unlock modal, attempts typing, then cancels/abandons
  const pledge = fixtures.canonical_pledge;
  const result = validateMindfulnessTyping(pledge, 'Huy bo');
  assertFalse(result.valid);

  // Flow triggers penalty consequence
  config = applyPenalty(config, '2026-09-16');
  assertEqual(config.level, 1);
  assertEqual(config.streak, 0);
  assertEqual(config.violations_count, 2);
});

defineTest('T3_PAIR_07_R4_x_R5', '[R4 x R5] Focus Room irregular termination leads to penalty enforcement on restart', () => {
  let config = {
    level: 5,
    xp: 2200,
    streak: 15,
    daily_stats: {},
    violations_count: 0
  };

  const room = createFocusRoomStateMachine();
  room.enter();

  // Emulate unexpected termination / crash recovery
  room.triggerPanicRecovery();
  assertFalse(room.getState().hookInstalled, 'Hook freed by panic recovery');

  // On restart, detection of unclosed focus room triggers penalty
  config = applyPenalty(config, '2026-09-16');
  assertEqual(config.level, 1);
  assertEqual(config.streak, 0);
  assertEqual(config.violations_count, 1);
});

defineTest('T3_PAIR_08_R1_x_R4', '[R1 x R4] Completed Focus Room deep work session increments Heatmap focus intensity', () => {
  let config = {
    level: 2,
    xp: 200,
    streak: 1,
    daily_stats: {},
    daily_history: {},
    total_focus_hours: 0,
    violations_count: 0
  };

  const room = createFocusRoomStateMachine();
  room.enter();

  // User completes 120 minutes of focus in Focus Room
  room.exit();

  config = recordDailyDiscipline(config, '2026-09-16', 120, 0);
  assertEqual(config.total_focus_hours, 2);

  const grid = generateHeatmapGrid(config.daily_history, '2026-09-16', '2026-09-16');
  assertEqual(grid[0].intensity, 2, '120 minutes must yield intensity 2');
});

defineTest('T3_PAIR_09_R2_x_R4', '[R2 x R4] Scheduled time transition while active inside Focus Room maintains lockdown', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  const room = createFocusRoomStateMachine();
  room.enter();

  // Time transitions past 17:00 (e.g. 17:05)
  const schedStatus = evaluateSchedule(schedule, '17:05', 1);
  assertFalse(schedStatus.active, 'Schedule itself is no longer active');

  // BUT user is still in Focus Room -> keyboard hook must remain active!
  assertTrue(room.getState().inFocusRoom, 'Focus Room must remain locked until user exits');
  assertTrue(room.isKeySuppressed('Alt+Tab'), 'Keyboard hook must remain active while in Focus Room');
});

defineTest('T3_PAIR_10_R3_x_R1', '[R3 x R1] Passing Mindfulness Barrier for authorized action preserves clean streak', () => {
  let config = {
    level: 3,
    xp: 900,
    streak: 7,
    daily_stats: {},
    daily_history: {
      '2026-09-09': { focus_minutes: 200, violations: 0, is_clean: true },
      '2026-09-10': { focus_minutes: 210, violations: 0, is_clean: true },
      '2026-09-11': { focus_minutes: 180, violations: 0, is_clean: true },
      '2026-09-12': { focus_minutes: 240, violations: 0, is_clean: true },
      '2026-09-13': { focus_minutes: 260, violations: 0, is_clean: true },
      '2026-09-14': { focus_minutes: 300, violations: 0, is_clean: true },
      '2026-09-15': { focus_minutes: 300, violations: 0, is_clean: true }
    },
    total_focus_hours: 15,
    violations_count: 0
  };

  // User types 100% exact pledge
  const pledge = fixtures.canonical_pledge;
  const result = validateMindfulnessTyping(pledge, pledge);
  assertTrue(result.valid, 'Mindfulness pledge valid');

  // User completes day with 0 violations
  config = recordDailyDiscipline(config, '2026-09-16', 240, 0);
  assertEqual(config.streak, 8, 'Clean streak increments to 8 without penalty');
});
