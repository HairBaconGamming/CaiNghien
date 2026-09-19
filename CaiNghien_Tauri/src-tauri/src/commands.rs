use tauri::State;
use chrono::{Datelike, Duration, Local, NaiveDate};
use crate::db::DbState;
use crate::models::{
    FocusSessionResult, HeatmapData, HeatmapDay, TypingChallenge,
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
            title: "Cosmic Spark".to_string(),
            author: "Carl Sagan".to_string(),
            difficulty: "easy".to_string(),
            text: "The cosmos is within us. We are made of star-stuff. We are a way for the universe to know itself.".to_string(),
        }),
        "hard" => Ok(TypingChallenge {
            id: "challenge_hard".to_string(),
            title: "Deep Space Singularity".to_string(),
            author: "Cosmic Astrobiology".to_string(),
            difficulty: "hard".to_string(),
            text: "Navigating across relativistic spacetime requires unmatched discipline and pristine focus. Beyond the event horizon of distraction lies the luminous core of profound human potential, where every intentional stroke weaves the fabric of achievement.".to_string(),
        }),
        _ => Ok(TypingChallenge {
            id: "challenge_quantum".to_string(),
            title: "Quantum Speed".to_string(),
            author: "Cosmos Voyager".to_string(),
            difficulty: "medium".to_string(),
            text: "The quick brown fox jumped gracefully over the lazy, sleeping dog. He then sprinted across the galaxy, weaving through constellations of glowing nebulae and vibrant supernovas, navigating the void with speed and accuracy.".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_typing_challenge_selection() {
        let easy = get_typing_challenge_text(Some("easy".to_string())).unwrap();
        assert_eq!(easy.difficulty, "easy");
        assert!(easy.text.contains("star-stuff"));

        let medium = get_typing_challenge_text(None).unwrap();
        assert_eq!(medium.difficulty, "medium");
        assert!(medium.text.contains("quick brown fox"));

        let hard = get_typing_challenge_text(Some("hard".to_string())).unwrap();
        assert_eq!(hard.difficulty, "hard");
        assert!(hard.text.contains("event horizon"));
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
        assert!(heatmap.current_streak >= 128);
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
}
