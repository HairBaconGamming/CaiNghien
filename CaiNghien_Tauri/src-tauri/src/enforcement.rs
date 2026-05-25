use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::Duration;
use tauri::Manager;
use tokio::time::sleep;

use crate::config::ConfigState;
use active_win_pos_rs::get_active_window;

const MARKER_START: &str = "# CAINGHIEN START";
const MARKER_END: &str = "# CAINGHIEN END";
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn get_hosts_path() -> PathBuf {
    PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
}

fn flush_dns() {
    let _ = Command::new("ipconfig")
        .arg("/flushdns")
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

fn apply_family_dns(enable: bool) {
    if enable {
        let script = "Get-NetAdapter | Where-Object Status -eq 'Up' | Set-DnsClientServerAddress -ServerAddresses (\"1.1.1.3\",\"1.0.0.3\")";
        let _ = Command::new("powershell")
            .args(&["-NoProfile", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    } else {
        let script = "Get-NetAdapter | Set-DnsClientServerAddress -ResetServerAddresses";
        let _ = Command::new("powershell")
            .args(&["-NoProfile", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

pub fn apply_hosts_block(domains: &[String]) -> Result<(), String> {
    let path = get_hosts_path();
    let mut content = fs::read_to_string(&path).unwrap_or_default();
    
    // Remove old block
    if let (Some(start_idx), Some(end_idx)) = (content.find(MARKER_START), content.find(MARKER_END)) {
        if start_idx < end_idx {
            let end_full = end_idx + MARKER_END.len();
            content.replace_range(start_idx..end_full, "");
        }
    }
    content = content.trim_end().to_string();

    if !domains.is_empty() {
        let mut block_lines = vec![String::from(MARKER_START)];
        for domain in domains {
            block_lines.push(format!("127.0.0.1 {}", domain));
            block_lines.push(format!("::1 {}", domain));
            if !domain.starts_with("www.") {
                block_lines.push(format!("127.0.0.1 www.{}", domain));
                block_lines.push(format!("::1 www.{}", domain));
            }
        }
        block_lines.push(String::from(MARKER_END));
        content.push_str("\n\n");
        content.push_str(&block_lines.join("\n"));
        content.push('\n');
    }

    fs::write(&path, content).map_err(|e| e.to_string())?;
    flush_dns();
    Ok(())
}

pub fn spawn_enforcement_loop(app: tauri::AppHandle) {
    tokio::spawn(async move {
        let mut last_protection_state = None;
        let mut last_nsfw_state = None;

        loop {
            // Lấy config hiện tại
            let config = {
                let state = app.state::<ConfigState>();
                let config_opt = if let Ok(guard) = state.0.lock() {
                    Some(guard.clone())
                } else {
                    None
                };
                config_opt
            };

            if let Some(config) = config {
                let is_protected = config.protection_enabled;
                let block_nsfw = config.block_nsfw;

                // Sync hosts file
                if last_protection_state != Some(is_protected) {
                    if is_protected {
                        let _ = apply_hosts_block(&config.blocked_domains);
                    } else {
                        let _ = apply_hosts_block(&[]);
                    }
                    last_protection_state = Some(is_protected);
                }

                // Sync DNS Family Filter
                let should_apply_dns = is_protected && block_nsfw;
                if last_nsfw_state != Some(should_apply_dns) {
                    apply_family_dns(should_apply_dns);
                    last_nsfw_state = Some(should_apply_dns);
                }

                // Check active window for Process Killer (NSFW)
                if is_protected && block_nsfw {
                    if let Ok(window) = get_active_window() {
                        let title = window.title.to_lowercase();
                        let app_name = window.app_name.to_lowercase();
                        
                        let nsfw_keywords = [
                            "pornhub", "xvideos", "sex", "jav", "hentai", "xnxx", "xhamster", "nhentai"
                        ];
                        
                        // Danh sách an toàn: CHỈ giết nếu app_name là trình duyệt web
                        // Đề phòng trường hợp người dùng đặt tên thư mục là "jav" và mở bằng File Explorer (explorer.exe),
                        // nếu giết explorer.exe sẽ làm sập toàn bộ giao diện Windows.
                        let target_browsers = [
                            "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "coccoc.exe"
                        ];

                        if nsfw_keywords.iter().any(|k| title.contains(k)) {
                            if target_browsers.iter().any(|b| app_name.ends_with(b)) {
                                // Chỉ đóng trình duyệt, không gây hại cho OS
                                let _ = Command::new("taskkill")
                                    .args(&["/F", "/IM", &app_name])
                                    .creation_flags(CREATE_NO_WINDOW)
                                    .output();
                            }
                        }
                    }
                }
            }

            sleep(Duration::from_secs(3)).await;
        }
    });
}
