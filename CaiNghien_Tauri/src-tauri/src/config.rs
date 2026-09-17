use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

use crate::models::AppConfig;

pub struct ConfigState(pub Mutex<AppConfig>);
pub type AppConfigState = ConfigState;

pub fn get_default_config_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let mut path = PathBuf::from(appdata);
        path.push("com.cainghien.desktop");
        let _ = fs::create_dir_all(&path);
        path.push("config.json");
        path
    } else {
        PathBuf::from("config.json")
    }
}

pub fn get_config_path(app: &AppHandle) -> PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| {
        if let Ok(appdata) = std::env::var("APPDATA") {
            PathBuf::from(appdata).join("com.cainghien.desktop")
        } else {
            PathBuf::from("data")
        }
    });
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("config.json");
    path
}

pub fn load_config_from_path(path: &std::path::Path) -> AppConfig {
    let mut config = AppConfig::default();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(data) = parsed.get("data") {
                    if let Ok(c) = serde_json::from_value(data.clone()) {
                        config = c;
                    }
                }
            } else if let Ok(c) = serde_json::from_str::<AppConfig>(&content) {
                config = c;
            }
        }
    }
    config
}

pub fn load_config(app: &AppHandle) -> AppConfig {
    let path = get_config_path(app);
    let mut config = load_config_from_path(&path);
    
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    if config.quota_last_reset_date != today {
        config.quota_last_reset_date = today;
        config.quota_used_seconds = 0;
        let _ = save_config(app, &config);
    }
    
    config
}

pub fn atomic_save_to_path(path: &std::path::Path, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let wrapper = serde_json::json!({
        "schema": 2,
        "saved_at": chrono::Utc::now().to_rfc3339(),
        "data": config,
    });
    let content = serde_json::to_string_pretty(&wrapper).map_err(|e| e.to_string())?;

    let tmp_path = path.with_extension(format!("tmp.{}", std::process::id()));
    fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
    if let Err(_) = fs::rename(&tmp_path, path) {
        let _ = fs::copy(&tmp_path, path);
        let _ = fs::remove_file(&tmp_path);
    }
    Ok(())
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app);
    atomic_save_to_path(&path, config)
}

pub fn apply_penalty_core(config: &mut AppConfig) {
    config.level = 1;
    config.xp = 0;
    config.streak = 0;
    config.total_focus_hours = 0;
    config.current_day_focus_seconds = 0;
    config.violations_count += 1;
    config.daily_stats.clear();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let entry = config.daily_history.entry(today.clone()).or_insert_with(|| crate::models::DayDisciplineRecord {
        date: today,
        focus_minutes: 0,
        violations: 0,
        is_clean: false,
    });
    entry.violations += 1;
    entry.is_clean = false;
}
#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, ConfigState>) -> Result<AppConfig, String> {
    let config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn save_app_config(
    app: AppHandle,
    state: tauri::State<'_, ConfigState>,
    mut new_config: AppConfig,
) -> Result<(), String> {
    let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

    if let Some(current_hardcore) = config.hardcore_until {
        if (now as i64) < current_hardcore {
            if config.protection_enabled && !new_config.protection_enabled {
                return Err("Hardcore mode is active.".into());
            }
            new_config.hardcore_until = Some(current_hardcore);
        }
    }

    if config.protection_enabled && !new_config.protection_enabled {
        if config.password_hash.is_some() {
            let mut can_disable = false;
            
            if let Some(until) = config.temporary_unlock_until {
                if now <= until {
                    can_disable = true;
                }
            }
            
            if !can_disable {
                if let Some(req_at) = config.unlock_requested_at {
                    if now >= req_at + 7 * 24 * 60 * 60 {
                        can_disable = true;
                    }
                }
            }
            
            if !can_disable {
                return Err("Cannot disable protection: password required or cooldown active.".into());
            }
        }
        new_config.protection_started_at = None;
    } else if !config.protection_enabled && new_config.protection_enabled {
        new_config.protection_started_at = Some(now);
    } else {
        new_config.protection_started_at = config.protection_started_at;
    }
    
    new_config.violations_count = config.violations_count; // Preserve violations count
    new_config.temporary_unlock_until = config.temporary_unlock_until;
    new_config.quota_used_seconds = config.quota_used_seconds;
    new_config.quota_last_reset_date = config.quota_last_reset_date.clone();
    if new_config.daily_history.is_empty() && !config.daily_history.is_empty() {
        new_config.daily_history = config.daily_history.clone();
    }
    if new_config.focus_sessions.is_empty() && !config.focus_sessions.is_empty() {
        new_config.focus_sessions = config.focus_sessions.clone();
    }
    if new_config.typing_scores.is_empty() && !config.typing_scores.is_empty() {
        new_config.typing_scores = config.typing_scores.clone();
    }
    if new_config.heatmap_days.is_empty() && !config.heatmap_days.is_empty() {
        new_config.heatmap_days = config.heatmap_days.clone();
    }
    *config = new_config.clone();
    save_config(&app, &config)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_penalty_core() {
        let mut config = AppConfig::default();
        config.level = 8;
        config.xp = 999;
        config.streak = 30;
        config.total_focus_hours = 50;
        config.current_day_focus_seconds = 45;
        config.violations_count = 2;
        config.daily_stats.insert("2026-09-15".to_string(), 120);

        apply_penalty_core(&mut config);

        assert_eq!(config.level, 1);
        assert_eq!(config.xp, 0);
        assert_eq!(config.streak, 0);
        assert_eq!(config.total_focus_hours, 0);
        assert_eq!(config.current_day_focus_seconds, 0);
        assert_eq!(config.violations_count, 3);
        assert!(config.daily_stats.is_empty());

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let hist = config.daily_history.get(&today).expect("Must have today's record");
        assert_eq!(hist.violations, 1);
        assert!(!hist.is_clean);
    }

    #[test]
    fn test_atomic_save_and_load() {
        let tmp_dir = std::env::temp_dir().join(format!("cainghien_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&tmp_dir);
        let path = tmp_dir.join("test_config.json");

        let mut config = AppConfig::default();
        config.level = 3;
        config.xp = 120;
        config.streak = 5;

        atomic_save_to_path(&path, &config).expect("Must save atomically");
        assert!(path.exists());

        let loaded = load_config_from_path(&path);
        assert_eq!(loaded.level, 3);
        assert_eq!(loaded.xp, 120);
        assert_eq!(loaded.streak, 5);

        let _ = fs::remove_dir_all(&tmp_dir);
    }
}
