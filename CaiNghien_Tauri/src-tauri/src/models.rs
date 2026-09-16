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
}
