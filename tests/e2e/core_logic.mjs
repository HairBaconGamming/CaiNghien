/**
 * ============================================================================
 * CaiNghien Core 5 Features - Canonical Specification & Logic Verification Engine
 * ============================================================================
 *
 * Implements the authoritative mathematical, model, and behavioral contracts
 * specified in ORIGINAL_REQUEST.md and PROJECT.md:
 * - R1: Discipline Heatmap & Daily History
 * - R2: Fixed Schedule Auto-Block & DNS Management
 * - R3: Mindfulness Commitment Typing Barrier
 * - R4: Focus Room Kiosk & Keyboard Hook Suppression
 * - R5: Penalty Reset System
 */

/**
 * Validates an AppConfig object against the PROJECT.md TypeScript interface.
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAppConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['AppConfig must be a non-null object'] };
  }

  // Required fields
  if (typeof config.protection_enabled !== 'boolean') {
    errors.push('protection_enabled must be a boolean');
  }
  if (!Array.isArray(config.blocked_domains)) {
    errors.push('blocked_domains must be an array of strings');
  } else {
    for (let i = 0; i < config.blocked_domains.length; i++) {
      if (typeof config.blocked_domains[i] !== 'string') {
        errors.push(`blocked_domains[${i}] must be a string`);
      }
    }
  }

  if (typeof config.level !== 'number' || config.level < 1 || !Number.isInteger(config.level)) {
    errors.push('level must be an integer >= 1');
  }
  if (typeof config.xp !== 'number' || config.xp < 0) {
    errors.push('xp must be a number >= 0');
  }
  if (typeof config.streak !== 'number' || config.streak < 0 || !Number.isInteger(config.streak)) {
    errors.push('streak must be an integer >= 0');
  }
  if (typeof config.total_focus_hours !== 'number' || config.total_focus_hours < 0) {
    errors.push('total_focus_hours must be a number >= 0');
  }
  if (typeof config.violations_count !== 'number' || config.violations_count < 0) {
    errors.push('violations_count must be a number >= 0');
  }

  if (!config.daily_stats || typeof config.daily_stats !== 'object' || Array.isArray(config.daily_stats)) {
    errors.push('daily_stats must be a key-value record object');
  }

  if (config.daily_history !== undefined && config.daily_history !== null) {
    if (typeof config.daily_history !== 'object' || Array.isArray(config.daily_history)) {
      errors.push('daily_history must be a key-value record object');
    } else {
      for (const [date, record] of Object.entries(config.daily_history)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          errors.push(`daily_history key '${date}' must be formatted YYYY-MM-DD`);
        }
        if (!record || typeof record !== 'object') {
          errors.push(`daily_history['${date}'] must be an object`);
        } else {
          if (typeof record.focus_minutes !== 'number' || record.focus_minutes < 0) {
            errors.push(`daily_history['${date}'].focus_minutes must be a number >= 0`);
          }
          if (typeof record.violations !== 'number' || record.violations < 0) {
            errors.push(`daily_history['${date}'].violations must be a number >= 0`);
          }
          if (typeof record.is_clean !== 'boolean') {
            errors.push(`daily_history['${date}'].is_clean must be a boolean`);
          }
        }
      }
    }
  }

  if (config.schedule !== undefined && config.schedule !== null) {
    if (typeof config.schedule !== 'object') {
      errors.push('schedule must be an object');
    } else {
      if (typeof config.schedule.enabled !== 'boolean') {
        errors.push('schedule.enabled must be a boolean');
      }
      if (typeof config.schedule.start_time !== 'string' || !/^\d{2}:\d{2}$/.test(config.schedule.start_time)) {
        errors.push('schedule.start_time must be a string in HH:MM format');
      }
      if (typeof config.schedule.end_time !== 'string' || !/^\d{2}:\d{2}$/.test(config.schedule.end_time)) {
        errors.push('schedule.end_time must be a string in HH:MM format');
      }
      if (!Array.isArray(config.schedule.days_of_week)) {
        errors.push('schedule.days_of_week must be an array of numbers');
      } else {
        for (const day of config.schedule.days_of_week) {
          if (typeof day !== 'number' || day < 0 || day > 6 || !Number.isInteger(day)) {
            errors.push(`schedule day '${day}' must be an integer between 0 (Sunday) and 6 (Saturday)`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Executes the Penalty reset operation (R5) per PROJECT.md interface contract.
 * Resets level to 1, xp to 0, streak to 0, daily_stats to empty,
 * increments violations_count, and marks today's record in daily_history as violated.
 * @param {object} config
 * @param {string} [todayStr] Optional ISO date YYYY-MM-DD
 * @returns {object} Updated AppConfig clone
 */
export function applyPenalty(config, todayStr = null) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config supplied to applyPenalty');
  }

  const updated = JSON.parse(JSON.stringify(config));
  const today = todayStr || new Date().toISOString().slice(0, 10);

  updated.level = 1;
  updated.xp = 0;
  updated.streak = 0;
  updated.daily_stats = {};
  updated.violations_count = (updated.violations_count || 0) + 1;

  if (!updated.daily_history) {
    updated.daily_history = {};
  }

  const existingToday = updated.daily_history[today] || {
    focus_minutes: 0,
    violations: 0,
    is_clean: true
  };

  updated.daily_history[today] = {
    focus_minutes: existingToday.focus_minutes,
    violations: existingToday.violations + 1,
    is_clean: false
  };

  return updated;
}

