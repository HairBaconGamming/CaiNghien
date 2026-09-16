/**
 * Tier 1: Feature Coverage - R1 Discipline Heatmap & Daily History
 * Authoritative Source: ORIGINAL_REQUEST.md §R1, PROJECT.md §Code Layout & §Interface Contracts
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assert } from '../test_framework.mjs';
import {
  validateAppConfig,
  recordDailyDiscipline,
  calculateDisciplineStreak,
  generateHeatmapGrid
} from '../core_logic.mjs';

registry.setContext(1, 'R1: Discipline Heatmap & Daily History');

defineTest('T1_R1_01', 'Validate DayDisciplineRecord schema conformance in AppConfig', () => {
  const config = {
    protection_enabled: true,
    blocked_domains: ['facebook.com'],
    level: 1,
    xp: 100,
    streak: 3,
    daily_stats: { '2026-09-16': 120 },
    daily_history: {
      '2026-09-14': { focus_minutes: 180, violations: 0, is_clean: true },
      '2026-09-15': { focus_minutes: 240, violations: 0, is_clean: true },
      '2026-09-16': { focus_minutes: 60, violations: 1, is_clean: false }
    },
    total_focus_hours: 8,
    violations_count: 1
  };

  const validation = validateAppConfig(config);
  assertTrue(validation.valid, `Config validation failed: ${validation.errors.join(', ')}`);
  assertEqual(Object.keys(config.daily_history).length, 3, 'Expected 3 daily history records');
});

defineTest('T1_R1_02', 'Clean day recording sets is_clean=true when violations=0 and focus_minutes>0', () => {
  const baseConfig = {
    protection_enabled: true,
    blocked_domains: ['test.com'],
    level: 2,
    xp: 250,
    streak: 0,
    daily_stats: {},
    daily_history: {},
    total_focus_hours: 0,
    violations_count: 0
  };

  const updated = recordDailyDiscipline(baseConfig, '2026-09-16', 150, 0);
  const record = updated.daily_history['2026-09-16'];

  assert(record !== undefined, 'Record for 2026-09-16 must exist');
  assertTrue(record.is_clean, 'is_clean must be true when violations=0 and focus_minutes>0');
  assertEqual(record.focus_minutes, 150, 'focus_minutes must match recorded duration');
  assertEqual(record.violations, 0, 'violations count must be 0');
  assertEqual(updated.streak, 1, 'streak must be incremented to 1');
});

defineTest('T1_R1_03', 'Violation day recording sets is_clean=false when violations>0', () => {
  const baseConfig = {
    protection_enabled: true,
    blocked_domains: ['test.com'],
    level: 3,
    xp: 500,
    streak: 5,
    daily_history: {
      '2026-09-15': { focus_minutes: 200, violations: 0, is_clean: true }
    },
    daily_stats: {},
    total_focus_hours: 3,
    violations_count: 0
  };

  const updated = recordDailyDiscipline(baseConfig, '2026-09-16', 45, 2);
  const record = updated.daily_history['2026-09-16'];

  assertFalse(record.is_clean, 'is_clean must be false when violations>0');
  assertEqual(record.violations, 2, 'violations count must equal 2');
  assertEqual(updated.streak, 0, 'Streak must break to 0 after violation on target date');
});

defineTest('T1_R1_04', 'Consecutive clean days sequence increments streak counter accurately', () => {
  const history = {
    '2026-09-10': { focus_minutes: 120, violations: 0, is_clean: true },
    '2026-09-11': { focus_minutes: 180, violations: 0, is_clean: true },
    '2026-09-12': { focus_minutes: 240, violations: 0, is_clean: true },
    '2026-09-13': { focus_minutes: 300, violations: 0, is_clean: true },
    '2026-09-14': { focus_minutes: 150, violations: 0, is_clean: true }
  };

  const streak = calculateDisciplineStreak(history, '2026-09-14');
  assertEqual(streak, 5, 'Consecutive 5 clean days must yield streak of 5');
});

defineTest('T1_R1_05', 'Heatmap calendar grid generation produces contiguous cells with correct intensity tiers', () => {
  const history = {
    '2026-09-01': { focus_minutes: 0, violations: 0, is_clean: false },
    '2026-09-02': { focus_minutes: 45, violations: 0, is_clean: true },    // Tier 1 (1-60 min)
    '2026-09-03': { focus_minutes: 120, violations: 0, is_clean: true },   // Tier 2 (61-180 min)
    '2026-09-04': { focus_minutes: 240, violations: 0, is_clean: true },   // Tier 3 (181-300 min)
    '2026-09-05': { focus_minutes: 360, violations: 0, is_clean: true }    // Tier 4 (>300 min)
  };

  const grid = generateHeatmapGrid(history, '2026-09-01', '2026-09-05');
  assertEqual(grid.length, 5, 'Expected exactly 5 contiguous date cells');

  assertEqual(grid[0].intensity, 0, '0 minutes must map to intensity 0');
  assertEqual(grid[1].intensity, 1, '45 minutes must map to intensity 1');
  assertEqual(grid[2].intensity, 2, '120 minutes must map to intensity 2');
  assertEqual(grid[3].intensity, 3, '240 minutes must map to intensity 3');
  assertEqual(grid[4].intensity, 4, '360 minutes must map to intensity 4');
});
