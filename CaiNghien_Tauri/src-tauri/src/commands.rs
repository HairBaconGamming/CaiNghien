use crate::cambridge::{fetch_word_data, CambridgeEntry};
use tauri::AppHandle;
use crate::config;
use std::time::{SystemTime, UNIX_EPOCH};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::config::ConfigState;
use crate::db::DbState;
use crate::models::{
    FocusSessionResult, HeatmapData, HeatmapDay, StudyRewardResult, TypingChallenge, TypingScore,
    TypingScoreInput, TypingScoreResult, UserProfile,
};
use chrono::{Datelike, Duration, Local, NaiveDate};

/// Deterministic demo contribution generator for uninitialized/sparse historical days.
pub fn calculate_seed_count(date: NaiveDate) -> u32 {
    let day_of_year = date.ordinal();
    let weekday = date.weekday().num_days_from_monday(); // 0..=6

    // Seed formula with wave harmonics
    let base = if weekday < 5 { 10 } else { 4 };
    let wave = ((day_of_year as f64 * 0.1).sin() * 5.0 + 5.0) as u32;
    let cycle = (day_of_year * 17 + weekday * 7) % 8;

    if cycle == 0 && weekday >= 5 {
        0 // Occasional rest weekend
    } else {
        base + wave + cycle
    }
}

pub fn count_to_level(count: u32) -> u8 {
    crate::db::count_to_level(count)
}

/// Backward compatibility helper for legacy config-based heatmap data calculation.
pub fn compute_heatmap_data_from_config(config: &crate::models::AppConfig) -> HeatmapData {
    let today = Local::now().date_naive();
    let total_days = 365;
    let start_date = today - Duration::days(total_days - 1);

    let has_sparse_history = config.heatmap_days.is_empty() && config.daily_history.is_empty();

    let mut days = Vec::with_capacity(total_days as usize);
    let mut total_contributions: u32 = 0;
    let mut active_days: u32 = 0;

    for i in 0..total_days {
        let current_date = start_date + Duration::days(i);
        let date_str = current_date.format("%Y-%m-%d").to_string();

        let count = if let Some(&c) = config.heatmap_days.get(&date_str) {
            c
        } else if let Some(rec) = config.daily_history.get(&date_str) {
            if rec.focus_minutes > 0 {
                (rec.focus_minutes / 15).max(1)
            } else if rec.is_clean && rec.violations == 0 {
                1
            } else {
                0
            }
        } else if has_sparse_history {
            calculate_seed_count(current_date)
        } else {
            0
        };

        let level = count_to_level(count);
        if count > 0 {
            total_contributions += count;
            active_days += 1;
        }

        days.push(HeatmapDay {
            date: date_str,
            count,
            level,
        });
    }

    // Calculate streaks
    let mut current_streak: u32 = 0;
    for day in days.iter().rev() {
        if day.count > 0 {
            current_streak += 1;
        } else {
            break;
        }
    }

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

    // Fallbacks to profile streak if higher
    current_streak = current_streak.max(config.user_profile.streak);
    longest_streak = longest_streak.max(current_streak);

    let activity_rate = if total_days > 0 {
        ((active_days as f64 / total_days as f64) * 100.0).round()
    } else {
        0.0
    };

    HeatmapData {
        total_contributions,
        current_streak,
        longest_streak,
        activity_rate,
        activity_percentage: activity_rate,
        days,
    }
}

#[tauri::command]
pub fn get_heatmap_data(state: State<'_, DbState>) -> Result<HeatmapData, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::get_heatmap_data(&conn)
}

#[tauri::command]
pub fn get_user_profile(state: State<'_, DbState>) -> Result<UserProfile, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::get_user_profile(&conn)
}

#[tauri::command]
pub fn update_user_profile(state: State<'_, DbState>, profile: UserProfile) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::update_user_profile(&conn, &profile)
}

#[tauri::command]
pub fn record_focus_session(
    state: State<'_, DbState>,
    duration_minutes: u32,
    session_type: String,
) -> Result<FocusSessionResult, String> {
    let mut conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::record_focus_session(&mut conn, duration_minutes, session_type)
}

