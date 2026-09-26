/// CaiNghien Control & Rescue Tool — Rust Backend Module
///
/// Provides system diagnostics, emergency recovery, hosts block toggle,
/// password/hardcore reset, and config backup/restore commands.

use regex::Regex;
use serde::Serialize;
use std::fs;
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::State;

use crate::config::ConfigState;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const HOSTS_PATH: &str = r"C:\Windows\System32\drivers\etc\hosts";
const MARKER_START: &str = "# CAINGHIEN START";
const MARKER_END: &str = "# CAINGHIEN END";

// ─── Response Types ──────────────────────────────────────────────

#[derive(Serialize)]
pub struct SystemDiagnostics {
    pub app_running: bool,
    pub app_pid: Option<u32>,
    pub watchdog_running: bool,
    pub watchdog_pid: Option<u32>,
    pub hosts_blocked: bool,
    pub hosts_block_count: u32,
    pub dns_servers: Vec<String>,
    pub protection_enabled: bool,
    pub hardcore_active: bool,
    pub hardcore_remaining: Option<String>,
    pub config_path: String,
    pub has_password: bool,
}

#[derive(Serialize)]
pub struct EmergencyResult {
    pub processes_killed: u32,
    pub hosts_cleaned: bool,
    pub dns_reset: bool,
    pub protection_disabled: bool,
    pub message: String,
}

#[derive(Serialize)]
pub struct HostsToggleResult {
    pub is_blocked: bool,
    pub domains_count: u32,
    pub message: String,
}

// ─── Helpers ─────────────────────────────────────────────────────

fn get_hosts_content() -> Result<String, String> {
    fs::read_to_string(HOSTS_PATH).map_err(|e| format!("Không thể đọc hosts: {}", e))
}

fn hosts_has_block(content: &str) -> bool {
    content.contains(MARKER_START) && content.contains(MARKER_END)
}

fn count_blocked_lines(content: &str) -> u32 {
    let mut in_block = false;
    let mut count = 0u32;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == MARKER_START {
            in_block = true;
            continue;
        }
        if trimmed == MARKER_END {
            in_block = false;
            continue;
        }
        if in_block && !trimmed.is_empty() && !trimmed.starts_with('#') {
            count += 1;
        }
    }
    count
}

fn remove_hosts_block(content: &str) -> String {
    let re = Regex::new(r"(?m)\r?\n?# CAINGHIEN START\r?\n[\s\S]*?# CAINGHIEN END\r?\n?")
        .unwrap();
    re.replace_all(content, "").to_string()
}

