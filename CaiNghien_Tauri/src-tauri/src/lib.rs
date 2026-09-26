pub mod models;
pub mod config;
pub mod enforcement;
pub mod hooks;
pub mod commands;
pub mod db;

use tauri::{Emitter, Manager, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};
use std::os::windows::process::CommandExt;

#[tauri::command]
fn set_password(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>, password: Option<String>) -> Result<(), String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    if let Some(hardcore_until) = config_data.hardcore_until {
        if (now as i64) < hardcore_until {
            return Err("Hardcore mode is active.".to_string());
        }
    }

    if config_data.password_hash.is_some() {
        let mut can_change = false;
        if let Some(until) = config_data.temporary_unlock_until {
            if now <= until {
                can_change = true;
            }
        }
        if !can_change {
            return Err("Authentication required to change or remove password.".to_string());
        }
    }
    
    if let Some(pwd) = password {
        use rand::RngCore;
        let mut salt = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut salt);
        let mut hash = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<sha2::Sha256>(pwd.as_bytes(), &salt, 600_000, &mut hash);
        let stored = format!("{}:{}", hex::encode(salt), hex::encode(hash));
        config_data.password_hash = Some(stored);
        config_data.unlock_requested_at = None;
    } else {
        config_data.password_hash = None;
        config_data.unlock_requested_at = None;
    }
    
    let _ = config::save_config(&app, &config_data);
    Ok(())
}

#[tauri::command]
fn set_hardcore_mode(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>, hours: u32) -> Result<(), String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    let until = now + (hours as i64) * 3600;
    
    if let Some(current) = config_data.hardcore_until {
        if now < current && until < current {
            return Err("Cannot decrease hardcore time!".to_string());
        }
    }
    
    config_data.hardcore_until = Some(until);
    let _ = config::save_config(&app, &config_data);
    Ok(())
}

#[tauri::command]
fn verify_password(state: tauri::State<'_, config::ConfigState>, password: String) -> Result<bool, String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    if let Some(hardcore_until) = config_data.hardcore_until {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
        if now < hardcore_until {
            return Err("Hardcore mode is active.".to_string());
        }
    }

    if let Some(ref stored) = config_data.password_hash {
        let parts: Vec<&str> = stored.split(':').collect();
        let ok = if parts.len() == 2 {
            let salt = hex::decode(parts[0]).map_err(|_| "Invalid salt format".to_string())?;
            let hash = hex::decode(parts[1]).map_err(|_| "Invalid hash format".to_string())?;
            let mut derived = [0u8; 32];
            pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), &salt, 600_000, &mut derived);
            derived.as_ref() == hash.as_slice()
        } else {
            // Support legacy SHA-256 for migration
            let mut hasher = sha2::Sha256::new();
            sha2::Digest::update(&mut hasher, password.as_bytes());
            let result = hex::encode(sha2::Digest::finalize(hasher));
            &result == stored
        };
        
        if ok {
            config_data.temporary_unlock_until = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() + 60);
        }
        Ok(ok)
    } else {
        Ok(true) // No password set
    }
}

#[tauri::command]
fn request_unlock(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>) -> Result<u64, String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    if let Some(hardcore_until) = config_data.hardcore_until {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
        if now < hardcore_until {
            return Err("Hardcore mode is active.".to_string());
        }
    }

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    config_data.unlock_requested_at = Some(now);
    
    let _ = config::save_config(&app, &config_data);
    
    Ok(now)
}

