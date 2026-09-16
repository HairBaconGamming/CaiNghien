pub mod models;
pub mod config;
pub mod enforcement;
<<<<<<< HEAD
pub mod hooks;

use tauri::{Emitter, Manager, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_autostart::MacosLauncher;
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};
use std::os::windows::process::CommandExt;

#[tauri::command]
fn set_password(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>, password: Option<String>) -> Result<(), String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    if let Some(hardcore_until) = config_data.hardcore_until {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        if now < hardcore_until {
            return Err("Hardcore mode is active.".to_string());
        }
    }
=======

use tauri::{Manager, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_autostart::MacosLauncher;
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn set_password(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>, password: Option<String>) -> Result<(), String> {
    let mut config_data = state.0.lock().unwrap().clone();
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
    
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
<<<<<<< HEAD
    Ok(())
}

#[tauri::command]
fn set_hardcore_mode(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>, hours: u32) -> Result<(), String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let until = now + (hours as i64) * 3600;
    
    if let Some(current) = config_data.hardcore_until {
        if now < current && until < current {
            return Err("Cannot decrease hardcore time!".to_string());
        }
    }
    
    config_data.hardcore_until = Some(until);
    let _ = config::save_config(&app, &config_data);
=======
    *state.0.lock().unwrap() = config_data;
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
    Ok(())
}

#[tauri::command]
fn verify_password(state: tauri::State<'_, config::ConfigState>, password: String) -> Result<bool, String> {
<<<<<<< HEAD
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    if let Some(hardcore_until) = config_data.hardcore_until {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        if now < hardcore_until {
            return Err("Hardcore mode is active.".to_string());
        }
    }

=======
    let config_data = state.0.lock().unwrap();
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
    if let Some(ref hash) = config_data.password_hash {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let result = hex::encode(hasher.finalize());
<<<<<<< HEAD
        let ok = &result == hash;
        if ok {
            config_data.temporary_unlock_until = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() + 60);
        }
        Ok(ok)
=======
        Ok(&result == hash)
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
    } else {
        Ok(true) // No password set
    }
}

#[tauri::command]
fn request_unlock(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>) -> Result<u64, String> {
<<<<<<< HEAD
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    if let Some(hardcore_until) = config_data.hardcore_until {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        if now < hardcore_until {
            return Err("Hardcore mode is active.".to_string());
        }
    }

=======
    let mut config_data = state.0.lock().unwrap().clone();
    
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    config_data.unlock_requested_at = Some(now);
    
    let _ = config::save_config(&app, &config_data);
<<<<<<< HEAD
=======
    *state.0.lock().unwrap() = config_data.clone();
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
    
    Ok(now)
}

<<<<<<< HEAD
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
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
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
fn apply_penalty(app: tauri::AppHandle, state: tauri::State<'_, config::ConfigState>) -> Result<models::AppConfig, String> {
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    config::apply_penalty_core(&mut config_data);
    config::save_config(&app, &config_data)?;
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
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
=======
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_opener::init())
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
        .setup(|app| {
            let config_data = config::load_config(app.handle());
            app.manage(config::ConfigState(std::sync::Mutex::new(config_data)));
            
            // Start enforcement background loop
            enforcement::spawn_enforcement_loop(app.handle().clone());
            
            // Setup Tray Icon
            let quit_i = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Mở ứng dụng", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

<<<<<<< HEAD
            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let tray = tray_builder.on_menu_event(|app, event| match event.id.as_ref() {
=======
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
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
<<<<<<< HEAD
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        } else {
                            let _ = enforcement::apply_hosts_block(&[]);
                            enforcement::apply_family_dns(false);
                            
                            let pid = enforcement::WATCHDOG_PID.load(std::sync::atomic::Ordering::Relaxed);
                            if pid != 0 {
                                let _ = std::process::Command::new("taskkill")
                                    .args(&["/F", "/PID", &pid.to_string()])
                                    .creation_flags(0x08000000)
                                    .output();
                            }
                            
=======
                                let _ = window.set_focus();
                            }
                        } else {
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
                            std::process::exit(0);
                        }
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
<<<<<<< HEAD
                            let _ = window.unminimize();
=======
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
<<<<<<< HEAD
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

=======
                .build(app)?;
            
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_app_config,
            config::save_app_config,
            set_password,
            verify_password,
<<<<<<< HEAD
            request_unlock,
            start_quota,
            pause_quota,
            set_hardcore_mode,
            get_quota_status,
            hooks::lock_hardware_input,
            hooks::unlock_hardware_input,
            apply_penalty,
            enter_focus_room,
            exit_focus_room
=======
            request_unlock
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
