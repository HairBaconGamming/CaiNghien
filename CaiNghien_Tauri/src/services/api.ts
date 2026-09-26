/**
 * CaiNghien Desktop — Typed Tauri IPC Service
 * 
 * Provides typed wrappers for Tauri v2 backend commands.
 * No mock data is used.
 */

import { invoke } from '@tauri-apps/api/core';

// Types
export interface HeatmapDay {
  date: string;
  count: number;
  level: number;
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
  difficulty?: string;
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
  daily_quota_minutes?: number;
  quota_used_seconds?: number;
  quota_last_reset_date?: string;
  study_minutes_required?: number;
  reward_quota_minutes?: number;
}

export interface StudyRewardResult {
  success: boolean;
  added_quota_minutes: number;
  new_daily_quota_minutes: number;
  xp_earned: number;
  message: string;
}

export interface QuotaStatus {
  active: boolean;
  used_seconds: number;
  max_seconds: number;
}

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    (globalThis as any).isTauri
  );
}

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
// Safe IPC Invoker without Fallback
// ----------------------------------------
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriEnvironment()) {
    return await invoke<T>(cmd, args);
  }
  throw new Error(`Execution in browser environment without fallback for command: ${cmd}`);
}

// API Functions
export async function getHeatmapData(): Promise<HeatmapData> {
  return safeInvoke<HeatmapData>('get_heatmap_data', {});
}

export async function getUserProfile(): Promise<UserProfile> {
  return safeInvoke<UserProfile>('get_user_profile', {});
}

export async function updateUserProfile(profile: UserProfile): Promise<void> {
  const res = await safeInvoke<void>('update_user_profile', { profile });
  notifyTelemetryUpdate();
  return res;
}

export async function recordFocusSession(duration: number, type: string): Promise<FocusSessionResult> {
  const result = await safeInvoke<FocusSessionResult>('record_focus_session', {
    durationMinutes: duration,
    duration_minutes: duration,
    sessionType: type,
    session_type: type,
  });
  notifyTelemetryUpdate();
  return result;
}

export async function getTypingChallengeText(difficulty?: string): Promise<TypingChallenge> {
  const normalizedDiff = (difficulty || 'quantum').toLowerCase();
  return safeInvoke<TypingChallenge>('get_typing_challenge_text', { difficulty: normalizedDiff });
}

export async function saveTypingScore(score: TypingScoreInput): Promise<TypingScoreResult> {
  const result = await safeInvoke<TypingScoreResult>('save_typing_score', { score });
  notifyTelemetryUpdate();
  return result;
}

export async function getTypingScores(): Promise<TypingScore[]> {
  return safeInvoke<TypingScore[]>('get_typing_scores', {});
}

export async function getAppConfig(): Promise<AppConfig | null> {
  return safeInvoke<AppConfig | null>('get_app_config', {});
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  return safeInvoke<void>('save_app_config', { newConfig: config });
}

export async function enterFocusRoom(): Promise<void> {
  return safeInvoke<void>('enter_focus_room', {});
}

export async function exitFocusRoom(): Promise<void> {
  return safeInvoke<void>('exit_focus_room', {});
}

export async function submitStudyReport(
  summaryText: string,
  studyDurationMinutes: number
): Promise<StudyRewardResult> {
  const result = await safeInvoke<StudyRewardResult>('submit_study_report', {
    summaryText,
    studyDurationMinutes,
    summary_text: summaryText,
    study_duration_minutes: studyDurationMinutes,
  });
  notifyTelemetryUpdate();
  return result;
}

export async function addStudyRewardQuota(minutes?: number): Promise<number> {
  const result = await safeInvoke<number>('add_study_reward_quota', { minutes });
  notifyTelemetryUpdate();
  return result;
}

export async function startQuota(): Promise<void> {
  return safeInvoke<void>('start_quota', {});
}

export async function pauseQuota(): Promise<void> {
  return safeInvoke<void>('pause_quota', {});
}

export async function getQuotaStatus(): Promise<QuotaStatus> {
  return safeInvoke<QuotaStatus>('get_quota_status', {});
}

export async function resetAllData(): Promise<void> {
  return safeInvoke<void>('reset_all_data', {});
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
  submitStudyReport,
  addStudyRewardQuota,
  startQuota,
  pauseQuota,
  getQuotaStatus,
  resetAllData,
  isTauriEnvironment,
  onTelemetryUpdate,
  notifyTelemetryUpdate,
};

export default api;


export function getRankTitleForLevel(lvl: number): string {
  if (lvl >= 50) return 'Bậc Thầy Vũ Trụ';
  if (lvl >= 35) return 'Stellar Captain';
  if (lvl >= 25) return 'Lữ Khách Tinh Tú';
  if (lvl >= 15) return 'Nhà Thám Hiểm';
  if (lvl >= 5) return 'Người Ngắm Sao';
  return 'Cosmic Tân binh';
}
