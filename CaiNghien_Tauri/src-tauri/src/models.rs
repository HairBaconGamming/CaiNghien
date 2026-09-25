use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct DayDisciplineRecord {
    #[serde(default)]
    pub date: String,
    pub focus_minutes: u32,
    pub violations: u32,
    pub is_clean: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct DailyContribution {
    pub date: String,
    pub count: u32,
    pub focus_minutes: u32,
    pub violations: u32,
    pub is_clean: bool,
    pub xp_earned: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct ScheduleConfig {
    pub enabled: bool,
    pub start_time: String,
    pub end_time: String,
    pub days_of_week: Vec<u8>,
}

impl Default for ScheduleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            start_time: "08:00".to_string(),
            end_time: "17:00".to_string(),
            days_of_week: vec![1, 2, 3, 4, 5],
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct UserProfile {
    pub username: String,
    pub title: String,
    pub level: u32,
    #[serde(alias = "xp")]
    pub current_xp: u32,
    pub next_level_xp: u32,
    pub rank: String,
    #[serde(default)]
    pub handle: String,
    #[serde(default)]
    pub avatar_type: String,
    #[serde(default)]
    pub level_title: String,
    #[serde(default)]
    pub next_level_title: String,
    #[serde(default)]
    pub streak: u32,
    #[serde(default)]
    pub longest_streak: u32,
    #[serde(default)]
    pub total_focus_hours: u32,
}

impl Default for UserProfile {
    fn default() -> Self {
        Self {
            username: "User".to_string(),
            handle: "@user".to_string(),
            title: "Novice".to_string(),
            avatar_type: "default".to_string(),
            level: 1,
            level_title: "Novice".to_string(),
            next_level_title: "Level 2".to_string(),
            current_xp: 0,
            next_level_xp: 100,
            streak: 0,
            longest_streak: 0,
            rank: "Unranked".to_string(),
            total_focus_hours: 0,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct HeatmapDay {
    pub date: String,
    pub count: u32,
    pub level: u8,
}

pub type DayCell = HeatmapDay;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct HeatmapData {
    pub total_contributions: u32,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub activity_rate: f64,
    #[serde(default)]
    pub activity_percentage: f64,
    pub days: Vec<HeatmapDay>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct FocusSession {
    pub id: String,
    pub timestamp: u64,
    pub duration_minutes: u32,
    pub quote: Option<String>,
    pub session_type: String,
    pub completed: bool,
    pub xp_earned: u32,
}

impl Default for FocusSession {
    fn default() -> Self {
        Self {
            id: String::new(),
            timestamp: 0,
            duration_minutes: 25,
            quote: None,
            session_type: "pomodoro".to_string(),
            completed: true,
            xp_earned: 100,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct FocusSessionResult {
    pub success: bool,
    pub xp_earned: u32,
    pub new_streak: u32,
    pub today_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudyRewardResult {
    pub success: bool,
    pub added_quota_minutes: u32,
    pub new_daily_quota_minutes: u32,
    pub xp_earned: u32,
    pub message: String,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypingChallenge {
    pub id: String,
    pub text: String,
    pub title: String,
    pub author: String,
    pub difficulty: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TypingScore {
    pub id: String,
    pub timestamp: u64,
    pub wpm: u32,
    pub accuracy: f64,
    pub time_seconds: u32,
    pub words_count: u32,
    pub xp_earned: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TypingScoreInput {
    pub wpm: u32,
    pub accuracy: f64,
    pub time_seconds: u32,
    pub words_count: u32,
    #[serde(default)]
    pub difficulty: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TypingScoreResult {
    pub saved: bool,
    pub rank: String,
    pub xp_earned: u32,
    #[serde(default)]
    pub success: bool,
    #[serde(default)]
    pub new_streak: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AppConfig {
    pub protection_enabled: bool,
    pub blocked_domains: Vec<String>,
    pub password_hash: Option<String>,
    pub unlock_requested_at: Option<u64>, // Unix timestamp in seconds
    pub start_with_windows: bool,
    pub change_delay_enabled: bool,
    pub block_nsfw: bool,
    pub protection_started_at: Option<u64>,
    pub violations_count: u32,
    pub daily_quota_minutes: u32,
    pub quota_used_seconds: u32,
    pub quota_last_reset_date: String,
    
    // Study-to-Earn Conversion Settings
    pub study_minutes_required: u32,
    pub reward_quota_minutes: u32,
    
    // R1: Hardcore Mode
    pub hardcore_until: Option<i64>,

    // R2: Gamification & Stats
    pub daily_stats: HashMap<String, u32>,
    pub total_focus_hours: u32,
    pub current_day_focus_seconds: u32,

    // R5: Penalty System & Core Gamification Fields
    pub level: u32,
    pub xp: u32,
    pub streak: u32,

    // R2: Fixed Schedule Auto-Blocking
    pub schedule: ScheduleConfig,

    // R1: Heatmap History Backend
    pub daily_history: HashMap<String, DayDisciplineRecord>,

    #[serde(skip)]
    pub temporary_unlock_until: Option<u64>,

    // M2: Cosmos gamification & screens persistence
    #[serde(default)]
    pub user_profile: UserProfile,
    #[serde(default)]
    pub focus_sessions: Vec<FocusSession>,
    #[serde(default)]
    pub typing_scores: Vec<TypingScore>,
    #[serde(default)]
    pub heatmap_days: HashMap<String, u32>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            protection_enabled: false,
            blocked_domains: vec![
                "facebook.com".into(),
                "instagram.com".into(),
                "tiktok.com".into(),
                "x.com".into(),
                "youtube.com".into(),
                "reddit.com".into(),
                "discord.com".into(),
            ],
            password_hash: None,
            unlock_requested_at: None,
            start_with_windows: false,
            change_delay_enabled: true,
            block_nsfw: false,
            protection_started_at: None,
            violations_count: 0,
            daily_quota_minutes: 60,
            quota_used_seconds: 0,
            quota_last_reset_date: "".to_string(),
            study_minutes_required: 60,
            reward_quota_minutes: 15,
            hardcore_until: None,
            daily_stats: HashMap::new(),
            total_focus_hours: 0,
            current_day_focus_seconds: 0,
            level: 1,
            xp: 0,
            streak: 0,
            schedule: ScheduleConfig::default(),
            daily_history: HashMap::new(),
            temporary_unlock_until: None,
            user_profile: UserProfile::default(),
            focus_sessions: Vec::new(),
            typing_scores: Vec::new(),
            heatmap_days: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_defaults() {
        let config = AppConfig::default();
        assert_eq!(config.level, 1);
        assert_eq!(config.xp, 0);
        assert_eq!(config.streak, 0);
        assert!(!config.schedule.enabled);
        assert_eq!(config.schedule.start_time, "08:00");
        assert_eq!(config.schedule.end_time, "17:00");
        assert_eq!(config.schedule.days_of_week, vec![1, 2, 3, 4, 5]);
        assert!(config.daily_history.is_empty());
        assert_eq!(config.daily_quota_minutes, 60);
        assert_eq!(config.study_minutes_required, 60);
        assert_eq!(config.reward_quota_minutes, 15);
        assert_eq!(config.user_profile.level, 1);
        assert_eq!(config.user_profile.title, "Novice");
        assert!(config.focus_sessions.is_empty());
        assert!(config.typing_scores.is_empty());
    }

    #[test]
    fn test_backward_compatibility_deserialization() {
        let old_json = r#"{
            "protection_enabled": true,
            "blocked_domains": ["youtube.com"],
            "violations_count": 3
        }"#;
        let config: AppConfig = serde_json::from_str(old_json).expect("Should deserialize old config");
        assert_eq!(config.level, 1);
        assert_eq!(config.xp, 0);
        assert_eq!(config.streak, 0);
        assert!(!config.schedule.enabled);
        assert!(config.daily_history.is_empty());
        assert_eq!(config.violations_count, 3);
        assert!(config.protection_enabled);
        assert_eq!(config.daily_quota_minutes, 60);
        assert_eq!(config.study_minutes_required, 60);
        assert_eq!(config.reward_quota_minutes, 15);
        assert_eq!(config.user_profile.title, "Novice");
    }

    #[test]
    fn test_full_roundtrip_serialization() {
        let mut config = AppConfig::default();
        config.level = 5;
        config.xp = 350;
        config.streak = 14;
        config.schedule.enabled = true;
        config.daily_history.insert("2026-09-16".to_string(), DayDisciplineRecord {
            date: "2026-09-16".to_string(),
            focus_minutes: 120,
            violations: 0,
            is_clean: true,
        });

        let serialized = serde_json::to_string(&config).expect("Must serialize");
        let deserialized: AppConfig = serde_json::from_str(&serialized).expect("Must deserialize");
        assert_eq!(deserialized.level, 5);
        assert_eq!(deserialized.xp, 350);
        assert_eq!(deserialized.streak, 14);
        assert!(deserialized.schedule.enabled);
        let rec = deserialized.daily_history.get("2026-09-16").unwrap();
        assert_eq!(rec.focus_minutes, 120);
        assert!(rec.is_clean);
        assert_eq!(rec.violations, 0);
    }

    #[test]
    fn test_cosmos_models_roundtrip() {
        let mut config = AppConfig::default();
        config.user_profile.username = "Cosmic Traveler".to_string();
        config.user_profile.level = 29;
        config.focus_sessions.push(FocusSession {
            id: "session-1".to_string(),
            timestamp: 1700000000,
            duration_minutes: 25,
            quote: Some("Silence is strength".to_string()),
            session_type: "pomodoro".to_string(),
            completed: true,
            xp_earned: 100,
        });
        config.typing_scores.push(TypingScore {
            id: "score-1".to_string(),
            timestamp: 1700000000,
            wpm: 85,
            accuracy: 99.5,
            time_seconds: 40,
            words_count: 55,
            xp_earned: 50,
        });
        config.heatmap_days.insert("2026-09-17".to_string(), 4);

        let json = serde_json::to_string(&config).expect("Must serialize");
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Must deserialize");
        assert_eq!(deserialized.user_profile.username, "Cosmic Traveler");
        assert_eq!(deserialized.user_profile.level, 29);
        assert_eq!(deserialized.focus_sessions.len(), 1);
        assert_eq!(deserialized.typing_scores.len(), 1);
        assert_eq!(deserialized.heatmap_days.get("2026-09-17"), Some(&4));
    }

    #[test]
    fn test_study_reward_config_serialization() {
        let mut config = AppConfig::default();
        config.study_minutes_required = 90;
        config.reward_quota_minutes = 20;

        let json = serde_json::to_string(&config).expect("Must serialize");
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Must deserialize");
        assert_eq!(deserialized.study_minutes_required, 90);
        assert_eq!(deserialized.reward_quota_minutes, 20);

        let reward_res = StudyRewardResult {
            success: true,
            added_quota_minutes: 20,
            new_daily_quota_minutes: 80,
            xp_earned: 360,
            message: "Hoàn thành bài thu hoạch!".to_string(),
        };
        let res_json = serde_json::to_string(&reward_res).expect("Must serialize result");
        let res_deserialized: StudyRewardResult = serde_json::from_str(&res_json).expect("Must deserialize result");
        assert!(res_deserialized.success);
        assert_eq!(res_deserialized.added_quota_minutes, 20);
        assert_eq!(res_deserialized.new_daily_quota_minutes, 80);
        assert_eq!(res_deserialized.xp_earned, 360);
    }
}

