/**
 * Tier 2: Boundary & Corner Cases - R1 Heatmap & Daily History
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assert } from '../test_framework.mjs';
import {
  recordDailyDiscipline,
  calculateDisciplineStreak,
  generateHeatmapGrid,
  validateAppConfig
} from '../core_logic.mjs';

registry.setContext(2, 'R1: Heatmap Boundaries & Edge Conditions');

defineTest('T2_R1_01', 'Empty or missing daily_history object in config defaults safely without throwing', () => {
  const configWithoutHistory = {
    protection_enabled: false,
    blocked_domains: [],
    level: 1,
    xp: 0,
    streak: 0,
    daily_stats: {},
    total_focus_hours: 0,
    violations_count: 0
  };

  const validation = validateAppConfig(configWithoutHistory);
  assertTrue(validation.valid, 'Missing daily_history must be considered valid optional property');

  const streak = calculateDisciplineStreak(undefined, '2026-09-16');
  assertEqual(streak, 0, 'Streak on undefined history must evaluate safely to 0');

  const grid = generateHeatmapGrid(null, '2026-09-01', '2026-09-03');
  assertEqual(grid.length, 3, 'Grid generation on null history must produce empty placeholder cells');
  assertEqual(grid[0].intensity, 0, 'Placeholder cells must have 0 intensity');
});

defineTest('T2_R1_02', 'Leap year February 29 date sequence maintains unbroken streak continuity', () => {
  const leapHistory = {
    '2024-02-28': { focus_minutes: 120, violations: 0, is_clean: true },
    '2024-02-29': { focus_minutes: 180, violations: 0, is_clean: true },
    '2024-03-01': { focus_minutes: 240, violations: 0, is_clean: true }
  };

  const streak = calculateDisciplineStreak(leapHistory, '2024-03-01');
  assertEqual(streak, 3, 'Consecutive clean days spanning Feb 29 leap day must yield unbroken streak of 3');
});

defineTest('T2_R1_03', 'Year rollover boundary (Dec 31 to Jan 1) maintains streak continuity across calendar year', () => {
  const yearRolloverHistory = {
    '2025-12-30': { focus_minutes: 300, violations: 0, is_clean: true },
    '2025-12-31': { focus_minutes: 240, violations: 0, is_clean: true },
    '2026-01-01': { focus_minutes: 180, violations: 0, is_clean: true },
    '2026-01-02': { focus_minutes: 360, violations: 0, is_clean: true }
  };

  const streak = calculateDisciplineStreak(yearRolloverHistory, '2026-01-02');
  assertEqual(streak, 4, 'Streak spanning across year-end rollover must equal 4');
});

defineTest('T2_R1_04', 'Extreme full-day focus duration (1440 minutes / 24 hours) handled without overflow', () => {
  const baseConfig = {
    level: 1,
    xp: 0,
    streak: 0,
    daily_stats: {},
    daily_history: {},
    total_focus_hours: 0,
    violations_count: 0
  };

  const updated = recordDailyDiscipline(baseConfig, '2026-09-16', 1440, 0);
  assertEqual(updated.daily_history['2026-09-16'].focus_minutes, 1440);
  assertEqual(updated.total_focus_hours, 24, 'Total focus hours must reflect full 24 hours');

  const grid = generateHeatmapGrid(updated.daily_history, '2026-09-16', '2026-09-16');
  assertEqual(grid[0].intensity, 4, '1440 minutes must map to maximum intensity tier 4');
});

defineTest('T2_R1_05', 'Defensive handling and clamping of negative or non-integer focus minutes', () => {
  const baseConfig = {
    level: 1,
    xp: 0,
    streak: 0,
    daily_stats: {},
    daily_history: {},
    total_focus_hours: 0,
    violations_count: 0
  };

  // Test negative minutes
  const updatedNeg = recordDailyDiscipline(baseConfig, '2026-09-16', -50, 0);
  assertEqual(updatedNeg.daily_history['2026-09-16'].focus_minutes, 0, 'Negative minutes must be clamped to 0');
  assertFalse(updatedNeg.daily_history['2026-09-16'].is_clean, '0 minutes focus cannot count as clean discipline day');

  // Test fractional minutes
  const updatedFrac = recordDailyDiscipline(baseConfig, '2026-09-16', 75.8, 0);
  assertEqual(updatedFrac.daily_history['2026-09-16'].focus_minutes, 75, 'Fractional minutes must be truncated to integer');
});
