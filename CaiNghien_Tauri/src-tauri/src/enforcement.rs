use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::Duration;
use tauri::Manager;
use std::thread;
use tauri::Emitter;
use chrono::{Datelike, Timelike};

use crate::config::ConfigState;
use crate::models::{DayDisciplineRecord, ScheduleConfig};
use active_win_pos_rs::get_active_window;

pub fn is_time_in_schedule(schedule: &ScheduleConfig, now: &chrono::DateTime<chrono::Local>) -> bool {
    if !schedule.enabled {
        return false;
    }

    if schedule.days_of_week.is_empty() {
        return false;
    }

    let weekday_1_to_7 = now.weekday().number_from_monday() as u8;
    let weekday_0_to_6 = now.weekday().num_days_from_sunday() as u8;

    let day_matches = schedule.days_of_week.iter().any(|&d| d == weekday_1_to_7 || d == weekday_0_to_6);
    if !day_matches {
        return false;
    }

    let parse_time = |s: &str| -> Option<u32> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 2 {
            return None;
        }
        let h = parts[0].trim().parse::<u32>().ok()?;
        let m = parts[1].trim().parse::<u32>().ok()?;
        Some(h * 60 + m)
    };

    let start_min = match parse_time(&schedule.start_time) {
        Some(m) => m,
        None => return false,
    };
    let end_min = match parse_time(&schedule.end_time) {
        Some(m) => m,
        None => return false,
    };

    let current_min = now.hour() * 60 + now.minute();

    if start_min <= end_min {
        current_min >= start_min && current_min < end_min
    } else {
        current_min >= start_min || current_min < end_min
    }
}

const MARKER_START: &str = "# CAINGHIEN START";
const MARKER_END: &str = "# CAINGHIEN END";
const CREATE_NO_WINDOW: u32 = 0x08000000;
const DETACHED_PROCESS: u32 = 0x00000008;

use std::os::windows::fs::OpenOptionsExt;

static HOSTS_HANDLE: std::sync::Mutex<Option<std::fs::File>> = std::sync::Mutex::new(None);

pub fn lock_hosts() {
    if let Ok(mut guard) = HOSTS_HANDLE.lock() {
        if guard.is_none() {
            if let Ok(file) = std::fs::OpenOptions::new()
                .read(true)
                .write(false)
                .share_mode(1)
                .open(r"C:\Windows\System32\drivers\etc\hosts")
            {
                *guard = Some(file);
            }
        }
    }
}

pub fn unlock_hosts() {
    if let Ok(mut guard) = HOSTS_HANDLE.lock() {
        *guard = None;
    }
}

pub fn watchdog_loop(main_pid: u32) {
    let mut sys = sysinfo::System::new();
    loop {
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        if sys.process(sysinfo::Pid::from_u32(main_pid)).is_none() {
            let exe_path = std::env::current_exe().unwrap();
            let _ = Command::new(exe_path)
                .creation_flags(DETACHED_PROCESS)
                .spawn();
            std::process::exit(0);
        }
        std::thread::sleep(Duration::from_secs(1));
    }
}

fn get_hosts_path() -> PathBuf {
    PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
}

