/**
 * CaiNghien Desktop — Typed Tauri IPC Service
 * 
 * Provides typed wrappers for Tauri v2 backend commands with resilient
 * browser/mock fallbacks ensuring zero runtime crashes under any execution mode.
 */

import { invoke } from '@tauri-apps/api/core';

// ----------------------------------------
// Types & Interface Contracts
// ----------------------------------------

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  level: number; // 0..=5
}

export interface HeatmapData {
  total_contributions: number;
  current_streak: number;
  longest_streak: number;
  activity_rate: number;
  days: HeatmapDay[];
}

export interface UserProfile {
  username: string;
  title: string;
  level: number;
  current_xp: number;
  next_level_xp: number;
  rank: string;
  handle?: string;
  streak?: number;
  longest_streak?: number;
  total_contributions?: number;
  activity_rate?: number;
  next_title?: string;
}

export interface FocusSessionResult {
  success: boolean;
  xp_earned: number;
  new_streak: number;
  today_count: number;
}

export interface TypingChallenge {
  id: string;
  text: string;
  title: string;
  author: string;
  difficulty?: 'novice' | 'stargazer' | 'quantum' | string;
}

export interface TypingScoreInput {
  wpm: number;
  accuracy: number;
  time_seconds: number;
  words_count: number;
}

export interface TypingScoreResult {
  saved: boolean;
  rank: string;
  xp_earned: number;
}

export interface TypingScore {
  id: string;
  timestamp: number;
  wpm: number;
  accuracy: number;
  time_seconds: number;
  words_count: number;
  xp_earned: number;
  rank?: string;
}

export interface AppConfig {
  protection_enabled: boolean;
  blocked_domains: string[];
  password_hash?: string | null;
  unlock_requested_at?: number | null;
  start_with_windows: boolean;
  change_delay_enabled: boolean;
  block_nsfw: boolean;
  level: number;
  xp: number;
  streak: number;
  daily_stats?: Record<string, number>;
  daily_history?: Record<string, {
    date: string;
    focus_minutes: number;
    violations: number;
    is_clean: boolean;
  }>;
}

// ----------------------------------------
// Runtime Environment Detection
// ----------------------------------------

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
    (globalThis as unknown as { isTauri?: boolean }).isTauri
  );
}

// ----------------------------------------
// Cross-Screen Telemetry Event Bus
// ----------------------------------------

export type TelemetryListener = () => void;
const telemetryListeners = new Set<TelemetryListener>();

export function onTelemetryUpdate(listener: TelemetryListener): () => void {
  telemetryListeners.add(listener);
  return () => {
    telemetryListeners.delete(listener);
  };
}

export function notifyTelemetryUpdate(): void {
  telemetryListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error notifying telemetry listener:', err);
    }
  });
}

// ----------------------------------------
// Mock / Fallback Storage Management
// ----------------------------------------

const STORAGE_KEYS = {
  PROFILE: 'cainghien_user_profile',
  HEATMAP: 'cainghien_heatmap_data',
  TYPING_SCORES: 'cainghien_typing_scores',
  APP_CONFIG: 'cainghien_app_config',
};

const DEFAULT_CHALLENGES: Record<string, TypingChallenge> = {
  quantum: {
    id: 'quantum-fox-nebula',
    title: 'TYPING CHALLENGE',
    author: 'Cosmos Fleet Command',
    difficulty: 'quantum',
    text: 'The quick brown fox jumped gracefully over the lazy, sleeping dog. He then sprinted across the galaxy, weaving through constellations of glowing nebulae and vibrant supernovas, navigating the void with speed and accuracy.',
  },
  stargazer: {
    id: 'stargazer-cosmos-voyager',
    title: 'STELLAR HORIZON',
    author: 'Carl Sagan',
    difficulty: 'stargazer',
    text: 'The cosmos is within us. We are made of star-stuff. We are a way for the cosmos to know itself. Across the infinite sea of space, the stars are beacons of wonder guiding our path.',
  },
  novice: {
    id: 'novice-orbital-drift',
    title: 'ORBITAL DRIFT',
    author: 'Zen Master',
    difficulty: 'novice',
    text: 'Focus and speed navigate the stars. Keep your mind calm, breathe deeply, and let your keystrokes flow.',
  },
};

function safeGetStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

function safeSetStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to persist to localStorage [${key}]:`, err);
  }
}

function generateMockHeatmapDays(): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    
    // Deterministic pseudo-randomness based on date for consistent visuals
    const charSum = dateStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hasActivity = (charSum % 10) > 2; // ~70% activity rate
    const count = hasActivity ? (charSum % 35) + 1 : 0;
    
    let level = 0;
    if (count > 0 && count <= 7) level = 1;
    else if (count > 7 && count <= 15) level = 2;
    else if (count > 15 && count <= 22) level = 3;
    else if (count > 22 && count <= 29) level = 4;
    else if (count >= 30) level = 5;

    days.push({ date: dateStr, count, level });
  }
  return days;
}

function calculateTypingRank(wpm: number, accuracy: number): string {
  if (wpm >= 100 && accuracy >= 95) return 'Celestial Singularity';
  if (wpm >= 75 && accuracy >= 90) return 'Quantum Voyager';
  if (wpm >= 50 && accuracy >= 85) return 'Stargazer Master';
  if (wpm >= 30 && accuracy >= 80) return 'Cosmic Navigator';
  return 'Stargazer Cadet';
}

function calculateTypingXP(score: TypingScoreInput): number {
  const baseWpmXp = Math.round(score.wpm * (score.accuracy / 100) * 1.5);
  const wordsBonus = Math.min(score.words_count * 2, 80);
  const accuracyBonus = score.accuracy >= 98 ? 50 : score.accuracy >= 95 ? 25 : 0;
  return Math.max(20, baseWpmXp + wordsBonus + accuracyBonus);
}

// ----------------------------------------
// Safe IPC Invoker with Automatic Fallback
// ----------------------------------------

async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  fallbackProducer?: () => T | Promise<T>
): Promise<T> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.warn(`Tauri command [${cmd}] failed, falling back to local simulation:`, err);
      if (fallbackProducer) {
        return await fallbackProducer();
      }
      throw err;
    }
  }

  if (fallbackProducer) {
    return await fallbackProducer();
  }

  throw new Error(`Execution in browser environment without fallback for command: ${cmd}`);
}

// ----------------------------------------
// Public API Functions
// ----------------------------------------

/**
 * Retrieves the 365-day discipline & activity heatmap data.
 */
export async function getHeatmapData(): Promise<HeatmapData> {
  return safeInvoke<HeatmapData>(
    'get_heatmap_data',
    {},
    () => {
      const stored = safeGetStorage<HeatmapData | null>(STORAGE_KEYS.HEATMAP, null);
      if (stored) return stored;

      const mockData: HeatmapData = {
        total_contributions: 4185,
        current_streak: 128,
        longest_streak: 142,
        activity_rate: 85.0,
        days: generateMockHeatmapDays(),
      };
      safeSetStorage(STORAGE_KEYS.HEATMAP, mockData);
      return mockData;
    }
  );
}

/**
 * Retrieves the current cosmic user profile.
 */
export async function getUserProfile(): Promise<UserProfile> {
  return safeInvoke<UserProfile>(
    'get_user_profile',
    {},
    () => {
      const stored = safeGetStorage<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
      if (stored) return stored;

      const initialProfile: UserProfile = {
        username: 'Alex Chen',
        title: 'Stargazer',
        level: 28,
        current_xp: 14350,
        next_level_xp: 15000,
        rank: 'Nova Voyager',
      };
      safeSetStorage(STORAGE_KEYS.PROFILE, initialProfile);
      return initialProfile;
    }
  );
}

/**
 * Updates the user profile.
 */
export async function updateUserProfile(profile: UserProfile): Promise<void> {
  const res = await safeInvoke<void>(
    'update_user_profile',
    { profile },
    () => {
      safeSetStorage(STORAGE_KEYS.PROFILE, profile);
    }
  );
  notifyTelemetryUpdate();
  return res;
}

/**
 * Records a completed focus session, awarding XP and updating streak.
 */
export async function recordFocusSession(duration: number, type: string): Promise<FocusSessionResult> {
  const result = await safeInvoke<FocusSessionResult>(
    'record_focus_session',
    {
      durationMinutes: duration,
      duration_minutes: duration,
      sessionType: type,
      session_type: type,
    },
    async () => {
      const profile = await getUserProfile();
      const xpGained = duration * 10;
      profile.current_xp += xpGained;
      if (profile.current_xp >= profile.next_level_xp) {
        profile.level += 1;
        profile.current_xp -= profile.next_level_xp;
        profile.next_level_xp = Math.round(profile.next_level_xp * 1.2);
      }
      safeSetStorage(STORAGE_KEYS.PROFILE, profile);

      // Update Heatmap
      const heatmap = await getHeatmapData();
      heatmap.total_contributions += 1;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayCell = heatmap.days.find(d => d.date === todayStr);
      let todayCount = 1;
      if (todayCell) {
        todayCell.count += 1;
        todayCell.level = Math.min(5, Math.floor(todayCell.count / 5) + 1);
        todayCount = todayCell.count;
      }
      safeSetStorage(STORAGE_KEYS.HEATMAP, heatmap);

      return {
        success: true,
        xp_earned: xpGained,
        new_streak: heatmap.current_streak,
        today_count: todayCount,
      };
    }
  );
  notifyTelemetryUpdate();
  return result;
}

/**
 * Retrieves the typing challenge text for a specified difficulty.
 */
export async function getTypingChallengeText(difficulty?: string): Promise<TypingChallenge> {
  const normalizedDiff = (difficulty || 'quantum').toLowerCase();

  return safeInvoke<TypingChallenge>(
    'get_typing_challenge_text',
    { difficulty: normalizedDiff },
    () => {
      const challenge = DEFAULT_CHALLENGES[normalizedDiff] || DEFAULT_CHALLENGES.quantum;
      return challenge;
    }
  );
}

/**
 * Saves a completed typing score, persists to history and awards cosmic XP.
 */
export async function saveTypingScore(score: TypingScoreInput): Promise<TypingScoreResult> {
  const result = await safeInvoke<TypingScoreResult>(
    'save_typing_score',
    { score },
    async () => {
      const rank = calculateTypingRank(score.wpm, score.accuracy);
      const xpEarned = calculateTypingXP(score);

      const newEntry: TypingScore = {
        id: `score-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        wpm: score.wpm,
        accuracy: score.accuracy,
        time_seconds: score.time_seconds,
        words_count: score.words_count,
        xp_earned: xpEarned,
        rank,
      };

      // Append to scores list
      const currentScores = safeGetStorage<TypingScore[]>(STORAGE_KEYS.TYPING_SCORES, []);
      currentScores.unshift(newEntry);
      safeSetStorage(STORAGE_KEYS.TYPING_SCORES, currentScores.slice(0, 100)); // retain latest 100

      // Award XP to user profile
      const profile = await getUserProfile();
      profile.current_xp += xpEarned;
      if (profile.current_xp >= profile.next_level_xp) {
        profile.level += 1;
        profile.current_xp -= profile.next_level_xp;
        profile.next_level_xp = Math.round(profile.next_level_xp * 1.2);
      }
      safeSetStorage(STORAGE_KEYS.PROFILE, profile);

      return {
        saved: true,
        rank,
        xp_earned: xpEarned,
      };
    }
  );
  notifyTelemetryUpdate();
  return result;
}