fn flush_dns() {
    let _ = Command::new("ipconfig")
        .args(["/flushdns"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

fn reset_dns_to_dhcp() {
    for iface in &["Ethernet", "Wi-Fi", "Local Area Connection"] {
        let _ = Command::new("netsh")
            .args(["interface", "ip", "set", "dns", iface, "dhcp"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    flush_dns();
}

fn parse_dns_servers() -> Vec<String> {
    let output = Command::new("netsh")
        .args(["interface", "ip", "show", "dns"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let mut servers = Vec::new();
    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            let trimmed = line.trim();
            // Lines like "1.1.1.3" or "DNS Servers: 1.1.1.3" or containing IPs
            if let Some(ip) = extract_ip(trimmed) {
                if !servers.contains(&ip) {
                    servers.push(ip);
                }
            }
        }
    }
    servers
}

fn extract_ip(s: &str) -> Option<String> {
    let re = Regex::new(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})").unwrap();
    re.captures(s).map(|c| c[1].to_string())
}

fn format_duration_remaining(seconds: i64) -> String {
    if seconds <= 0 {
        return "Hết hạn".to_string();
    }
    let hours = seconds / 3600;
    let mins = (seconds % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, mins)
    } else {
        format!("{}m", mins)
    }
}

// ─── Commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_system_diagnostics(
    state: State<'_, ConfigState>,
) -> Result<SystemDiagnostics, String> {
    // Process detection using sysinfo
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let current_pid = std::process::id();
    let mut app_running = false;
    let mut app_pid: Option<u32> = None;
    let mut watchdog_running = false;
    let mut watchdog_pid: Option<u32> = None;

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("cainghien_tauri") {
            let pid_u32 = pid.as_u32();
            app_running = true;
            if app_pid.is_none() || pid_u32 == current_pid {
                app_pid = Some(pid_u32);
            }

            // Check if this is a watchdog process
            let cmd_args: Vec<String> = process.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect();
            if cmd_args.iter().any(|a| a.contains("--watchdog")) {
                watchdog_running = true;
                watchdog_pid = Some(pid_u32);
            }
        }
    }

    // Hosts file analysis
    let hosts_content = get_hosts_content().unwrap_or_default();
    let hosts_blocked = hosts_has_block(&hosts_content);
    let hosts_block_count = if hosts_blocked {
        count_blocked_lines(&hosts_content)
    } else {
        0
    };

    // DNS servers
    let dns_servers = parse_dns_servers();

    // Config state
    let config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let protection_enabled = config.protection_enabled;
    let has_password = config.password_hash.is_some();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let hardcore_active = config
        .hardcore_until
        .map(|until| now < until)
        .unwrap_or(false);

    let hardcore_remaining = if hardcore_active {
        config
            .hardcore_until
            .map(|until| format_duration_remaining(until - now))
    } else {
        None
    };

    let config_path = crate::config::get_default_config_path()
        .to_string_lossy()
        .to_string();

    Ok(SystemDiagnostics {
        app_running,
        app_pid,
        watchdog_running,
        watchdog_pid,
        hosts_blocked,
        hosts_block_count,
        dns_servers,
        protection_enabled,
        hardcore_active,
        hardcore_remaining,
        config_path,
        has_password,
    })
}

#[tauri::command]
pub fn emergency_kill_and_restore(
    app: tauri::AppHandle,
    state: State<'_, ConfigState>,
) -> Result<EmergencyResult, String> {
    let current_pid = std::process::id();
    let mut processes_killed = 0u32;

    // Kill all cainghien_tauri processes except current
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("cainghien_tauri") && pid.as_u32() != current_pid {
            process.kill();
            processes_killed += 1;
        }
    }

    // Clean hosts file
    let hosts_cleaned = if let Ok(content) = get_hosts_content() {
        if hosts_has_block(&content) {
            let cleaned = remove_hosts_block(&content);
            fs::write(HOSTS_PATH, cleaned.trim_end().to_string() + "\n").is_ok()
        } else {
            true
        }
    } else {
        false
    };

    // Reset DNS
    reset_dns_to_dhcp();
    let dns_reset = true;

    // Disable protection in config
    let protection_disabled = {
        let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        config.protection_enabled = false;
        crate::config::save_config(&app, &config).is_ok()
    };

    let msg = format!(
        "Đã khôi phục: {} tiến trình đã dừng, hosts {}, DNS reset, bảo vệ {}.",
        processes_killed,
        if hosts_cleaned { "đã dọn" } else { "lỗi dọn" },
        if protection_disabled {
            "đã tắt"
        } else {
            "lỗi tắt"
        }
    );

    Ok(EmergencyResult {
        processes_killed,
        hosts_cleaned,
        dns_reset,
        protection_disabled,
        message: msg,
    })
}

#[tauri::command]
pub fn toggle_hosts_block(
    state: State<'_, ConfigState>,
) -> Result<HostsToggleResult, String> {
    let content = get_hosts_content()?;

    if hosts_has_block(&content) {
        // Remove block
        let cleaned = remove_hosts_block(&content);
        fs::write(HOSTS_PATH, cleaned.trim_end().to_string() + "\n")
            .map_err(|e| format!("Không thể ghi hosts: {}", e))?;
        flush_dns();

        Ok(HostsToggleResult {
            is_blocked: false,
            domains_count: 0,
            message: "Đã gỡ chặn tất cả tên miền khỏi hosts.".to_string(),
        })
    } else {
        // Apply block from config
        let config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        let domains = &config.blocked_domains;

        if domains.is_empty() {
            return Ok(HostsToggleResult {
                is_blocked: false,
                domains_count: 0,
                message: "Không có tên miền nào để chặn. Hãy thêm tên miền trong Cài đặt chung."
                    .to_string(),
            });
        }

        let mut block_lines = vec![String::new(), MARKER_START.to_string()];
        for domain in domains {
            let d = domain.trim();
            if !d.is_empty() {
                block_lines.push(format!("0.0.0.0 {}", d));
                block_lines.push(format!("0.0.0.0 www.{}", d));
            }
        }
        block_lines.push(MARKER_END.to_string());

        let new_content = content.trim_end().to_string() + &block_lines.join("\n") + "\n";
        fs::write(HOSTS_PATH, &new_content)
            .map_err(|e| format!("Không thể ghi hosts: {}", e))?;
        flush_dns();

        let count = domains.iter().filter(|d| !d.trim().is_empty()).count() as u32;
        Ok(HostsToggleResult {
            is_blocked: true,
            domains_count: count,
            message: format!("Đã chặn {} tên miền trong hosts.", count),
        })
    }
}

#[tauri::command]
pub fn reset_password_and_hardcore(
    app: tauri::AppHandle,
    state: State<'_, ConfigState>,
) -> Result<String, String> {
    let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;

    config.password_hash = None;
    config.hardcore_until = None;
    config.protection_enabled = false;

    crate::config::save_config(&app, &config)?;

    Ok("Đã xóa mật khẩu, tắt Hardcore và tắt bảo vệ thành công.".to_string())
}

#[tauri::command]
pub fn backup_config() -> Result<String, String> {
    let config_path = crate::config::get_default_config_path();

    if !config_path.exists() {
        return Err("Không tìm thấy file cấu hình để sao lưu.".to_string());
    }

    let backup_path = config_path.with_extension("backup.json");
    fs::copy(&config_path, &backup_path).map_err(|e| format!("Lỗi sao lưu: {}", e))?;

    Ok(format!(
        "Đã sao lưu cấu hình tại: {}",
        backup_path.to_string_lossy()
    ))
}

#[tauri::command]
pub fn restore_config(
    app: tauri::AppHandle,
    state: State<'_, ConfigState>,
) -> Result<String, String> {
    let config_path = crate::config::get_default_config_path();
    let backup_path = config_path.with_extension("backup.json");

    if !backup_path.exists() {
        return Err("Không tìm thấy file sao lưu. Hãy sao lưu trước.".to_string());
    }

    let restored = crate::config::load_config_from_path(&backup_path);

    let mut config = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    *config = restored;
    crate::config::save_config(&app, &config)?;

    Ok("Đã khôi phục cấu hình từ bản sao lưu thành công.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hosts_block_detection() {
        let content = "127.0.0.1 localhost\n# CAINGHIEN START\n0.0.0.0 facebook.com\n# CAINGHIEN END\n";
        assert!(hosts_has_block(content));
        assert_eq!(count_blocked_lines(content), 1);
    }

    #[test]
    fn test_hosts_no_block() {
        let content = "127.0.0.1 localhost\n::1 localhost\n";
        assert!(!hosts_has_block(content));
        assert_eq!(count_blocked_lines(content), 0);
    }

    #[test]
    fn test_remove_hosts_block() {
        let content = "127.0.0.1 localhost\n\n# CAINGHIEN START\n0.0.0.0 facebook.com\n0.0.0.0 www.facebook.com\n# CAINGHIEN END\n";
        let cleaned = remove_hosts_block(content);
        assert!(!cleaned.contains("CAINGHIEN"));
        assert!(!cleaned.contains("facebook.com"));
        assert!(cleaned.contains("127.0.0.1 localhost"));
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration_remaining(7200), "2h 0m");
        assert_eq!(format_duration_remaining(5400), "1h 30m");
        assert_eq!(format_duration_remaining(1800), "30m");
        assert_eq!(format_duration_remaining(0), "Hết hạn");
        assert_eq!(format_duration_remaining(-100), "Hết hạn");
    }

    #[test]
    fn test_extract_ip() {
        assert_eq!(extract_ip("DNS Server: 1.1.1.3"), Some("1.1.1.3".to_string()));
        assert_eq!(extract_ip("  8.8.8.8"), Some("8.8.8.8".to_string()));
        assert_eq!(extract_ip("no ip here"), None);
    }
}