#[tauri::command]
pub fn get_typing_challenge_text(difficulty: Option<String>) -> Result<TypingChallenge, String> {
    let diff = difficulty.as_deref().unwrap_or("medium").to_lowercase();
    match diff.as_str() {
        "easy" => Ok(TypingChallenge {
            id: "challenge_easy".to_string(),
            title: "Tia Lửa Vũ Trụ".to_string(),
            author: "Vũ Trụ Học".to_string(),
            difficulty: "easy".to_string(),
            text: "Vũ trụ ở ngay bên trong chúng ta. Chúng ta được tạo ra từ những vì sao. Chúng ta là cách để vũ trụ tự nhận thức chính nó.".to_string(),
        }),
        "hard" => Ok(TypingChallenge {
            id: "challenge_hard".to_string(),
            title: "Điểm Kỳ Dị Không Gian".to_string(),
            author: "Sinh Vật Học Vũ Trụ".to_string(),
            difficulty: "hard".to_string(),
            text: "Vượt qua không thời gian tương đối đòi hỏi kỷ luật vô song và sự tập trung thuần khiết. Vượt xa khỏi chân trời sự kiện của sự xao nhãng là cốt lõi rực sáng của tiềm năng con người, nơi mọi nỗ lực đều dệt nên bức tranh thành tựu.".to_string(),
        }),
        _ => Ok(TypingChallenge {
            id: "challenge_quantum".to_string(),
            title: "Tốc Độ Lượng Tử".to_string(),
            author: "Lữ Khách Vũ Trụ".to_string(),
            difficulty: "medium".to_string(),
            text: "Con cáo nâu nhanh nhẹn nhảy qua con chó lười biếng đang ngủ. Sau đó, nó chạy nước rút qua dải ngân hà, len lỏi qua các chòm sao, tinh vân rực rỡ và siêu tân tinh sống động, băng qua khoảng không với tốc độ và độ chính xác đáng kinh ngạc.".to_string(),
        }),
    }
}

#[tauri::command]
pub fn save_typing_score(
    state: State<'_, DbState>,
    score: TypingScoreInput,
) -> Result<TypingScoreResult, String> {
    let mut conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::save_typing_score(&mut conn, score)
}

#[tauri::command]
pub fn get_typing_scores(state: State<'_, DbState>) -> Result<Vec<TypingScore>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::get_typing_scores(&conn)
}

#[tauri::command]
pub fn reset_all_data(state: State<'_, DbState>) -> Result<(), String> {
    let mut conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::reset_all_data(&mut conn)
}

/// Helper to validate proof-of-work text length (at least 100 words).
pub fn validate_study_report_text(summary_text: &str) -> Result<usize, String> {
    let word_count = summary_text.split_whitespace().count();
    if word_count < 100 {
        Err(format!(
            "Báo cáo chưa đạt yêu cầu độ dài. Yêu cầu tối thiểu 100 từ, hiện có {} từ.",
            word_count
        ))
    } else {
        Ok(word_count)
    }
}

/// Helper to calculate proportional recreation quota from study duration.
pub fn calculate_study_reward_quota(
    study_duration_minutes: u32,
    study_minutes_required: u32,
    reward_quota_minutes: u32,
) -> u32 {
    let req = if study_minutes_required == 0 {
        60
    } else {
        study_minutes_required
    };
    let reward_unit = if reward_quota_minutes == 0 {
        15
    } else {
        reward_quota_minutes
    };
    let quota = ((study_duration_minutes as u128) * (reward_unit as u128)) / (req as u128);
    quota.min(u32::MAX as u128) as u32
}