/**
 * Retrieves past typing challenge scores.
 */
export async function getTypingScores(): Promise<TypingScore[]> {
  return safeInvoke<TypingScore[]>(
    'get_typing_scores',
    {},
    () => {
      return safeGetStorage<TypingScore[]>(STORAGE_KEYS.TYPING_SCORES, []);
    }
  );
}

/**
 * Additional Tauri IPC helpers
 */
export async function getAppConfig(): Promise<AppConfig | null> {
  return safeInvoke<AppConfig | null>(
    'get_app_config',
    {},
    () => safeGetStorage<AppConfig | null>(STORAGE_KEYS.APP_CONFIG, null)
  );
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  return safeInvoke<void>(
    'save_app_config',
    { config },
    () => {
      safeSetStorage(STORAGE_KEYS.APP_CONFIG, config);
    }
  );
}

export async function enterFocusRoom(): Promise<void> {
  return safeInvoke<void>('enter_focus_room', {}, () => {
    console.log('[Mock IPC] enter_focus_room invoked');
  });
}

export async function exitFocusRoom(): Promise<void> {
  return safeInvoke<void>('exit_focus_room', {}, () => {
    console.log('[Mock IPC] exit_focus_room invoked');
  });
}

export const api = {
  getHeatmapData,
  getUserProfile,
  updateUserProfile,
  recordFocusSession,
  getTypingChallengeText,
  saveTypingScore,
  getTypingScores,
  getAppConfig,
  saveAppConfig,
  enterFocusRoom,
  exitFocusRoom,
  isTauriEnvironment,
  onTelemetryUpdate,
  notifyTelemetryUpdate,
};

export default api;
