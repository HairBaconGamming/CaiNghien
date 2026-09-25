use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use chrono::{Duration, Local, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};

use crate::models::{
    DailyContribution, FocusSessionResult, HeatmapData, HeatmapDay,
    TypingScore, TypingScoreInput, TypingScoreResult, UserProfile,
};

#[derive(Clone)]
pub struct DbState(pub Arc<Mutex<Connection>>);

/// Resolves the physical database path.
/// Priority:
/// 1. `CAINGHIEN_DB_PATH` environment variable override (for tests and isolated runs)
/// 2. `%APPDATA%\com.cainghien.desktop\cainghien.db` on Windows
/// 3. Fallback to `data/cainghien.db`
pub fn get_database_path() -> PathBuf {
    if let Ok(env_path) = std::env::var("CAINGHIEN_DB_PATH") {
        let p = PathBuf::from(env_path);
        if let Some(parent) = p.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        return p;
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let mut path = PathBuf::from(appdata);
        path.push("com.cainghien.desktop");
        let _ = std::fs::create_dir_all(&path);
        path.push("cainghien.db");
        path
    } else {
        let mut path = PathBuf::from("data");
        let _ = std::fs::create_dir_all(&path);
        path.push("cainghien.db");
        path
    }
}

/// Applies required PRAGMAs for concurrency and data integrity:
/// - WAL journal mode
/// - synchronous = NORMAL
/// - foreign_keys = ON
/// - busy_timeout = 5000 ms
pub fn configure_connection(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(())
}

/// Opens connection and configures pragmas.
pub fn open_connection(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(path)?;
    configure_connection(&conn)?;
    Ok(conn)
}

/// Runs schema migrations inside a transaction.
pub fn run_migrations(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;

    tx.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
        [],
    )?;

    let current_version: Option<i64> = tx
        .query_row(
            "SELECT MAX(version) FROM schema_migrations;",
            [],
            |row| row.get(0),
        )
        .optional()?
        .flatten();

    if current_version.unwrap_or(0) < 1 {
        // Table: user_profile
        tx.execute(
            "CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT NOT NULL DEFAULT 'Người Dùng',
                handle TEXT NOT NULL DEFAULT '@nguoidung',
                title TEXT NOT NULL DEFAULT 'Tân Binh',
                avatar_type TEXT NOT NULL DEFAULT 'cosmic_singularity',
                level INTEGER NOT NULL DEFAULT 1,
                level_title TEXT NOT NULL DEFAULT 'Tân Binh',
                next_level_title TEXT NOT NULL DEFAULT 'Tân binh (LVL 2)',
                current_xp INTEGER NOT NULL DEFAULT 0,
                next_level_xp INTEGER NOT NULL DEFAULT 1000,
                streak INTEGER NOT NULL DEFAULT 0,
                longest_streak INTEGER NOT NULL DEFAULT 0,
                rank TEXT NOT NULL DEFAULT 'Tân Binh',
                total_focus_hours INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            [],
        )?;

        // Table: daily_contributions
        tx.execute(
            "CREATE TABLE IF NOT EXISTS daily_contributions (
                date TEXT PRIMARY KEY,
                count INTEGER NOT NULL DEFAULT 0,
                focus_minutes INTEGER NOT NULL DEFAULT 0,
                violations INTEGER NOT NULL DEFAULT 0,
                is_clean INTEGER NOT NULL DEFAULT 1,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            [],
        )?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_daily_contributions_date ON daily_contributions(date DESC);",
            [],
        )?;

        // Table: focus_sessions
        tx.execute(
            "CREATE TABLE IF NOT EXISTS focus_sessions (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                duration_minutes INTEGER NOT NULL,
                session_type TEXT NOT NULL DEFAULT 'pomodoro',
                quote TEXT,
                completed INTEGER NOT NULL DEFAULT 1,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            [],
        )?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_focus_sessions_timestamp ON focus_sessions(timestamp DESC);",
            [],
        )?;

        // Table: typing_scores
        tx.execute(
            "CREATE TABLE IF NOT EXISTS typing_scores (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                wpm INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                time_seconds INTEGER NOT NULL,
                words_count INTEGER NOT NULL,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                rank TEXT NOT NULL,
                difficulty TEXT NOT NULL DEFAULT 'medium',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            [],
        )?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_typing_scores_timestamp ON typing_scores(timestamp DESC);",
            [],
        )?;

        tx.execute(
            "INSERT INTO schema_migrations (version, description) VALUES (1, 'Initial core schema');",
            [],
        )?;
    }

    tx.commit()?;
    Ok(())
}

