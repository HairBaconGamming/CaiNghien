/**
 * Tier 1: Feature Coverage - R5 Penalty Reset System
 * Authoritative Source: ORIGINAL_REQUEST.md §R5, PROJECT.md §Code Layout & §Interface Contracts
 */
import { defineTest, registry, assertEqual, assertDeepEqual } from '../test_framework.mjs';
import { applyPenalty } from '../core_logic.mjs';

registry.setContext(1, 'R5: Penalty Reset System');

defineTest('T1_R5_01', 'Executing penalty resets level to baseline level 1', () => {
  const config = {
    level: 7,
    xp: 3500,
    streak: 21,
    daily_stats: { '2026-09-16': 180 },
    violations_count: 2
  };

  const penalized = applyPenalty(config);
  assertEqual(penalized.level, 1, 'Level must be reset to 1');
});

defineTest('T1_R5_02', 'Executing penalty resets XP to exactly 0', () => {
  const config = {
    level: 5,
    xp: 2250,
    streak: 14,
    daily_stats: {},
    violations_count: 0
  };

  const penalized = applyPenalty(config);
  assertEqual(penalized.xp, 0, 'XP must be reset to 0');
});

defineTest('T1_R5_03', 'Executing penalty resets Streak to exactly 0', () => {
  const config = {
    level: 4,
    xp: 1200,
    streak: 30,
    daily_stats: {},
    violations_count: 1
  };

  const penalized = applyPenalty(config);
  assertEqual(penalized.streak, 0, 'Streak must be reset to 0');
});

defineTest('T1_R5_04', 'Executing penalty empties daily_stats tracking map', () => {
  const config = {
    level: 3,
    xp: 600,
    streak: 8,
    daily_stats: { '2026-09-15': 180, '2026-09-16': 90 },
    violations_count: 0
  };

  const penalized = applyPenalty(config);
  assertDeepEqual(penalized.daily_stats, {}, 'daily_stats must be cleared to empty object');
});

defineTest('T1_R5_05', 'Executing penalty increments violations_count by exactly 1', () => {
  const config = {
    level: 2,
    xp: 300,
    streak: 5,
    daily_stats: {},
    violations_count: 3
  };

  const penalized = applyPenalty(config);
  assertEqual(penalized.violations_count, 4, 'violations_count must increment from 3 to 4');
});
