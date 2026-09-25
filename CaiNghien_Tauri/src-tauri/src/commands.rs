use tauri::State;
use chrono::{Datelike, Duration, Local, NaiveDate};
use crate::db::DbState;
use crate::models::{
    FocusSessionResult, HeatmapData, HeatmapDay, StudyRewardResult, TypingChallenge,
    TypingScore, TypingScoreInput, TypingScoreResult, UserProfile,
};

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
    let conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::get_heatmap_data(&conn)
}

#[tauri::command]
pub fn get_user_profile(state: State<'_, DbState>) -> Result<UserProfile, String> {
    let conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::get_user_profile(&conn)
}

#[tauri::command]
pub fn update_user_profile(
    state: State<'_, DbState>,
    profile: UserProfile,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::update_user_profile(&conn, &profile)
}

#[tauri::command]
pub fn record_focus_session(
    state: State<'_, DbState>,
    duration_minutes: u32,
    session_type: String,
) -> Result<FocusSessionResult, String> {
    let mut conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
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
    let mut conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::save_typing_score(&mut conn, score)
}

#[tauri::command]
pub fn get_typing_scores(state: State<'_, DbState>) -> Result<Vec<TypingScore>, String> {
    let conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::get_typing_scores(&conn)
}

#[tauri::command]
pub fn reset_all_data(state: State<'_, DbState>) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
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
    let req = if study_minutes_required == 0 { 60 } else { study_minutes_required };
    let reward_unit = if reward_quota_minutes == 0 { 15 } else { reward_quota_minutes };
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
        let mut config_data = state.0.lock().map_err(|_| "Config lock poisoned".to_string())?;
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
        let res = crate::db::record_focus_session(&mut conn, study_duration_minutes, "study_to_earn".to_string());
        res.map(|r| r.xp_earned).unwrap_or(study_duration_minutes.saturating_mul(4))
    } else {
        study_duration_minutes.saturating_mul(4)
    };

    Ok(StudyRewardResult {
        success: true,
        added_quota_minutes: reward_quota,
        new_daily_quota_minutes: new_total_quota,
        xp_earned,
        message: format!("Hoàn thành bài thu hoạch! Đã cộng {} phút vào Quota giải trí.", reward_quota),
    })
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_typing_challenge_selection() {
        let easy = get_typing_challenge_text(Some("easy".to_string())).unwrap();
        assert_eq!(easy.difficulty, "easy");
        assert!(easy.text.contains("vì sao"));

        let medium = get_typing_challenge_text(None).unwrap();
        assert_eq!(medium.difficulty, "medium");
        assert!(medium.text.contains("Con cáo nâu"));

        let hard = get_typing_challenge_text(Some("hard".to_string())).unwrap();
        assert_eq!(hard.difficulty, "hard");
        assert!(hard.text.contains("chân trời sự kiện"));
    }

    #[test]
    fn test_count_to_level_tiers() {
        assert_eq!(count_to_level(0), 0);
        assert_eq!(count_to_level(1), 1);
        assert_eq!(count_to_level(3), 1);
        assert_eq!(count_to_level(4), 2);
        assert_eq!(count_to_level(7), 2);
        assert_eq!(count_to_level(8), 3);
        assert_eq!(count_to_level(14), 3);
        assert_eq!(count_to_level(15), 4);
        assert_eq!(count_to_level(25), 4);
        assert_eq!(count_to_level(26), 5);
        assert_eq!(count_to_level(100), 5);
    }

    #[test]
    fn test_compute_heatmap_data_default() {
        let config = crate::models::AppConfig::default();
        let heatmap = compute_heatmap_data_from_config(&config);
        assert_eq!(heatmap.days.len(), 365);
        assert!(heatmap.total_contributions > 0);
        assert!(heatmap.longest_streak > 0);
        assert!(heatmap.activity_rate > 50.0);
    }

    #[test]
    fn test_compute_heatmap_data_with_custom_days() {
        let mut config = crate::models::AppConfig::default();
        let today = Local::now().format("%Y-%m-%d").to_string();
        config.heatmap_days.insert(today, 10);
        let heatmap = compute_heatmap_data_from_config(&config);
        assert_eq!(heatmap.days.len(), 365);
        let today_day = heatmap.days.last().unwrap();
        assert_eq!(today_day.count, 10);
        assert_eq!(today_day.level, 3);
    }

    #[test]
    fn test_validate_study_report_word_count() {
        let short_text = "Đây là một đoạn văn ngắn không đủ một trăm từ.";
        let err = validate_study_report_text(short_text);
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("Yêu cầu tối thiểu 100 từ"));

        let valid_text = (0..105).map(|i| format!("từ{}", i)).collect::<Vec<_>>().join(" ");
        let ok = validate_study_report_text(&valid_text);
        assert!(ok.is_ok());
        assert_eq!(ok.unwrap(), 105);
    }

    #[test]
    fn test_calculate_study_reward_quota() {
        // Default ratio 60m study -> 15m quota
        assert_eq!(calculate_study_reward_quota(60, 60, 15), 15);
        assert_eq!(calculate_study_reward_quota(30, 60, 15), 7);
        assert_eq!(calculate_study_reward_quota(120, 60, 15), 30);
        assert_eq!(calculate_study_reward_quota(0, 60, 15), 0);

        // Custom ratio 45m study -> 20m quota
        assert_eq!(calculate_study_reward_quota(45, 45, 20), 20);
        assert_eq!(calculate_study_reward_quota(90, 45, 20), 40);

        // Zero safety fallbacks
        assert_eq!(calculate_study_reward_quota(60, 0, 0), 15);

        // Precise integer arithmetic eliminating IEEE-754 precision loss
        assert_eq!(calculate_study_reward_quota(245, 60, 60), 245);
        assert_eq!(calculate_study_reward_quota(115, 45, 45), 115);
        assert_eq!(calculate_study_reward_quota(230, 90, 45), 115);
        assert_eq!(calculate_study_reward_quota(35, 25, 45), 63);

        // Large number overflow resistance
        assert_eq!(calculate_study_reward_quota(u32::MAX, 1, 1), u32::MAX);
    }
}