#[tauri::command]
pub fn submit_study_report(
    app: tauri::AppHandle,
    state: State<'_, crate::config::ConfigState>,
    db_state: State<'_, DbState>,
    summary_text: String,
    study_duration_minutes: u32,
) -> Result<StudyRewardResult, String> {
    // 1. Validate proof-of-work: minimum 100 words
    validate_study_report_text(&summary_text)?;

    // 2. Lock config and calculate earned quota
    let (reward_quota, new_total_quota) = {
        let mut config_data = state
            .0
            .lock()
            .map_err(|_| "Config lock poisoned".to_string())?;
        let earned = calculate_study_reward_quota(
            study_duration_minutes,
            config_data.study_minutes_required,
            config_data.reward_quota_minutes,
        );

        config_data.daily_quota_minutes = config_data.daily_quota_minutes.saturating_add(earned);
        crate::config::save_config(&app, &config_data)?;
        (earned, config_data.daily_quota_minutes)
    };

    // 3. Record session in SQLite database (awards XP and updates heatmap)
    let xp_earned = if let Ok(mut conn) = db_state.0.lock() {
        let res = crate::db::record_focus_session(
            &mut conn,
            study_duration_minutes,
            "study_to_earn".to_string(),
        );
        res.map(|r| r.xp_earned)
            .unwrap_or(study_duration_minutes.saturating_mul(4))
    } else {
        study_duration_minutes.saturating_mul(4)
    };

    Ok(StudyRewardResult {
        success: true,
        added_quota_minutes: reward_quota,
        new_daily_quota_minutes: new_total_quota,
        xp_earned,
        message: format!(
            "Hoàn thành bài thu hoạch! Đã cộng {} phút vào Quota giải trí.",
            reward_quota
        ),
    })
}



#[derive(Serialize)]
pub struct IeltsTopic {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub icon: String,
}

#[derive(Serialize)]
pub struct IeltsWord {
    pub id: i64,
    pub topic_id: i64,
    pub word: String,
}

#[derive(Serialize)]
pub struct VocabProgress {
    pub word_id: i64,
    pub status: String,
    pub correct_streak: i64,
}

#[derive(Serialize)]
pub struct IeltsTestResult {
    pub success: bool,
    pub quota_added: u32,
    pub message: String,
}

