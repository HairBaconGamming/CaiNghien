pub mod models;
pub mod config;
pub mod enforcement;

use tauri::{Manager, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_autostart::MacosLauncher;
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn set_password(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>, password: Option<String>) -> Result<(), String> {
    let mut config_data = state.0.lock().unwrap().clone();
    
    if let Some(pwd) = password {
        let mut hasher = Sha256::new();
        hasher.update(pwd.as_bytes());
        let result = hasher.finalize();
        config_data.password_hash = Some(hex::encode(result));
        config_data.unlock_requested_at = None; // Reset unlock request when password changes
    } else {
        config_data.password_hash = None;
        config_data.unlock_requested_at = None;
    }
    
    let _ = config::save_config(&app, &config_data);
    *state.0.lock().unwrap() = config_data;
    Ok(())
}

#[tauri::command]
fn verify_password(state: tauri::State<'_, config::ConfigState>, password: String) -> Result<bool, String> {
    let config_data = state.0.lock().unwrap();
    if let Some(ref hash) = config_data.password_hash {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let result = hex::encode(hasher.finalize());
        Ok(&result == hash)
    } else {
        Ok(true) // No password set
    }
}

#[tauri::command]
fn request_unlock(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>) -> Result<u64, String> {
    let mut config_data = state.0.lock().unwrap().clone();
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    config_data.unlock_requested_at = Some(now);
    
    let _ = config::save_config(&app, &config_data);
    *state.0.lock().unwrap() = config_data.clone();
    
    Ok(now)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config_data = config::load_config(app.handle());
            app.manage(config::ConfigState(std::sync::Mutex::new(config_data)));
            
            // Start enforcement background loop
            enforcement::spawn_enforcement_loop(app.handle().clone());
            
            // Setup Tray Icon
            let quit_i = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Mở ứng dụng", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        let is_protected = {
                            let state = app.state::<config::ConfigState>();
                            let enabled = state.0.lock().unwrap().protection_enabled;
                            enabled
                        };
                        
                        if is_protected {
                            // Prevent quit, show window instead
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        } else {
                            std::process::exit(0);
                        }
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_app_config,
            config::save_app_config,
            set_password,
            verify_password,
            request_unlock
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
