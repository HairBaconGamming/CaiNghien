use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub protection_enabled: bool,
    pub blocked_domains: Vec<String>,
    pub password_hash: Option<String>,
    pub unlock_requested_at: Option<u64>, // Unix timestamp in seconds
    pub start_with_windows: bool,
    pub change_delay_enabled: bool,
    pub block_nsfw: bool,
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
        }
    }
}