/**
 * Evaluates whether a configured Fixed Schedule (R2) is currently active.
 * @param {object} schedule
 * @param {Date|string} currentTime Date object or time string "HH:MM" (with optional dayOfWeek)
 * @param {number} [dayOfWeek] 0=Sunday, 1=Monday, ..., 6=Saturday (if currentTime is string)
 * @returns {{ active: boolean, reason: string }}
 */
export function evaluateSchedule(schedule, currentTime, dayOfWeek = null) {
  if (!schedule || !schedule.enabled) {
    return { active: false, reason: 'schedule_disabled' };
  }

  if (!schedule.start_time || !schedule.end_time || !Array.isArray(schedule.days_of_week)) {
    return { active: false, reason: 'invalid_schedule_structure' };
  }

  // Parse time and day
  let currentMinutes = 0;
  let currentDay = 0;

  if (currentTime instanceof Date) {
    currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    currentDay = currentTime.getDay();
  } else if (typeof currentTime === 'string') {
    const parts = currentTime.split(':');
    if (parts.length < 2) return { active: false, reason: 'malformed_current_time' };
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return { active: false, reason: 'malformed_current_time' };
    }
    currentMinutes = h * 60 + m;
    currentDay = typeof dayOfWeek === 'number' ? dayOfWeek : 1; // Default to Monday if not specified
  } else {
    return { active: false, reason: 'unsupported_time_type' };
  }

  // Check days of week
  if (!schedule.days_of_week.includes(currentDay)) {
    return { active: false, reason: 'day_not_scheduled' };
  }

  // Parse schedule start/end
  const startParts = schedule.start_time.split(':');
  const endParts = schedule.end_time.split(':');
  if (startParts.length !== 2 || endParts.length !== 2) {
    return { active: false, reason: 'malformed_schedule_times' };
  }

  const startH = parseInt(startParts[0], 10);
  const startM = parseInt(startParts[1], 10);
  const endH = parseInt(endParts[0], 10);
  const endM = parseInt(endParts[1], 10);

  if (isNaN(startH) || isNaN(startM) || startH < 0 || startH > 23 || startM < 0 || startM > 59) {
    return { active: false, reason: 'malformed_start_time' };
  }
  if (isNaN(endH) || isNaN(endM) || endH < 0 || endH > 23 || endM < 0 || endM > 59) {
    return { active: false, reason: 'malformed_end_time' };
  }

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Standard day shift: e.g. 08:00 to 17:00
    // Active if startMinutes <= currentMinutes < endMinutes
    const isActive = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    return {
      active: isActive,
      reason: isActive ? 'within_standard_window' : 'outside_standard_window'
    };
  } else {
    // Overnight shift: e.g. 22:00 to 06:00
    // Active if currentMinutes >= startMinutes OR currentMinutes < endMinutes
    const isActive = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    return {
      active: isActive,
      reason: isActive ? 'within_overnight_window' : 'outside_overnight_window'
    };
  }
}

/**
 * Validates the Mindfulness Typing Test (R3).
 * Requires 100% exact character-by-character match.
 * Normalizes Unicode using NFC.
 * @param {string} pledge
 * @param {string} userInput
 * @returns {{
 *   valid: boolean,
 *   matchPercentage: number,
 *   wordCount: number,
 *   errorIndex: number | null,
 *   errorMessage: string | null
 * }}
 */
export function validateMindfulnessTyping(pledge, userInput) {
  if (typeof pledge !== 'string' || typeof userInput !== 'string') {
    return {
      valid: false,
      matchPercentage: 0,
      wordCount: 0,
      errorIndex: 0,
      errorMessage: 'Inputs must be strings'
    };
  }

  const normPledge = pledge.normalize('NFC');
  const normInput = userInput.normalize('NFC');

  const words = normPledge.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (normInput.length === 0) {
    return {
      valid: false,
      matchPercentage: 0,
      wordCount,
      errorIndex: 0,
      errorMessage: 'User input is empty'
    };
  }

  // Character-by-character comparison
  let matchingChars = 0;
  const minLen = Math.min(normPledge.length, normInput.length);
  let firstErrorIndex = null;

  for (let i = 0; i < minLen; i++) {
    if (normPledge[i] === normInput[i]) {
      matchingChars++;
    } else {
      if (firstErrorIndex === null) {
        firstErrorIndex = i;
      }
      break;
    }
  }

  const matchPercentage = Math.floor((matchingChars / normPledge.length) * 100);

  if (normPledge === normInput) {
    return {
      valid: true,
      matchPercentage: 100,
      wordCount,
      errorIndex: null,
      errorMessage: null
    };
  }

  const errorIdx = firstErrorIndex !== null ? firstErrorIndex : minLen;
  let errMsg = 'Input does not match pledge';
  if (normInput.length < normPledge.length) {
    errMsg = `Incomplete input (${normInput.length}/${normPledge.length} characters)`;
  } else if (normInput.length > normPledge.length) {
    errMsg = `Input exceeds pledge length (${normInput.length}/${normPledge.length} characters)`;
  } else {
    errMsg = `Mismatch at position ${errorIdx}: expected '${normPledge[errorIdx]}' but got '${normInput[errorIdx]}'`;
  }

  return {
    valid: false,
    matchPercentage,
    wordCount,
    errorIndex: errorIdx,
    errorMessage: errMsg
  };
}

