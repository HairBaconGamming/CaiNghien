/**
 * Tier 2: Boundary & Corner Cases - R5 Penalty Reset System
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assertDeepEqual } from '../test_framework.mjs';
import { applyPenalty, validateAppConfig } from '../core_logic.mjs';

registry.setContext(2, 'R5: Penalty Boundaries & Edge Conditions');

defineTest('T2_R5_01', 'Zero-state penalty: applying penalty to initial baseline does not cause underflow', () => {
  const initialConfig = {
    protection_enabled: false,
    blocked_domains: ['test.com'],
    level: 1,
    xp: 0,
    streak: 0,
    daily_stats: {},
    total_focus_hours: 0,
    violations_count: 0
  };

  const penalized = applyPenalty(initialConfig);
  assertEqual(penalized.level, 1, 'Level remains 1');
  assertEqual(penalized.xp, 0, 'XP remains 0');
  assertEqual(penalized.streak, 0, 'Streak remains 0');
  assertEqual(penalized.violations_count, 1, 'Violations count increments from 0 to 1');
});

defineTest('T2_R5_02', 'High-value reset boundary: extreme stats (Level 100, 999k XP, 365 streak) reset cleanly', () => {
  const veteranConfig = {
    protection_enabled: true,
    blocked_domains: ['test.com'],
    level: 100,
    xp: 999999,
    streak: 365,
    daily_stats: { '2026-09-16': 500 },
    total_focus_hours: 2000,
    violations_count: 0
  };

  const penalized = applyPenalty(veteranConfig);
  assertEqual(penalized.level, 1, 'Level 100 must be wiped to Level 1');
  assertEqual(penalized.xp, 0, '999,999 XP must be wiped to 0');
  assertEqual(penalized.streak, 0, '365 streak must be wiped to 0');
  assertDeepEqual(penalized.daily_stats, {}, 'daily_stats must be emptied');
});

defineTest('T2_R5_03', 'Consecutive repeated penalties increment violations_count monotonically', () => {
  let config = {
    level: 5,
    xp: 2000,
    streak: 10,
    daily_stats: {},
    violations_count: 0
  };

  for (let i = 1; i <= 5; i++) {
    config = applyPenalty(config);
    assertEqual(config.violations_count, i, `Violation count must be ${i} after ${i} penalties`);
    assertEqual(config.level, 1);
    assertEqual(config.streak, 0);
  }
});

defineTest('T2_R5_04', 'Penalty execution marks today in daily_history as is_clean=false with violation', () => {
  const config = {
    level: 2,
    xp: 100,
    streak: 2,
    daily_stats: {},
    daily_history: {
      '2026-09-15': { focus_minutes: 120, violations: 0, is_clean: true }
    },
    violations_count: 0
  };

  const penalized = applyPenalty(config, '2026-09-16');
  const todayRecord = penalized.daily_history['2026-09-16'];

  assertTrue(todayRecord !== undefined, 'Record for 2026-09-16 must be generated');
  assertFalse(todayRecord.is_clean, 'is_clean on penalized day must be false');
  assertEqual(todayRecord.violations, 1, 'Violations on penalized day must be 1');
});

defineTest('T2_R5_05', 'Partial schema resilience: applying penalty preserves existing valid optional properties', () => {
  const configWithCustomFields = {
    protection_enabled: true,
    blocked_domains: ['example.com'],
    level: 4,
    xp: 1500,
    streak: 12,
    daily_stats: { key: 1 },
    total_focus_hours: 10,
    violations_count: 2,
    schedule: {
      enabled: true,
      start_time: '09:00',
      end_time: '18:00',
      days_of_week: [1, 2, 3]
    }
  };

  const penalized = applyPenalty(configWithCustomFields);
  const validation = validateAppConfig(penalized);

  assertTrue(validation.valid, `Config validation after penalty failed: ${validation.errors.join(', ')}`);
  assertEqual(penalized.schedule.enabled, true, 'Schedule configuration must not be wiped by penalty');
  assertEqual(penalized.schedule.start_time, '09:00');
});