/// Maps contribution count to heatmap level (0..=5).
pub fn count_to_level(count: u32) -> u8 {
    match count {
        0 => 0,
        1..=3 => 1,
        4..=7 => 2,
        8..=14 => 3,
        15..=25 => 4,
        _ => 5,
    }
}

/// Generates the dynamic 365-day seed anchored to current date.
/// Guarantees:
/// - 4,185 total contributions
/// - 128 current streak (ending on `today`)
/// - 156 longest streak
/// - 85% activity rate (310 active days out of 365)
/// - `today`'s cell is present and active
pub fn generate_dynamic_365_seed(today: NaiveDate) -> Vec<DailyContribution> {
    let total_days: usize = 365;
    let start_date = today - Duration::days((total_days - 1) as i64);

    // Days classification:
    // Indices 0..=364 (where 364 is today)
    // 1. Current streak: indices 237..=364 (128 consecutive active days ending on today).
    // 2. Index 236: rest day (count = 0) to seal current streak at exactly 128.
    // 3. Longest streak: indices 50..=205 (156 consecutive active days).
    // 4. Index 49 and 206: rest days (count = 0) to seal longest streak at exactly 156.
    // 5. Additional active days:
    //    We need 310 total active days.
    //    128 + 156 = 284 active days so far.
    //    Remaining needed: 26 active days.
    //    - In range 207..=235 (29 slots): take 10 active days (every 3rd day, no run >= 2).
    //    - In range 0..=48 (49 slots): take 16 active days (every 3rd day, no run >= 2).
    //    Total active days = 128 + 156 + 10 + 16 = 310 (310 / 365 = 84.93% -> 85%).
    let mut is_active = vec![false; total_days];

    // Current streak (128 days ending at 364)
    for i in 237..=364 {
        is_active[i] = true;
    }

    // Longest streak (156 days)
    for i in 50..=205 {
        is_active[i] = true;
    }

    // Additional active days in 207..=235 (10 days)
    let mut count_mid = 0;
    for i in (208..=234).step_by(3) {
        if count_mid < 10 {
            is_active[i] = true;
            count_mid += 1;
        }
    }

    // Additional active days in 0..=48 (16 days)
    let mut count_early = 0;
    for i in (1..=47).step_by(3) {
        if count_early < 16 {
            is_active[i] = true;
            count_early += 1;
        }
    }

    // Initial base counts on active days
    let mut counts = vec![0u32; total_days];
    let mut current_sum: u32 = 0;

    for i in 0..total_days {
        if is_active[i] {
            // Harmonic wave formula
            let wave = 10 + ((i * 17 + 3) % 9) as u32; // 10..=18
            counts[i] = wave;
            current_sum += wave;
        }
    }

    // Calibrate exactly to 4,185 total contributions
    let target_sum: u32 = 4185;
    if current_sum < target_sum {
        let mut diff = target_sum - current_sum;
        for i in 0..total_days {
            if diff == 0 {
                break;
            }
            if is_active[i] {
                counts[i] += 1;
                diff -= 1;
            }
        }
    } else if current_sum > target_sum {
        let mut diff = current_sum - target_sum;
        for i in 0..total_days {
            if diff == 0 {
                break;
            }
            if is_active[i] && counts[i] > 1 {
                counts[i] -= 1;
                diff -= 1;
            }
        }
    }

    let mut result = Vec::with_capacity(total_days);
    for i in 0..total_days {
        let day_date = start_date + Duration::days(i as i64);
        let date_str = day_date.format("%Y-%m-%d").to_string();
        let cnt = counts[i];
        let focus_mins = if cnt > 0 { cnt * 15 } else { 0 };
        result.push(DailyContribution {
            date: date_str,
            count: cnt,
            focus_minutes: focus_mins,
            violations: 0,
            is_clean: true,
            xp_earned: cnt * 10,
        });
    }

    result
}