/**
 * Records a day's discipline record into daily_history and updates streak (R1).
 * @param {object} config
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} focusMinutes
 * @param {number} violations
 * @returns {object} Updated AppConfig clone
 */
export function recordDailyDiscipline(config, dateStr, focusMinutes, violations) {
  const updated = JSON.parse(JSON.stringify(config));
  if (!updated.daily_history) {
    updated.daily_history = {};
  }

  // Clamp focus minutes
  const safeMinutes = Math.max(0, Math.floor(focusMinutes || 0));
  const safeViolations = Math.max(0, Math.floor(violations || 0));
  const isClean = safeViolations === 0 && safeMinutes > 0;

  updated.daily_history[dateStr] = {
    focus_minutes: safeMinutes,
    violations: safeViolations,
    is_clean: isClean
  };

  // Recalculate streak
  updated.streak = calculateDisciplineStreak(updated.daily_history, dateStr);

  // Update total focus hours
  const totalMinutes = Object.values(updated.daily_history).reduce(
    (sum, day) => sum + (day.focus_minutes || 0),
    0
  );
  updated.total_focus_hours = Math.floor(totalMinutes / 60);

  return updated;
}

/**
 * Calculates streak (consecutive clean days ending on targetDate).
 * @param {Record<string, { is_clean: boolean }>} dailyHistory
 * @param {string} targetDate YYYY-MM-DD
 * @returns {number}
 */
export function calculateDisciplineStreak(dailyHistory, targetDate) {
  if (!dailyHistory || typeof dailyHistory !== 'object') return 0;

  let streak = 0;
  const current = new Date(targetDate);
  if (isNaN(current.getTime())) return 0;

  while (true) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;

    const record = dailyHistory[key];
    if (record && record.is_clean) {
      streak++;
      // Step back 1 day
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Generates calendar grid cells for Heatmap rendering (R1).
 * @param {Record<string, { focus_minutes: number, violations: number, is_clean: boolean }>} dailyHistory
 * @param {string} startDateStr YYYY-MM-DD
 * @param {string} endDateStr YYYY-MM-DD
 * @returns {Array<{ date: string, focus_minutes: number, violations: number, is_clean: boolean, intensity: number }>}
 */
export function generateHeatmapGrid(dailyHistory, startDateStr, endDateStr) {
  const cells = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return cells;
  }

  const curr = new Date(start);
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;

    const rec = (dailyHistory && dailyHistory[key]) || {
      focus_minutes: 0,
      violations: 0,
      is_clean: false
    };

    let intensity = 0;
    if (rec.focus_minutes > 0) {
      if (rec.focus_minutes <= 60) intensity = 1;
      else if (rec.focus_minutes <= 180) intensity = 2;
      else if (rec.focus_minutes <= 300) intensity = 3;
      else intensity = 4;
    }

    cells.push({
      date: key,
      focus_minutes: rec.focus_minutes,
      violations: rec.violations,
      is_clean: rec.is_clean,
      intensity
    });

    curr.setDate(curr.getDate() + 1);
  }

  return cells;
}

/**
 * Creates a state machine for Focus Room / Kiosk Mode (R4).
 */
export function createFocusRoomStateMachine() {
  const suppressedKeys = ['Alt+Tab', 'Win', 'LWin', 'RWin', 'Ctrl+Esc'];

  let inFocusRoom = false;
  let hookInstalled = false;
  let taskbarHidden = false;
  let emergencyEscapesCount = 0;

  return {
    enter() {
      inFocusRoom = true;
      hookInstalled = true;
      taskbarHidden = true;
      return { success: true, inFocusRoom, hookInstalled, taskbarHidden };
    },
    exit() {
      inFocusRoom = false;
      hookInstalled = false;
      taskbarHidden = false;
      return { success: true, inFocusRoom, hookInstalled, taskbarHidden };
    },
    isKeySuppressed(keyCombo) {
      if (!hookInstalled) return false;
      const normalized = keyCombo.trim();
      const isSuppressed = suppressedKeys.includes(normalized);
      if (isSuppressed) {
        emergencyEscapesCount++;
      }
      return isSuppressed;
    },
    getState() {
      return { inFocusRoom, hookInstalled, taskbarHidden, emergencyEscapesCount };
    },
    triggerPanicRecovery() {
      // Emulates panic hook / DropGuard
      hookInstalled = false;
      taskbarHidden = false;
      inFocusRoom = false;
      return { recovered: true };
    }
  };
}