#[tauri::command]
fn start_quota(state: tauri::State<'_, config::ConfigState>) -> Result<(), String> {
    let config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let max_seconds = config_data.daily_quota_minutes * 60;
    if config_data.quota_used_seconds < max_seconds {
        enforcement::QUOTA_ACTIVE.store(true, std::sync::atomic::Ordering::Relaxed);
    } else {
        return Err("Hết thời gian giải trí hôm nay.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn pause_quota(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>) -> Result<(), String> {
    {
        let config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        if let Some(hardcore_until) = config_data.hardcore_until {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
            if now < hardcore_until {
                return Err("Hardcore mode is active.".to_string());
            }
        }
    }
    enforcement::QUOTA_ACTIVE.store(false, std::sync::atomic::Ordering::Relaxed);
    if let Ok(config_data) = state.0.lock() {
        let _ = config::save_config(&app, &config_data);
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct QuotaStatus {
    active: bool,
    used_seconds: u32,
    max_seconds: u32,
}

#[tauri::command]
fn get_quota_status(state: tauri::State<'_, config::ConfigState>) -> Result<QuotaStatus, String> {
    let config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let active = enforcement::QUOTA_ACTIVE.load(std::sync::atomic::Ordering::Relaxed);
    Ok(QuotaStatus {
        active,
        used_seconds: config_data.quota_used_seconds,
        max_seconds: config_data.daily_quota_minutes * 60,
    })
}

#[tauri::command]
fn apply_penalty(
    app: tauri::AppHandle,
    state: tauri::State<'_, config::ConfigState>,
    db_state: tauri::State<'_, db::DbState>,
) -> Result<models::AppConfig, String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    config::apply_penalty_core(&mut config_data);
    config::save_config(&app, &config_data)?;
    if let Ok(mut conn) = db_state.0.lock() {
        let _ = db::apply_penalty(&mut conn);
    }
    let _ = app.emit("penalty-applied", ());
    Ok(config_data.clone())
}

#[tauri::command]
fn enter_focus_room(app: tauri::AppHandle) -> Result<(), String> {
    hooks::start_kiosk_hook();
    hooks::set_taskbar_visible(false);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_fullscreen(true);
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn exit_focus_room(app: tauri::AppHandle) -> Result<(), String> {
    hooks::stop_kiosk_hook();
    hooks::set_taskbar_visible(true);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_fullscreen(false);
        let _ = window.set_always_on_top(false);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    hooks::init_panic_hook();
    let _drop_guard = hooks::DropGuard;

    let args: Vec<String> = std::env::args().collect();

    // R5: CLI --penalty argument for automated testing & emergency reset
    if args.iter().any(|a| a == "--penalty") {
        let config_path = config::get_default_config_path();
        let mut app_config = config::load_config_from_path(&config_path);
        config::apply_penalty_core(&mut app_config);
        if let Err(e) = config::atomic_save_to_path(&config_path, &app_config) {
            eprintln!("Failed to save config on penalty: {}", e);
            std::process::exit(1);
        }

        let db_path = db::get_database_path();
        if let Ok(mut conn) = db::init_db(&db_path, Some(&app_config)) {
            if let Err(e) = db::apply_penalty(&mut conn) {
                eprintln!("Failed to apply SQLite penalty: {}", e);
            }
        }

        println!("Penalty applied successfully: level={}, xp={}, streak={}", app_config.level, app_config.xp, app_config.streak);
        std::process::exit(0);
    }

    if let Some(index) = args.iter().position(|a| a == "--watchdog") {
        if index + 1 < args.len() {
            if let Ok(pid) = args[index + 1].parse::<u32>() {
                enforcement::watchdog_loop(pid);
                return;
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            let config_data = config::load_config(app.handle());
            
            // Sync autostart
            let autostart_manager = app.autolaunch();
            if config_data.start_with_windows {
                let _ = autostart_manager.enable();
            } else {
                let _ = autostart_manager.disable();
            }
            let db_path = db::get_database_path();
            let db_conn = match db::init_db(&db_path, Some(&config_data)) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Database corrupted or locked: {}", e);
                    let backup_path = db_path.with_extension(format!("corrupt.{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()));
                    let _ = std::fs::rename(&db_path, &backup_path);
                    db::init_db(&db_path, Some(&config_data)).expect("Failed to recreate database after corruption")
                }
            };
            let db_state = db::DbState(std::sync::Arc::new(std::sync::Mutex::new(db_conn)));
            app.manage(db_state);
            app.manage(config::ConfigState(std::sync::Mutex::new(config_data)));
            
            // Start enforcement background loop
            enforcement::spawn_enforcement_loop(app.handle().clone());
            
            // Setup Tray Icon
            let quit_i = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Mở ứng dụng", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let tray = tray_builder.on_menu_event(|app, event| match event.id.as_ref() {
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
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        } else {
                            let _ = enforcement::apply_hosts_block(&[]);
                            enforcement::apply_family_dns(false);
                            
                            let pid = enforcement::WATCHDOG_PID.load(std::sync::atomic::Ordering::Relaxed);
                            if pid != 0 {
                                let _ = std::process::Command::new(r"C:\Windows\System32\taskkill.exe")
                                    .args(&["/F", "/PID", &pid.to_string()])
                                    .creation_flags(0x08000000)
                                    .output();
                            }
                            
                            std::process::exit(0);
                        }
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Manage tray to prevent it from being dropped
            app.manage(tray);

            // Explicitly show the window if not started minimized
            let is_minimized = std::env::args().any(|arg| arg == "--minimized");
            if !is_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_app_config,
            config::save_app_config,
            set_password,
            verify_password,
            request_unlock,
            start_quota,
            pause_quota,
            set_hardcore_mode,
            get_quota_status,
            apply_penalty,
            enter_focus_room,
            exit_focus_room,
            commands::get_heatmap_data,
            commands::get_user_profile,
            commands::update_user_profile,
            commands::record_focus_session,
            commands::get_typing_challenge_text,
            commands::save_typing_score,
            commands::get_typing_scores,
            commands::reset_all_data,
            commands::submit_study_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
