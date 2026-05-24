use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

use crate::models::AppConfig;

pub struct ConfigState(pub Mutex<AppConfig>);

fn get_config_path(app: &AppHandle) -> PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("data"));
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("config.json");
    path
}

pub fn load_config(app: &AppHandle) -> AppConfig {
    let path = get_config_path(app);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            // we skip the "schema" wrapper for simplicity if we want, or parse it.
            // For now, let's assume we read/write the config directly, or extract "data".
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(data) = parsed.get("data") {
                    if let Ok(config) = serde_json::from_value(data.clone()) {
                        return config;
                    }
                }
            }
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app);
    let wrapper = serde_json::json!({
        "schema": 2,
        "saved_at": chrono::Utc::now().to_rfc3339(),
        "data": config,
    });
    let content = serde_json::to_string_pretty(&wrapper).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
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
    new_config: AppConfig,
) -> Result<(), String> {
    let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    *config = new_config.clone();
    save_config(&app, &config)?;
    Ok(())
}