/// Seeds default profile and 365-day baseline if tables are empty.
pub fn seed_database_if_empty(
    conn: &mut Connection,
    config_import: Option<&crate::models::AppConfig>,
) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;

    // 1. Seed user_profile if empty
    let profile_count: i64 = tx.query_row(
        "SELECT COUNT(*) FROM user_profile;",
        [],
        |r| r.get(0),
    )?;

    if profile_count == 0 {
        let default_profile = if let Some(cfg) = config_import {
            cfg.user_profile.clone()
        } else {
            UserProfile::default()
        };

        tx.execute(
            "INSERT INTO user_profile (
                id, username, handle, title, avatar_type, level, level_title,
                next_level_title, current_xp, next_level_xp, streak, longest_streak, rank, total_focus_hours
            ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13);",
            params![
                default_profile.username,
                default_profile.handle,
                default_profile.title,
                default_profile.avatar_type,
                default_profile.level,
                default_profile.level_title,
                default_profile.next_level_title,
                default_profile.current_xp,
                default_profile.next_level_xp,
                default_profile.streak,
                default_profile.longest_streak,
                default_profile.rank,
                default_profile.total_focus_hours,
            ],
        )?;
    }

    // 2. Seed daily_contributions if empty
    let contributions_count: i64 = tx.query_row(
        "SELECT COUNT(*) FROM daily_contributions;",
        [],
        |r| r.get(0),
    )?;

    if contributions_count == 0 {
        // No mock data generated per requirement. 
        // Backend returns empty real data if empty.
    }

    // 3. Import focus sessions if table is empty and config has them
    if let Some(cfg) = config_import {
        let sessions_count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM focus_sessions;",
            [],
            |r| r.get(0),
        )?;
        if sessions_count == 0 && !cfg.focus_sessions.is_empty() {
            let mut stmt = tx.prepare(
                "INSERT INTO focus_sessions (
                    id, timestamp, duration_minutes, session_type, quote, completed, xp_earned
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
            )?;
            for s in &cfg.focus_sessions {
                stmt.execute(params![
                    s.id,
                    s.timestamp as i64,
                    s.duration_minutes,
                    s.session_type,
                    s.quote,
                    if s.completed { 1 } else { 0 },
                    s.xp_earned,
                ])?;
            }
        }

        // 4. Import typing scores if table is empty and config has them
        let scores_count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM typing_scores;",
            [],
            |r| r.get(0),
        )?;
        if scores_count == 0 && !cfg.typing_scores.is_empty() {
            let mut stmt = tx.prepare(
                "INSERT INTO typing_scores (
                    id, timestamp, wpm, accuracy, time_seconds, words_count, xp_earned, rank
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
            )?;
            for t in &cfg.typing_scores {
                stmt.execute(params![
                    t.id,
                    t.timestamp as i64,
                    t.wpm,
                    t.accuracy,
                    t.time_seconds,
                    t.words_count,
                    t.xp_earned,
                    "Quantum Master",
                ])?;
            }
        }
    }

    tx.commit()?;
    Ok(())
}

/// Initializes database on disk, runs migrations, and seeds baseline if empty.
pub fn init_db(path: &Path, config_import: Option<&crate::models::AppConfig>) -> Result<Connection, rusqlite::Error> {
    let mut conn = open_connection(path)?;
    run_migrations(&mut conn)?;
    seed_database_if_empty(&mut conn, config_import)?;
    Ok(conn)
}

// -----------------------------------------------------------------------------
// CRUD Operations
// -----------------------------------------------------------------------------

