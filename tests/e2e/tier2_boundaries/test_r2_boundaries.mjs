/**
 * Tier 2: Boundary & Corner Cases - R2 Fixed Schedule Auto-Block
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse } from '../test_framework.mjs';
import { evaluateSchedule } from '../core_logic.mjs';

registry.setContext(2, 'R2: Fixed Schedule Boundaries & Edge Conditions');

defineTest('T2_R2_01', 'Exact start minute boundary (08:00:00) transitions immediately to ACTIVE', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  const result = evaluateSchedule(schedule, '08:00', 1);
  assertTrue(result.active, 'Exact start time (08:00) must be inclusive and ACTIVE');
});

defineTest('T2_R2_02', 'Exact end minute boundary (17:00:00) transitions to INACTIVE', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  const result = evaluateSchedule(schedule, '17:00', 1);
  assertFalse(result.active, 'Exact end time (17:00) must be exclusive and INACTIVE');

  // Minute right before end time (16:59) should still be active
  const beforeEnd = evaluateSchedule(schedule, '16:59', 1);
  assertTrue(beforeEnd.active, '16:59 must remain ACTIVE');
});

defineTest('T2_R2_03', 'Overnight shift schedule spanning midnight (22:00 - 06:00) evaluates correctly', () => {
  const overnightSchedule = {
    enabled: true,
    start_time: '22:00',
    end_time: '06:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  // 23:30 (before midnight)
  const lateNight = evaluateSchedule(overnightSchedule, '23:30', 1);
  assertTrue(lateNight.active, '23:30 must be ACTIVE in overnight shift');

  // 03:15 (after midnight)
  const earlyMorning = evaluateSchedule(overnightSchedule, '03:15', 1);
  assertTrue(earlyMorning.active, '03:15 must be ACTIVE in overnight shift');

  // 06:00 (exact end of overnight shift)
  const shiftEnd = evaluateSchedule(overnightSchedule, '06:00', 1);
  assertFalse(shiftEnd.active, '06:00 must be INACTIVE');

  // 12:00 (middle of the day outside shift)
  const daytime = evaluateSchedule(overnightSchedule, '12:00', 1);
  assertFalse(daytime.active, '12:00 must be INACTIVE');
});

defineTest('T2_R2_04', 'Empty days_of_week array never triggers auto-block regardless of time', () => {
  const emptyDaysSchedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: []
  };

  const result = evaluateSchedule(emptyDaysSchedule, '10:00', 1);
  assertFalse(result.active, 'Empty days_of_week must never activate');
  assertEqual(result.reason, 'day_not_scheduled');
});

defineTest('T2_R2_05', 'Malformed time string input handled defensively without unhandled exception', () => {
  const schedule = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1]
  };

  const malformedCurrentTime = evaluateSchedule(schedule, '25:99', 1);
  assertFalse(malformedCurrentTime.active, 'Malformed current time must not activate');

  const invalidSchedule = {
    enabled: true,
    start_time: 'not-a-time',
    end_time: '17:00',
    days_of_week: [1]
  };
  const malformedScheduleTime = evaluateSchedule(invalidSchedule, '10:00', 1);
  assertFalse(malformedScheduleTime.active, 'Malformed schedule start_time must not activate');
});
