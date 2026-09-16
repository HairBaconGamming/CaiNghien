/**
 * Tier 1: Feature Coverage - R2 Fixed Schedule Auto-Block & DNS Management
 * Authoritative Source: ORIGINAL_REQUEST.md §R2, PROJECT.md §Code Layout & §Interface Contracts
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse } from '../test_framework.mjs';
import { validateAppConfig, evaluateSchedule } from '../core_logic.mjs';

registry.setContext(1, 'R2: Fixed Schedule Auto-Block');

defineTest('T1_R2_01', 'Validate Schedule configuration model structure in AppConfig', () => {
  const config = {
    protection_enabled: false,
    blocked_domains: ['youtube.com'],
    level: 1,
    xp: 0,
    streak: 0,
    daily_stats: {},
    total_focus_hours: 0,
    violations_count: 0,
    schedule: {
      enabled: true,
      start_time: '08:00',
      end_time: '17:00',
      days_of_week: [1, 2, 3, 4, 5]
    }
  };

  const validation = validateAppConfig(config);
  assertTrue(validation.valid, `Config validation failed: ${validation.errors.join(', ')}`);
  assertEqual(config.schedule.start_time, '08:00');
  assertEqual(config.schedule.end_time, '17:00');
  assertEqual(config.schedule.days_of_week.length, 5);
});

defineTest('T1_R2_02', 'Timestamp within configured working hours evaluates to ACTIVE auto-block', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5] // Monday - Friday
  };

  // 10:30 on Monday (day=1)
  const result = evaluateSchedule(schedule, '10:30', 1);
  assertTrue(result.active, '10:30 on Monday must evaluate to ACTIVE');
  assertEqual(result.reason, 'within_standard_window');
});

defineTest('T1_R2_03', 'Timestamp outside configured working hours evaluates to INACTIVE', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  // 19:30 on Monday (day=1)
  const result = evaluateSchedule(schedule, '19:30', 1);
  assertFalse(result.active, '19:30 on Monday must evaluate to INACTIVE');
  assertEqual(result.reason, 'outside_standard_window');
});

defineTest('T1_R2_04', 'Day not included in days_of_week evaluates to INACTIVE even during window hours', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5] // Mon - Fri only
  };

  // 14:00 on Sunday (day=0)
  const result = evaluateSchedule(schedule, '14:00', 0);
  assertFalse(result.active, '14:00 on Sunday must evaluate to INACTIVE');
  assertEqual(result.reason, 'day_not_scheduled');
});

defineTest('T1_R2_05', 'Disabled schedule flag evaluates to INACTIVE regardless of current time and day', () => {
  const schedule = {
    enabled: false,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  // 09:00 on Wednesday (day=3)
  const result = evaluateSchedule(schedule, '09:00', 3);
  assertFalse(result.active, 'Disabled schedule must always evaluate to INACTIVE');
  assertEqual(result.reason, 'schedule_disabled');
});