#[tauri::command]
pub async fn get_ielts_topics(db: State<'_, DbState>) -> Result<Vec<IeltsTopic>, String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, icon FROM ielts_topics").map_err(|e| e.to_string())?;
    let topics = stmt.query_map([], |row| {
        Ok(IeltsTopic {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    Ok(topics)
}

#[tauri::command]
pub async fn get_topic_words(db: State<'_, DbState>, topic_id: i64) -> Result<Vec<IeltsWord>, String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let mut stmt = conn.prepare("SELECT id, topic_id, word FROM ielts_words WHERE topic_id = ?1").map_err(|e| e.to_string())?;
    let words = stmt.query_map([topic_id], |row| {
        Ok(IeltsWord {
            id: row.get(0)?,
            topic_id: row.get(1)?,
            word: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    Ok(words)
}

#[tauri::command]
pub async fn fetch_cambridge(db: State<'_, DbState>, word: String) -> Result<CambridgeEntry, String> {
    {
        let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        let cached: Option<CambridgeEntry> = conn.query_row(
            "SELECT pos, ipa_uk, ipa_us, audio_url_uk, audio_url_us, definition, examples FROM cambridge_cache WHERE word = ?1",
            [&word],
            |row| {
                let examples_json: String = row.get(6).unwrap_or_default();
                let examples: Vec<String> = serde_json::from_str(&examples_json).unwrap_or_default();
                Ok(CambridgeEntry {
                    pos: row.get(0).unwrap_or_default(),
                    ipa_uk: row.get(1).unwrap_or_default(),
                    ipa_us: row.get(2).unwrap_or_default(),
                    audio_url_uk: row.get(3).unwrap_or_default(),
                    audio_url_us: row.get(4).unwrap_or_default(),
                    definition: row.get(5).unwrap_or_default(),
                    examples,
                })
            }
        ).ok();
        if let Some(entry) = cached {
            return Ok(entry);
        }
    }
    
    let entry = fetch_word_data(&word).await?;
    
    {
        let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        let examples_json = serde_json::to_string(&entry.examples).unwrap_or_default();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO cambridge_cache (word, pos, ipa_uk, ipa_us, audio_url_uk, audio_url_us, definition, examples, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
            params![word, entry.pos, entry.ipa_uk, entry.ipa_us, entry.audio_url_uk, entry.audio_url_us, entry.definition, examples_json]
        );
    }
    
    Ok(entry)
}

#[tauri::command]
pub async fn update_vocab_progress(db: State<'_, DbState>, word_id: i64, correct: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    let current_streak: i64 = conn.query_row("SELECT correct_streak FROM user_vocab_progress WHERE word_id = ?1", [word_id], |row| row.get(0)).unwrap_or(0);
    
    let new_streak = if correct { current_streak + 1 } else { 0 };
    let status = if new_streak >= 3 { "mastered" } else { "learning" };
    
    conn.execute(
        "INSERT INTO user_vocab_progress (word_id, status, correct_streak, last_tested_at) VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(word_id) DO UPDATE SET status = ?2, correct_streak = ?3, last_tested_at = datetime('now')",
        params![word_id, status, new_streak]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_vocab_progress(db: State<'_, DbState>, topic_id: i64) -> Result<Vec<VocabProgress>, String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let mut stmt = conn.prepare("SELECT p.word_id, p.status, p.correct_streak FROM user_vocab_progress p JOIN ielts_words w ON p.word_id = w.id WHERE w.topic_id = ?1").map_err(|e| e.to_string())?;
    let progress = stmt.query_map([topic_id], |row| {
        Ok(VocabProgress {
            word_id: row.get(0)?,
            status: row.get(1)?,
            correct_streak: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    Ok(progress)
}

#[tauri::command]
pub async fn submit_ielts_test(
    app: AppHandle,
    state: State<'_, ConfigState>,
    score: u32,
    total: u32,
    mode: String
) -> Result<IeltsTestResult, String> {
    if score != total || total == 0 {
        return Ok(IeltsTestResult {
            success: false,
            quota_added: 0,
            message: "Bạn phải đạt 100% để nhận thưởng.".to_string()
        });
    }

    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;

    if mode == "quota" {
        let reward = crate::commands::calculate_study_reward_quota(
            total,
            config_data.study_minutes_required,
            config_data.reward_quota_minutes,
        );
        config_data.daily_quota_minutes = config_data.daily_quota_minutes.saturating_add(reward);
        let _ = config::save_config(&app, &config_data);
        Ok(IeltsTestResult {
            success: true,
            quota_added: reward,
            message: format!("Đã cộng {} phút vào Quota.", reward)
        })
    } else if mode == "unlock" {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        config_data.temporary_unlock_until = Some(now + 300);
        let _ = config::save_config(&app, &config_data);
        Ok(IeltsTestResult {
            success: true,
            quota_added: 0,
            message: "Đã mở khóa cài đặt trong 5 phút.".to_string()
        })
    } else {
        Err("Invalid mode".to_string())
    }
}


#[tauri::command]
pub async fn open_ielts_battle(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    // If it already exists, just focus it
    if let Some(existing_window) = app.get_webview_window("ielts_battle") {
        let _ = existing_window.set_focus();
        let _ = existing_window.show();
        return Ok(());
    }

    let main_window = app.get_webview_window("main").ok_or("No main window")?;
    let outer_pos = main_window.outer_position().map_err(|e| e.to_string())?;
    let inner_size = main_window.inner_size().map_err(|e| e.to_string())?;

    let init_script = r#"
        setInterval(() => {
            if (window.location.href.includes('/profile')) {
                try {
                    let match = document.body.innerText.match(/Total battles\s+(\d+)|Total battles.*?\n(\d+)/);
                    if (match) {
                        let battles = parseInt(match[1] || match[2], 10);
                        let initial = sessionStorage.getItem('__ielts_initial_battles');
                        if (initial === null) {
                            sessionStorage.setItem('__ielts_initial_battles', battles.toString());
                        } else if (battles > parseInt(initial, 10)) {
                            if (!sessionStorage.getItem('__ielts_success_sent')) {
                                sessionStorage.setItem('__ielts_success_sent', 'true');
                                window.__TAURI__.core.invoke('ielts_battle_success', {}).catch(console.error);
                            }
                        }
                    }
                } catch(e) {}
            }
        }, 2000);
    "#;

    let _webview = tauri::WebviewWindowBuilder::new(
        &app,
        "ielts_battle",
        tauri::WebviewUrl::External("https://ieltsleague.app".parse().unwrap())
    )
    .title("IELTS League")
    .decorations(false)
    .visible(true)
    .focused(true)
    .inner_size(inner_size.width as f64, (inner_size.height.saturating_sub(80)) as f64)
    .position(outer_pos.x as f64, (outer_pos.y + 80) as f64)
    .initialization_script(init_script)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ielts_battle_success(
    app: AppHandle,
    state: State<'_, ConfigState>
) -> Result<(), String> {
    use tauri::{Manager, Emitter};
    if let Some(window) = app.get_webview_window("ielts_battle") {
        let _ = window.close();
    }
    
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    config_data.daily_quota_minutes = config_data.daily_quota_minutes.saturating_add(30);
    let _ = crate::config::save_config(&app, &config_data);
    
    let _ = app.emit("battle_success", ());
    Ok(())
}



/// CaiNghien Control & Rescue Tool — Rust Backend Module
///
/// Provides system diagnostics, emergency recovery, hosts block toggle,
/// password/hardcore reset, and config backup/restore commands.

use regex::Regex;
use std::fs;
use std::os::windows::process::CommandExt;
use std::process::Command;


const CREATE_NO_WINDOW: u32 = 0x08000000;
const HOSTS_PATH: &str = r"C:\Windows\System32\drivers\etc\hosts";
const MARKER_START: &str = "# CAINGHIEN START";
const MARKER_END: &str = "# CAINGHIEN END";

// ─── Response Types ──────────────────────────────────────────────

#[derive(Serialize)]
pub struct SystemDiagnostics {
    pub app_running: bool,
    pub app_pid: Option<u32>,
    pub watchdog_running: bool,
    pub watchdog_pid: Option<u32>,
    pub hosts_blocked: bool,
    pub hosts_block_count: u32,
    pub dns_servers: Vec<String>,
    pub protection_enabled: bool,
    pub hardcore_active: bool,
    pub hardcore_remaining: Option<String>,
    pub config_path: String,
    pub has_password: bool,
}

#[derive(Serialize)]
pub struct EmergencyResult {
    pub processes_killed: u32,
    pub hosts_cleaned: bool,
    pub dns_reset: bool,
    pub protection_disabled: bool,
    pub message: String,
}

#[derive(Serialize)]
pub struct HostsToggleResult {
    pub is_blocked: bool,
    pub domains_count: u32,
    pub message: String,
}

// ─── Helpers ─────────────────────────────────────────────────────

fn get_hosts_content() -> Result<String, String> {
    fs::read_to_string(HOSTS_PATH).map_err(|e| format!("Không thể đọc hosts: {}", e))
}

fn hosts_has_block(content: &str) -> bool {
    content.contains(MARKER_START) && content.contains(MARKER_END)
}

fn count_blocked_lines(content: &str) -> u32 {
    let mut in_block = false;
    let mut count = 0u32;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == MARKER_START {
            in_block = true;
            continue;
        }
        if trimmed == MARKER_END {
            in_block = false;
            continue;
        }
        if in_block && !trimmed.is_empty() && !trimmed.starts_with('#') {
            count += 1;
        }
    }
    count
}

fn remove_hosts_block(content: &str) -> String {
    let re = Regex::new(r"(?m)\r?\n?# CAINGHIEN START\r?\n[\s\S]*?# CAINGHIEN END\r?\n?")
        .unwrap();
    re.replace_all(content, "").to_string()
}

fn flush_dns() {
    let _ = Command::new("ipconfig")
        .args(["/flushdns"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

fn reset_dns_to_dhcp() {
    for iface in &["Ethernet", "Wi-Fi", "Local Area Connection"] {
        let _ = Command::new("netsh")
            .args(["interface", "ip", "set", "dns", iface, "dhcp"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    flush_dns();
}

fn parse_dns_servers() -> Vec<String> {
    let output = Command::new("netsh")
        .args(["interface", "ip", "show", "dns"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let mut servers = Vec::new();
    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            let trimmed = line.trim();
            // Lines like "1.1.1.3" or "DNS Servers: 1.1.1.3" or containing IPs
            if let Some(ip) = extract_ip(trimmed) {
                if !servers.contains(&ip) {
                    servers.push(ip);
                }
            }
        }
    }
    servers
}

fn extract_ip(s: &str) -> Option<String> {
    let re = Regex::new(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})").unwrap();
    re.captures(s).map(|c| c[1].to_string())
}

fn format_duration_remaining(seconds: i64) -> String {
    if seconds <= 0 {
        return "Hết hạn".to_string();
    }
    let hours = seconds / 3600;
    let mins = (seconds % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, mins)
    } else {
        format!("{}m", mins)
    }
}

// ─── Commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_system_diagnostics(
    state: State<'_, ConfigState>,
) -> Result<SystemDiagnostics, String> {
    // Process detection using sysinfo
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let current_pid = std::process::id();
    let mut app_running = false;
    let mut app_pid: Option<u32> = None;
    let mut watchdog_running = false;
    let mut watchdog_pid: Option<u32> = None;

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("cainghien_tauri") {
            let pid_u32 = pid.as_u32();
            app_running = true;
            if app_pid.is_none() || pid_u32 == current_pid {
                app_pid = Some(pid_u32);
            }

            // Check if this is a watchdog process
            let cmd_args: Vec<String> = process.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect();
            if cmd_args.iter().any(|a| a.contains("--watchdog")) {
                watchdog_running = true;
                watchdog_pid = Some(pid_u32);
            }
        }
    }

    // Hosts file analysis
    let hosts_content = get_hosts_content().unwrap_or_default();
    let hosts_blocked = hosts_has_block(&hosts_content);
    let hosts_block_count = if hosts_blocked {
        count_blocked_lines(&hosts_content)
    } else {
        0
    };

    // DNS servers
    let dns_servers = parse_dns_servers();

    // Config state
    let config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let protection_enabled = config.protection_enabled;
    let has_password = config.password_hash.is_some();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let hardcore_active = config
        .hardcore_until
        .map(|until| now < until)
        .unwrap_or(false);

    let hardcore_remaining = if hardcore_active {
        config
            .hardcore_until
            .map(|until| format_duration_remaining(until - now))
    } else {
        None
    };

    let config_path = crate::config::get_default_config_path()
        .to_string_lossy()
        .to_string();

    Ok(SystemDiagnostics {
        app_running,
        app_pid,
        watchdog_running,
        watchdog_pid,
        hosts_blocked,
        hosts_block_count,
        dns_servers,
        protection_enabled,
        hardcore_active,
        hardcore_remaining,
        config_path,
        has_password,
    })
}

#[tauri::command]
pub fn emergency_kill_and_restore(
    app: tauri::AppHandle,
    state: State<'_, ConfigState>,
) -> Result<EmergencyResult, String> {
    let current_pid = std::process::id();
    let mut processes_killed = 0u32;

    // Kill all cainghien_tauri processes except current
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("cainghien_tauri") && pid.as_u32() != current_pid {
            process.kill();
            processes_killed += 1;
        }
    }

    // Clean hosts file
    let hosts_cleaned = if let Ok(content) = get_hosts_content() {
        if hosts_has_block(&content) {
            let cleaned = remove_hosts_block(&content);
            fs::write(HOSTS_PATH, cleaned.trim_end().to_string() + "\n").is_ok()
        } else {
            true
        }
    } else {
        false
    };

    // Reset DNS
    reset_dns_to_dhcp();
    let dns_reset = true;

    // Disable protection in config
    let protection_disabled = {
        let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        config.protection_enabled = false;
        crate::config::save_config(&app, &config).is_ok()
    };

    let msg = format!(
        "Đã khôi phục: {} tiến trình đã dừng, hosts {}, DNS reset, bảo vệ {}.",
        processes_killed,
        if hosts_cleaned { "đã dọn" } else { "lỗi dọn" },
        if protection_disabled {
            "đã tắt"
        } else {
            "lỗi tắt"
        }
    );

    Ok(EmergencyResult {
        processes_killed,
        hosts_cleaned,
        dns_reset,
        protection_disabled,
        message: msg,
    })
}

#[tauri::command]
pub fn toggle_hosts_block(
    state: State<'_, ConfigState>,
) -> Result<HostsToggleResult, String> {
    let content = get_hosts_content()?;

    if hosts_has_block(&content) {
        // Remove block
        let cleaned = remove_hosts_block(&content);
        fs::write(HOSTS_PATH, cleaned.trim_end().to_string() + "\n")
            .map_err(|e| format!("Không thể ghi hosts: {}", e))?;
        flush_dns();

        Ok(HostsToggleResult {
            is_blocked: false,
            domains_count: 0,
            message: "Đã gỡ chặn tất cả tên miền khỏi hosts.".to_string(),
        })
    } else {
        // Apply block from config
        let config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        let domains = &config.blocked_domains;

        if domains.is_empty() {
            return Ok(HostsToggleResult {
                is_blocked: false,
                domains_count: 0,
                message: "Không có tên miền nào để chặn. Hãy thêm tên miền trong Cài đặt chung."
                    .to_string(),
            });
        }

        let mut block_lines = vec![String::new(), MARKER_START.to_string()];
        for domain in domains {
            let d = domain.trim();
            if !d.is_empty() {
                block_lines.push(format!("0.0.0.0 {}", d));
                block_lines.push(format!("0.0.0.0 www.{}", d));
            }
        }
        block_lines.push(MARKER_END.to_string());

        let new_content = content.trim_end().to_string() + &block_lines.join("\n") + "\n";
        fs::write(HOSTS_PATH, &new_content)
            .map_err(|e| format!("Không thể ghi hosts: {}", e))?;
        flush_dns();

        let count = domains.iter().filter(|d| !d.trim().is_empty()).count() as u32;
        Ok(HostsToggleResult {
            is_blocked: true,
            domains_count: count,
            message: format!("Đã chặn {} tên miền trong hosts.", count),
        })
    }
}

#[tauri::command]
pub fn reset_password_and_hardcore(
    app: tauri::AppHandle,
    state: State<'_, ConfigState>,
) -> Result<String, String> {
    let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;

    config.password_hash = None;
    config.hardcore_until = None;
    config.protection_enabled = false;

    crate::config::save_config(&app, &config)?;

    Ok("Đã xóa mật khẩu, tắt Hardcore và tắt bảo vệ thành công.".to_string())
}

#[tauri::command]
pub fn backup_config() -> Result<String, String> {
    let config_path = crate::config::get_default_config_path();

    if !config_path.exists() {
        return Err("Không tìm thấy file cấu hình để sao lưu.".to_string());
    }

    let backup_path = config_path.with_extension("backup.json");
    fs::copy(&config_path, &backup_path).map_err(|e| format!("Lỗi sao lưu: {}", e))?;

    Ok(format!(
        "Đã sao lưu cấu hình tại: {}",
        backup_path.to_string_lossy()
    ))
}

#[tauri::command]
pub fn restore_config(
    app: tauri::AppHandle,
    state: State<'_, ConfigState>,
) -> Result<String, String> {
    let config_path = crate::config::get_default_config_path();
    let backup_path = config_path.with_extension("backup.json");

    if !backup_path.exists() {
        return Err("Không tìm thấy file sao lưu. Hãy sao lưu trước.".to_string());
    }

    let restored = crate::config::load_config_from_path(&backup_path);

    let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    *config = restored;
    crate::config::save_config(&app, &config)?;

    Ok("Đã khôi phục cấu hình từ bản sao lưu thành công.".to_string())
}