fn flush_dns() {
    let _ = Command::new("ipconfig")
        .arg("/flushdns")
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

pub fn apply_family_dns(enable: bool) {
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
    unlock_hosts();

    let path = get_hosts_path();
    let content = fs::read_to_string(&path).unwrap_or_default();
    
    let mut in_block = false;
    let mut new_content = String::new();
    for line in content.lines() {
        if line.trim() == MARKER_START {
            in_block = true;
            continue;
        }
        if line.trim() == MARKER_END {
            in_block = false;
            continue;
        }
        if !in_block {
            new_content.push_str(line);
            new_content.push('\n');
        }
    }
    let mut final_content = new_content.trim_end().to_string();

    if !domains.is_empty() {
        let mut block_lines = vec![String::from(MARKER_START)];
        for domain in domains {
            let base_domain = if domain.starts_with("www.") {
                domain.strip_prefix("www.").unwrap_or(domain).to_string()
            } else {
                domain.to_string()
            };
            let www_domain = format!("www.{}", base_domain);

            block_lines.push(format!("127.0.0.1 {}", base_domain));
            block_lines.push(format!("::1 {}", base_domain));
            block_lines.push(format!("127.0.0.1 {}", www_domain));
            block_lines.push(format!("::1 {}", www_domain));
        }
        block_lines.push(String::from(MARKER_END));
        final_content.push_str("\n\n");
        final_content.push_str(&block_lines.join("\n"));
        final_content.push('\n');
    }

    let write_res = fs::write(&path, final_content).map_err(|e| format!("Failed to write hosts file: {}", e));
    flush_dns();

    if !domains.is_empty() {
        lock_hosts();
    }

    write_res
}

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

pub static QUOTA_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static WATCHDOG_PID: AtomicU32 = AtomicU32::new(0);

pub fn spawn_enforcement_loop(app: tauri::AppHandle) {
    thread::spawn(move || {
        let mut last_protection_state = None;
        let mut last_nsfw_state = None;
        let mut last_schedule_state: Option<bool> = None;
        let mut last_domains: Option<Vec<String>> = None;
        let mut sys = sysinfo::System::new();

        loop {
            // Lấy config hiện tại
            let config = {
                let state = app.state::<ConfigState>();
                let config_opt = if let Ok(mut guard) = state.0.lock() {
                    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                    if guard.quota_last_reset_date != today {
                        guard.quota_last_reset_date = today;
                        guard.quota_used_seconds = 0;
                        let _ = crate::config::save_config(&app, &guard);
                        QUOTA_ACTIVE.store(false, Ordering::Relaxed);
                    }
                    Some(guard.clone())
                } else {
                    None
                };
                config_opt
            };

            if let Some(mut config) = config {
                let mut quota_active = QUOTA_ACTIVE.load(Ordering::Relaxed);
                
                // Tick quota if active
                if quota_active {
                    let max_seconds = config.daily_quota_minutes * 60;
                    if config.quota_used_seconds >= max_seconds {
                        quota_active = false;
                        QUOTA_ACTIVE.store(false, Ordering::Relaxed);
                        if let Ok(mut guard) = app.state::<ConfigState>().0.lock() {
                            guard.quota_used_seconds = config.quota_used_seconds; // Already at or past max
                            let _ = crate::config::save_config(&app, &guard);
                        }
                    } else {
                        config.quota_used_seconds += 1;
                        if let Ok(mut guard) = app.state::<ConfigState>().0.lock() {
                            guard.quota_used_seconds = config.quota_used_seconds;
                            // Only save occasionally to avoid heavy disk IO
                            if config.quota_used_seconds % 10 == 0 {
                                let _ = crate::config::save_config(&app, &guard);
                            }
                        }
                    }
                }

                // Check active schedule window
                let now = chrono::Local::now();
                let in_schedule = is_time_in_schedule(&config.schedule, &now);
                if last_schedule_state != Some(in_schedule) {
                    let _ = app.emit("schedule-state-change", in_schedule);
                    last_schedule_state = Some(in_schedule);
                }

                let is_protected = config.protection_enabled;
                let block_nsfw = config.block_nsfw;
                let domains = config.blocked_domains.clone();
                let domains_changed = last_domains.as_ref() != Some(&domains);

                let effective_hosts_protection = (is_protected || in_schedule) && !quota_active;
                let should_apply_dns = ((is_protected && block_nsfw) || in_schedule) && !quota_active;

                if effective_hosts_protection {
                    config.current_day_focus_seconds += 1;
                    if config.current_day_focus_seconds >= 60 {
                        let mins = config.current_day_focus_seconds / 60;
                        config.current_day_focus_seconds %= 60;
                        
                        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                        let today_mins = {
                            let entry = config.daily_stats.entry(today.clone()).or_insert(0);
                            *entry += mins;
                            *entry
                        };
                        
                        let total_mins: u32 = config.daily_stats.values().sum();
                        config.total_focus_hours = total_mins / 60;

                        // R1: Update daily_history for heatmap
                        let hist = config.daily_history.entry(today.clone()).or_insert_with(|| DayDisciplineRecord {
                            date: today.clone(),
                            focus_minutes: 0,
                            violations: 0,
                            is_clean: true,
                        });
                        hist.date = today.clone();
                        hist.focus_minutes = today_mins;
                        hist.is_clean = hist.violations == 0;

                        if let Ok(mut guard) = app.state::<ConfigState>().0.lock() {
                            guard.current_day_focus_seconds = config.current_day_focus_seconds;
                            guard.daily_stats = config.daily_stats.clone();
                            guard.total_focus_hours = config.total_focus_hours;
                            guard.daily_history = config.daily_history.clone();
                            let _ = crate::config::save_config(&app, &guard);
                        }
                    } else if config.current_day_focus_seconds % 10 == 0 {
                        if let Ok(mut guard) = app.state::<ConfigState>().0.lock() {
                            guard.current_day_focus_seconds = config.current_day_focus_seconds;
                        }
                    }
                }

                // Sync watchdog
                if effective_hosts_protection {
                    let mut needs_spawn = false;
                    let pid = WATCHDOG_PID.load(Ordering::Relaxed);
                    if pid != 0 {
                        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
                        if sys.process(sysinfo::Pid::from_u32(pid)).is_none() {
                            needs_spawn = true;
                        }
                    } else {
                        needs_spawn = true;
                    }

                    if needs_spawn {
                        let exe_path = std::env::current_exe().unwrap();
                        if let Ok(child) = Command::new(exe_path)
                            .arg("--watchdog")
                            .arg(std::process::id().to_string())
                            .creation_flags(DETACHED_PROCESS)
                            .spawn() 
                        {
                            WATCHDOG_PID.store(child.id(), Ordering::Relaxed);
                        }
                    }
                } else {
                    let pid = WATCHDOG_PID.load(Ordering::Relaxed);
                    if pid != 0 {
                        let _ = Command::new("taskkill")
                            .args(&["/F", "/PID", &pid.to_string()])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output();
                        WATCHDOG_PID.store(0, Ordering::Relaxed);
                    }
                }

                // Sync hosts file
                if last_protection_state != Some(effective_hosts_protection) || (effective_hosts_protection && domains_changed) {
                    let result = if effective_hosts_protection {
                        apply_hosts_block(&domains)
                    } else {
                        apply_hosts_block(&[])
                    };
                    
                    match result {
                        Ok(_) => {
                            last_protection_state = Some(effective_hosts_protection);
                            if effective_hosts_protection {
                                last_domains = Some(domains.clone());
                            } else {
                                last_domains = Some(vec![]);
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to apply hosts block: {}", e);
                            // force retry on next tick
                            last_protection_state = None;
                            last_domains = None;
                        }
                    }
                }

                // Sync DNS Family Filter
                if last_nsfw_state != Some(should_apply_dns) {
                    apply_family_dns(should_apply_dns);
                    last_nsfw_state = Some(should_apply_dns);
                }

                // Check active window for Process Killer (NSFW & DoH Bypass)
                if is_protected || in_schedule {
                    if let Ok(window) = get_active_window() {
                        let title = window.title.to_lowercase();
                        let app_name = window.app_name.to_lowercase();
                        
                        // Danh sách an toàn: CHỈ giết nếu app_name là trình duyệt web
                        // Đề phòng trường hợp người dùng đặt tên thư mục là "jav" và mở bằng File Explorer (explorer.exe),
                        // nếu giết explorer.exe sẽ làm sập toàn bộ giao diện Windows.
                        let target_browsers = [
                            "chrome", "msedge", "firefox", "brave", "opera", "coccoc"
                        ];

                        if target_browsers.iter().any(|b| app_name.contains(b)) {
                            let mut should_kill = false;

                            if block_nsfw || in_schedule {
                                let nsfw_keywords = [
                                    "pornhub", "xvideos", "sex", "jav", "hentai", "xnxx", "xhamster", "nhentai"
                                ];
                                if nsfw_keywords.iter().any(|k| title.contains(k)) {
                                    should_kill = true;
                                }
                            }

                            if effective_hosts_protection {
                                for domain in &domains {
                                    let base_domain = if domain.starts_with("www.") {
                                        domain.strip_prefix("www.").unwrap_or(domain)
                                    } else {
                                        domain.as_str()
                                    };
                                    let domain_no_tld = base_domain.split('.').next().unwrap_or(base_domain);
                                    
                                    if title.contains(base_domain) || (domain_no_tld.len() > 3 && title.contains(domain_no_tld)) {
                                        should_kill = true;
                                        break;
                                    }
                                }
                            }

                            if should_kill {
                                // Chỉ đóng trình duyệt, không gây hại cho OS
                                let _ = Command::new("taskkill")
                                    .args(&["/F", "/PID", &window.process_id.to_string()])
                                    .creation_flags(CREATE_NO_WINDOW)
                                    .output();
                                
                                // UPDATE VIOLATIONS COUNT & DAILY HISTORY
                                if let Ok(mut guard) = app.state::<ConfigState>().0.lock() {
                                    guard.violations_count += 1;
                                    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                                    let hist = guard.daily_history.entry(today.clone()).or_insert_with(|| DayDisciplineRecord {
                                        date: today,
                                        focus_minutes: 0,
                                        violations: 0,
                                        is_clean: true,
                                    });
                                    hist.violations += 1;
                                    hist.is_clean = false;
                                    let _ = crate::config::save_config(&app, &guard);
                                }
                                
                                // TRIGGER LOCKSCREEN
                                let _ = app.emit("trigger-lockscreen", ());
                            }
                        }
                    }
                }
            }

            thread::sleep(Duration::from_secs(1));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Local};

    #[test]
    fn test_schedule_disabled_returns_false() {
        let schedule = ScheduleConfig {
            enabled: false,
            start_time: "08:00".to_string(),
            end_time: "17:00".to_string(),
            days_of_week: vec![1, 2, 3, 4, 5],
        };
        let now = Local.with_ymd_and_hms(2026, 9, 16, 10, 0, 0).unwrap(); // Wednesday 10:00
        assert!(!is_time_in_schedule(&schedule, &now));
    }

    #[test]
    fn test_schedule_day_matching() {
        let schedule = ScheduleConfig {
            enabled: true,
            start_time: "08:00".to_string(),
            end_time: "17:00".to_string(),
            days_of_week: vec![1, 2, 3], // Mon, Tue, Wed
        };
        let wed = Local.with_ymd_and_hms(2026, 9, 16, 10, 0, 0).unwrap(); // Wednesday
        let thu = Local.with_ymd_and_hms(2026, 9, 17, 10, 0, 0).unwrap(); // Thursday
        assert!(is_time_in_schedule(&schedule, &wed));
        assert!(!is_time_in_schedule(&schedule, &thu));
    }

    #[test]
    fn test_schedule_empty_days_returns_false() {
        let schedule = ScheduleConfig {
            enabled: true,
            start_time: "08:00".to_string(),
            end_time: "17:00".to_string(),
            days_of_week: vec![],
        };
        let wed = Local.with_ymd_and_hms(2026, 9, 16, 10, 0, 0).unwrap();
        assert!(!is_time_in_schedule(&schedule, &wed));
    }

    #[test]
    fn test_schedule_daytime_bounds() {
        let schedule = ScheduleConfig {
            enabled: true,
            start_time: "09:00".to_string(),
            end_time: "17:00".to_string(),
            days_of_week: vec![1, 2, 3, 4, 5, 6, 7], // All days
        };
        let before = Local.with_ymd_and_hms(2026, 9, 16, 8, 59, 0).unwrap();
        let at_start = Local.with_ymd_and_hms(2026, 9, 16, 9, 0, 0).unwrap();
        let during = Local.with_ymd_and_hms(2026, 9, 16, 12, 30, 0).unwrap();
        let at_end = Local.with_ymd_and_hms(2026, 9, 16, 17, 0, 0).unwrap();
        let after = Local.with_ymd_and_hms(2026, 9, 16, 17, 1, 0).unwrap();

        assert!(!is_time_in_schedule(&schedule, &before));
        assert!(is_time_in_schedule(&schedule, &at_start));
        assert!(is_time_in_schedule(&schedule, &during));
        assert!(!is_time_in_schedule(&schedule, &at_end));
        assert!(!is_time_in_schedule(&schedule, &after));
    }

    #[test]
    fn test_schedule_overnight_span() {
        let schedule = ScheduleConfig {
            enabled: true,
            start_time: "22:00".to_string(),
            end_time: "06:00".to_string(),
            days_of_week: vec![1, 2, 3, 4, 5, 6, 7], // All days
        };
        let evening_in = Local.with_ymd_and_hms(2026, 9, 16, 23, 0, 0).unwrap();
        let midnight = Local.with_ymd_and_hms(2026, 9, 16, 0, 0, 0).unwrap();
        let morning_in = Local.with_ymd_and_hms(2026, 9, 16, 5, 59, 0).unwrap();
        let at_end = Local.with_ymd_and_hms(2026, 9, 16, 6, 0, 0).unwrap();
        let afternoon_out = Local.with_ymd_and_hms(2026, 9, 16, 14, 0, 0).unwrap();

        assert!(is_time_in_schedule(&schedule, &evening_in));
        assert!(is_time_in_schedule(&schedule, &midnight));
        assert!(is_time_in_schedule(&schedule, &morning_in));
        assert!(!is_time_in_schedule(&schedule, &at_end));
        assert!(!is_time_in_schedule(&schedule, &afternoon_out));
    }
}