/// Reads the singleton user profile from SQLite.
pub fn get_user_profile(conn: &Connection) -> Result<UserProfile, String> {
    conn.query_row(
        "SELECT username, handle, title, avatar_type, level, level_title,
                next_level_title, current_xp, next_level_xp, streak, longest_streak, rank, total_focus_hours
         FROM user_profile WHERE id = 1;",
        [],
        |row| {
            Ok(UserProfile {
                username: row.get(0)?,
                handle: row.get(1)?,
                title: row.get(2)?,
                avatar_type: row.get(3)?,
                level: row.get(4)?,
                level_title: row.get(5)?,
                next_level_title: row.get(6)?,
                current_xp: row.get(7)?,
                next_level_xp: row.get(8)?,
                streak: row.get(9)?,
                longest_streak: row.get(10)?,
                rank: row.get(11)?,
                total_focus_hours: row.get(12)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get user profile: {}", e))
}

/// Updates the user profile in SQLite.
pub fn update_user_profile(conn: &Connection, profile: &UserProfile) -> Result<(), String> {
    conn.execute(
        "UPDATE user_profile SET
            username = ?1,
            handle = ?2,
            title = ?3,
            avatar_type = ?4,
            level = ?5,
            level_title = ?6,
            next_level_title = ?7,
            current_xp = ?8,
            next_level_xp = ?9,
            streak = ?10,
            longest_streak = ?11,
            rank = ?12,
            total_focus_hours = ?13,
            updated_at = datetime('now')
         WHERE id = 1;",
        params![
            profile.username,
            profile.handle,
            profile.title,
            profile.avatar_type,
            profile.level,
            profile.level_title,
            profile.next_level_title,
            profile.current_xp,
            profile.next_level_xp,
            profile.streak,
            profile.longest_streak,
            profile.rank,
            profile.total_focus_hours,
        ],
    )
    .map_err(|e| format!("Failed to update user profile: {}", e))?;
    Ok(())
}

/// Reads the 365-day Activity Heatmap data ending on today.
pub fn get_heatmap_data(conn: &Connection) -> Result<HeatmapData, String> {
    let today = Local::now().date_naive();
    let total_days = 365;
    let start_date = today - Duration::days(total_days - 1);
    let start_date_str = start_date.format("%Y-%m-%d").to_string();
    let today_str = today.format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT date, count FROM daily_contributions
             WHERE date >= ?1 AND date <= ?2
             ORDER BY date ASC;",
        )
        .map_err(|e| format!("Failed to prepare heatmap query: {}", e))?;

    let rows = stmt
        .query_map(params![start_date_str, today_str], |row| {
            let date: String = row.get(0)?;
            let count: u32 = row.get(1)?;
            Ok((date, count))
        })
        .map_err(|e| format!("Failed to execute heatmap query: {}", e))?;

    let mut map = std::collections::HashMap::new();
    for r in rows {
        if let Ok((d, c)) = r {
            map.insert(d, c);
        }
    }

    let mut days = Vec::with_capacity(total_days as usize);
    let mut total_contributions: u32 = 0;
    let mut active_days: u32 = 0;

    for i in 0..total_days {
        let cur_date = start_date + Duration::days(i);
        let cur_str = cur_date.format("%Y-%m-%d").to_string();
        let count = map.get(&cur_str).copied().unwrap_or(0);
        let level = count_to_level(count);

        if count > 0 {
            total_contributions += count;
            active_days += 1;
        }

        days.push(HeatmapDay {
            date: cur_str,
            count,
            level,
        });
    }

    // Calculate current streak backward from today
    let mut current_streak: u32 = 0;
    for day in days.iter().rev() {
        if day.count > 0 {
            current_streak += 1;
        } else {
            break;
        }
    }

    // Calculate longest streak in the 365-day window
    let mut longest_streak: u32 = 0;
    let mut temp_streak: u32 = 0;
    for day in &days {
        if day.count > 0 {
            temp_streak += 1;
            longest_streak = longest_streak.max(temp_streak);
        } else {
            temp_streak = 0;
        }
    }

    // Profile streak fallback
    if let Ok(profile) = get_user_profile(conn) {
        current_streak = current_streak.max(profile.streak);
        longest_streak = longest_streak.max(profile.longest_streak).max(current_streak);
    }

    let activity_rate = if total_days > 0 {
        ((active_days as f64 / total_days as f64) * 100.0).round()
    } else {
        0.0
    };

    Ok(HeatmapData {
        total_contributions,
        current_streak,
        longest_streak,
        activity_rate,
        activity_percentage: activity_rate,
        days,
    })
}

/// Records a completed focus session, updates daily contributions, and awards XP.
pub fn record_focus_session(
    conn: &mut Connection,
    duration_minutes: u32,
    session_type: String,
) -> Result<FocusSessionResult, String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let session_id = format!("focus_{}", now_ts);
    let xp_earned = duration_minutes.saturating_mul(4);
    let count_inc = (duration_minutes / 25).max(1);
    let today = Local::now().format("%Y-%m-%d").to_string();

    // 1. Insert session record
    tx.execute(
        "INSERT INTO focus_sessions (
            id, timestamp, duration_minutes, session_type, quote, completed, xp_earned
        ) VALUES (?1, ?2, ?3, ?4, NULL, 1, ?5);",
        params![
            session_id,
            now_ts as i64,
            duration_minutes,
            session_type,
            xp_earned,
        ],
    )
    .map_err(|e| format!("Failed to insert focus session: {}", e))?;

    // 2. Upsert daily contribution
    tx.execute(
        "INSERT INTO daily_contributions (
            date, count, focus_minutes, violations, is_clean, xp_earned, updated_at
        ) VALUES (?1, ?2, ?3, 0, 1, ?4, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
            count = count + ?2,
            focus_minutes = focus_minutes + ?3,
            xp_earned = xp_earned + ?4,
            updated_at = datetime('now');",
        params![today, count_inc, duration_minutes, xp_earned],
    )
    .map_err(|e| format!("Failed to upsert daily contribution: {}", e))?;

    // Get today's total count
    let today_count: u32 = tx
        .query_row(
            "SELECT count FROM daily_contributions WHERE date = ?1;",
            params![today],
            |r| r.get(0),
        )
        .unwrap_or(count_inc);

    // 3. Update user profile gamification
    let mut profile: UserProfile = tx
        .query_row(
            "SELECT username, handle, title, avatar_type, level, level_title,
                    next_level_title, current_xp, next_level_xp, streak, longest_streak, rank, total_focus_hours
             FROM user_profile WHERE id = 1;",
            [],
            |row| {
                Ok(UserProfile {
                    username: row.get(0)?,
                    handle: row.get(1)?,
                    title: row.get(2)?,
                    avatar_type: row.get(3)?,
                    level: row.get(4)?,
                    level_title: row.get(5)?,
                    next_level_title: row.get(6)?,
                    current_xp: row.get(7)?,
                    next_level_xp: row.get(8)?,
                    streak: row.get(9)?,
                    longest_streak: row.get(10)?,
                    rank: row.get(11)?,
                    total_focus_hours: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Failed to load profile in focus session: {}", e))?;

    profile.current_xp = profile.current_xp.saturating_add(xp_earned);
    while profile.current_xp >= profile.next_level_xp {
        profile.current_xp -= profile.next_level_xp;
        profile.level += 1;
        profile.next_level_xp = ((profile.next_level_xp as f64) * 1.15) as u32;
    }

    profile.streak = profile.streak.saturating_add(1);
    profile.longest_streak = profile.longest_streak.max(profile.streak);

    tx.execute(
        "UPDATE user_profile SET
            level = ?1,
            current_xp = ?2,
            next_level_xp = ?3,
            streak = ?4,
            longest_streak = ?5,
            updated_at = datetime('now')
         WHERE id = 1;",
        params![
            profile.level,
            profile.current_xp,
            profile.next_level_xp,
            profile.streak,
            profile.longest_streak,
        ],
    )
    .map_err(|e| format!("Failed to update profile after focus: {}", e))?;

    let new_streak = profile.streak;
    tx.commit()
        .map_err(|e| format!("Failed to commit focus session: {}", e))?;

    Ok(FocusSessionResult {
        success: true,
        xp_earned,
        new_streak,
        today_count,
    })
}

/// Saves a typing score challenge result, awards XP, and updates streaks.
pub fn save_typing_score(
    conn: &mut Connection,
    score: TypingScoreInput,
) -> Result<TypingScoreResult, String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin typing transaction: {}", e))?;

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let score_id = format!("typing_{}", now_ts);
    let accuracy_factor = (score.accuracy / 100.0).clamp(0.0, 1.0);
    let xp_earned = 50 + ((score.wpm as f64) * accuracy_factor) as u32;

    let rank = if score.wpm >= 100 && score.accuracy >= 95.0 {
        "Hyperion".to_string()
    } else if score.wpm >= 80 && score.accuracy >= 90.0 {
        "Quantum Master".to_string()
    } else if score.wpm >= 60 {
        "Cosmic Voyager".to_string()
    } else if score.wpm >= 40 {
        "Stargazer".to_string()
    } else {
        "Novice".to_string()
    };

    let difficulty = score.difficulty.unwrap_or_else(|| "medium".to_string());

    // 1. Insert typing score
    tx.execute(
        "INSERT INTO typing_scores (
            id, timestamp, wpm, accuracy, time_seconds, words_count, xp_earned, rank, difficulty
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9);",
        params![
            score_id,
            now_ts as i64,
            score.wpm,
            score.accuracy,
            score.time_seconds,
            score.words_count,
            xp_earned,
            rank,
            difficulty,
        ],
    )
    .map_err(|e| format!("Failed to insert typing score: {}", e))?;

    // 2. Increment today's activity in daily_contributions
    let today = Local::now().format("%Y-%m-%d").to_string();
    tx.execute(
        "INSERT INTO daily_contributions (
            date, count, focus_minutes, violations, is_clean, xp_earned, updated_at
        ) VALUES (?1, 1, 0, 0, 1, ?2, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
            count = count + 1,
            xp_earned = xp_earned + ?2,
            updated_at = datetime('now');",
        params![today, xp_earned],
    )
    .map_err(|e| format!("Failed to update daily contributions for typing: {}", e))?;

    // 3. Award XP in user profile
    let mut profile: UserProfile = tx
        .query_row(
            "SELECT username, handle, title, avatar_type, level, level_title,
                    next_level_title, current_xp, next_level_xp, streak, longest_streak, rank, total_focus_hours
             FROM user_profile WHERE id = 1;",
            [],
            |row| {
                Ok(UserProfile {
                    username: row.get(0)?,
                    handle: row.get(1)?,
                    title: row.get(2)?,
                    avatar_type: row.get(3)?,
                    level: row.get(4)?,
                    level_title: row.get(5)?,
                    next_level_title: row.get(6)?,
                    current_xp: row.get(7)?,
                    next_level_xp: row.get(8)?,
                    streak: row.get(9)?,
                    longest_streak: row.get(10)?,
                    rank: row.get(11)?,
                    total_focus_hours: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Failed to query user profile: {}", e))?;

    profile.current_xp = profile.current_xp.saturating_add(xp_earned);
    while profile.current_xp >= profile.next_level_xp {
        profile.current_xp -= profile.next_level_xp;
        profile.level += 1;
        profile.next_level_xp = ((profile.next_level_xp as f64) * 1.15) as u32;
    }

    tx.execute(
        "UPDATE user_profile SET
            level = ?1,
            current_xp = ?2,
            next_level_xp = ?3,
            updated_at = datetime('now')
         WHERE id = 1;",
        params![profile.level, profile.current_xp, profile.next_level_xp],
    )
    .map_err(|e| format!("Failed to update user profile XP: {}", e))?;

    let new_streak = profile.streak;
    tx.commit()
        .map_err(|e| format!("Failed to commit typing transaction: {}", e))?;

    Ok(TypingScoreResult {
        saved: true,
        rank,
        xp_earned,
        success: true,
        new_streak,
    })
}

/// Retrieves the recent typing scores (up to 50 entries).
pub fn get_typing_scores(conn: &Connection) -> Result<Vec<TypingScore>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, timestamp, wpm, accuracy, time_seconds, words_count, xp_earned
             FROM typing_scores
             ORDER BY timestamp DESC
             LIMIT 50;",
        )
        .map_err(|e| format!("Failed to prepare typing scores query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let timestamp: i64 = row.get(1)?;
            Ok(TypingScore {
                id: row.get(0)?,
                timestamp: timestamp as u64,
                wpm: row.get(2)?,
                accuracy: row.get(3)?,
                time_seconds: row.get(4)?,
                words_count: row.get(5)?,
                xp_earned: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query typing scores: {}", e))?;

    let mut result = Vec::new();
    for r in rows {
        if let Ok(item) = r {
            result.push(item);
        }
    }
    Ok(result)
}

/// Resets user progress due to discipline penalty.
pub fn apply_penalty(conn: &mut Connection) -> Result<UserProfile, String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin penalty transaction: {}", e))?;

    let today = Local::now().format("%Y-%m-%d").to_string();

    // 1. Reset user profile
    tx.execute(
        "UPDATE user_profile SET
            level = 1,
            current_xp = 0,
            streak = 0,
            total_focus_hours = 0,
            updated_at = datetime('now')
         WHERE id = 1;",
        [],
    )
    .map_err(|e| format!("Failed to reset user profile on penalty: {}", e))?;

    // 2. Mark violation in today's contributions
    tx.execute(
        "INSERT INTO daily_contributions (
            date, count, focus_minutes, violations, is_clean, xp_earned, updated_at
        ) VALUES (?1, 0, 0, 1, 0, 0, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
            violations = violations + 1,
            is_clean = 0,
            updated_at = datetime('now');",
        params![today],
    )
    .map_err(|e| format!("Failed to update daily contributions on penalty: {}", e))?;

    let profile = tx
        .query_row(
            "SELECT username, handle, title, avatar_type, level, level_title,
                    next_level_title, current_xp, next_level_xp, streak, longest_streak, rank, total_focus_hours
             FROM user_profile WHERE id = 1;",
            [],
            |row| {
                Ok(UserProfile {
                    username: row.get(0)?,
                    handle: row.get(1)?,
                    title: row.get(2)?,
                    avatar_type: row.get(3)?,
                    level: row.get(4)?,
                    level_title: row.get(5)?,
                    next_level_title: row.get(6)?,
                    current_xp: row.get(7)?,
                    next_level_xp: row.get(8)?,
                    streak: row.get(9)?,
                    longest_streak: row.get(10)?,
                    rank: row.get(11)?,
                    total_focus_hours: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Failed to read reset profile: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Failed to commit penalty transaction: {}", e))?;

    Ok(profile)
}

/// Records a completed discipline focus minute from the enforcement background loop.
pub fn record_discipline_minute(
    conn: &mut Connection,
    date_str: &str,
    minutes: u32,
) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin discipline minute tx: {}", e))?;

    tx.execute(
        "INSERT INTO daily_contributions (
            date, count, focus_minutes, violations, is_clean, xp_earned, updated_at
        ) VALUES (?1, 1, ?2, 0, 1, ?2 * 4, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
            focus_minutes = focus_minutes + ?2,
            count = count + 1,
            updated_at = datetime('now');",
        params![date_str, minutes],
    )
    .map_err(|e| format!("Failed to record discipline minute: {}", e))?;

    // Update total_focus_hours in user_profile
    let total_mins: i64 = tx
        .query_row(
            "SELECT COALESCE(SUM(focus_minutes), 0) FROM daily_contributions;",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let total_hours = (total_mins / 60) as u32;

    tx.execute(
        "UPDATE user_profile SET total_focus_hours = ?1, updated_at = datetime('now') WHERE id = 1;",
        params![total_hours],
    )
    .map_err(|e| format!("Failed to update profile total focus hours: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Failed to commit discipline minute tx: {}", e))?;

    Ok(())
}

/// Records a discipline violation from the enforcement background loop.
pub fn record_discipline_violation(
    conn: &mut Connection,
    date_str: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO daily_contributions (
            date, count, focus_minutes, violations, is_clean, xp_earned, updated_at
        ) VALUES (?1, 0, 0, 1, 0, 0, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
            violations = violations + 1,
            is_clean = 0,
            updated_at = datetime('now');",
        params![date_str],
    )
    .map_err(|e| format!("Failed to record discipline violation: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seed_metrics_guarantee() {
        let today = Local::now().date_naive();
        let seed = generate_dynamic_365_seed(today);

        assert_eq!(seed.len(), 365, "Seed must cover exactly 365 days");

        let total_contributions: u32 = seed.iter().map(|d| d.count).sum();
        assert_eq!(total_contributions, 4185, "Total contributions must equal 4,185");

        let active_days = seed.iter().filter(|d| d.count > 0).count();
        let rate = ((active_days as f64 / 365.0) * 100.0).round() as u32;
        assert_eq!(rate, 85, "Activity rate must round to 85%");

        // Current streak ending on today (the last cell)
        let mut cur_streak = 0;
        for d in seed.iter().rev() {
            if d.count > 0 {
                cur_streak += 1;
            } else {
                break;
            }
        }
        assert_eq!(cur_streak, 128, "Current streak ending on today must be 128");

        // Longest streak
        let mut max_streak = 0;
        let mut temp_streak = 0;
        for d in &seed {
            if d.count > 0 {
                temp_streak += 1;
                max_streak = max_streak.max(temp_streak);
            } else {
                temp_streak = 0;
            }
        }
        assert_eq!(max_streak, 156, "Longest streak must be 156");

        // Today is present and active
        let today_cell = seed.last().unwrap();
        assert_eq!(today_cell.date, today.format("%Y-%m-%d").to_string());
        assert!(today_cell.count > 0, "Today's cell must be active");
    }

    #[test]
    fn test_in_memory_db_full_lifecycle() {
        let mut conn = Connection::open_in_memory().unwrap();
        configure_connection(&conn).unwrap();
        run_migrations(&mut conn).unwrap();
        seed_database_if_empty(&mut conn, None).unwrap();

        // Check user profile
        let profile = get_user_profile(&conn).unwrap();
        assert_eq!(profile.username, "User");
        assert_eq!(profile.level, 1);
        assert_eq!(profile.streak, 0);

        // Check heatmap
        let heatmap = get_heatmap_data(&conn).unwrap();
        assert_eq!(heatmap.days.len(), 365);
        assert_eq!(heatmap.total_contributions, 0);
        assert_eq!(heatmap.current_streak, 0);
        assert_eq!(heatmap.longest_streak, 0);
        assert_eq!(heatmap.activity_rate, 0.0);

        // Record focus session
        let res = record_focus_session(&mut conn, 25, "deep_work".into()).unwrap();
        assert!(res.success);
        assert_eq!(res.xp_earned, 100);

        // Verify profile updated (100 XP leveled up from LVL 1 to LVL 2, 0 rollover XP, streak 1)
        let profile2 = get_user_profile(&conn).unwrap();
        assert_eq!(profile2.level, 2);
        assert_eq!(profile2.current_xp, 0);
        assert_eq!(profile2.streak, 1);

        // Save typing score
        let typing_res = save_typing_score(
            &mut conn,
            TypingScoreInput {
                wpm: 85,
                accuracy: 98.5,
                time_seconds: 60,
                words_count: 85,
                difficulty: Some("medium".into()),
            },
        )
        .unwrap();
        assert!(typing_res.saved);
        assert_eq!(typing_res.rank, "Quantum Master");

        // Get typing scores
        let scores = get_typing_scores(&conn).unwrap();
        assert_eq!(scores.len(), 1);
        assert_eq!(scores[0].wpm, 85);

        // Apply penalty
        let penalized = apply_penalty(&mut conn).unwrap();
        assert_eq!(penalized.level, 1);
        assert_eq!(penalized.current_xp, 0);
        assert_eq!(penalized.streak, 0);
    }
}


pub fn reset_all_data(conn: &mut Connection) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM daily_contributions;", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM focus_sessions;", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM typing_scores;", []).map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE user_profile SET
            level = 1,
            level_title = 'Người mới',
            next_level_title = 'Tân binh (LVL 2)',
            current_xp = 0,
            next_level_xp = 1000,
            streak = 0,
            longest_streak = 0,
            total_focus_hours = 0,
            rank = 'Tân Binh'
         WHERE id = 1;",
        [],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
