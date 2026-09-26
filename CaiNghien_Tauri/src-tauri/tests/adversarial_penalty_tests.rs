use cainghien_tauri_lib::config::{
    apply_penalty_core, atomic_save_to_path, get_default_config_path, load_config_from_path,
};
use cainghien_tauri_lib::models::AppConfig;
use std::collections::HashMap;
use std::fs;

#[test]
fn test_adversarial_extreme_penalty_state() {
    let mut config = AppConfig::default();

    // Extreme initial state specified in prompt:
    // Level 100, 50,000 XP, 365 streak, full daily_stats
    config.level = 100;
    config.xp = 50_000;
    config.streak = 365;
    config.total_focus_hours = 1200;
    config.current_day_focus_seconds = 7200;
    config.violations_count = 5;

    let mut daily_stats = HashMap::new();
    daily_stats.insert("2026-09-14".to_string(), 360);
    daily_stats.insert("2026-09-15".to_string(), 480);
    daily_stats.insert("2026-09-16".to_string(), 240);
    config.daily_stats = daily_stats;

    // Apply penalty
    apply_penalty_core(&mut config);

    // Assert exact reset values
    assert_eq!(config.level, 1, "Level must be reset to 1");
    assert_eq!(config.xp, 0, "XP must be reset to 0");
    assert_eq!(config.streak, 0, "Streak must be reset to 0");
    assert_eq!(
        config.total_focus_hours, 0,
        "Total focus hours must be reset to 0"
    );
    assert_eq!(
        config.current_day_focus_seconds, 0,
        "Current day focus seconds must be reset to 0"
    );
    assert_eq!(
        config.violations_count, 6,
        "Violations count must increment from 5 to 6"
    );
    assert!(
        config.daily_stats.is_empty(),
        "daily_stats must be completely emptied"
    );

    // Check daily_history for today
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_rec = config
        .daily_history
        .get(&today)
        .expect("Today record must be present");
    assert_eq!(today_rec.violations, 1, "Today violations must be recorded");
    assert!(!today_rec.is_clean, "Today must be marked as not clean");
}

#[test]
fn test_adversarial_repeated_penalties_monotonic_increment() {
    let mut config = AppConfig::default();
    config.level = 50;
    config.xp = 10_000;
    config.streak = 100;
    config.violations_count = 0;

    for i in 1..=10 {
        apply_penalty_core(&mut config);
        assert_eq!(config.level, 1);
        assert_eq!(config.xp, 0);
        assert_eq!(config.streak, 0);
        assert_eq!(config.violations_count, i);
        assert!(config.daily_stats.is_empty());
    }
}

#[test]
fn test_adversarial_penalty_persistence_roundtrip() {
    let tmp_dir = std::env::temp_dir().join(format!("cainghien_adv_test_{}", std::process::id()));
    let _ = fs::create_dir_all(&tmp_dir);
    let config_path = tmp_dir.join("config.json");

    let mut config = AppConfig::default();
    config.level = 100;
    config.xp = 50_000;
    config.streak = 365;
    config.violations_count = 10;
    config.daily_stats.insert("2026-09-16".to_string(), 600);

    // Save initial extreme config
    atomic_save_to_path(&config_path, &config).expect("Save should succeed");

    // Load, apply penalty, save
    let mut loaded = load_config_from_path(&config_path);
    apply_penalty_core(&mut loaded);
    atomic_save_to_path(&config_path, &loaded).expect("Save penalized should succeed");

    // Reload and assert
    let reloaded = load_config_from_path(&config_path);
    assert_eq!(reloaded.level, 1);
    assert_eq!(reloaded.xp, 0);
    assert_eq!(reloaded.streak, 0);
    assert_eq!(reloaded.violations_count, 11);
    assert!(reloaded.daily_stats.is_empty());

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_adversarial_appdata_default_path_cli_flow() {
    let config_path = get_default_config_path();
    assert!(config_path
        .to_string_lossy()
        .contains("com.cainghien.desktop"));

    // Backup existing config if present
    let backup_path = config_path.with_extension("adv_bak");
    let had_backup = if config_path.exists() {
        fs::copy(&config_path, &backup_path).is_ok()
    } else {
        false
    };

    // Inject extreme config directly into AppData
    let mut extreme_config = AppConfig::default();
    extreme_config.level = 100;
    extreme_config.xp = 50_000;
    extreme_config.streak = 365;
    extreme_config.total_focus_hours = 3000;
    extreme_config.violations_count = 15;
    extreme_config
        .daily_stats
        .insert("2026-09-16".to_string(), 720);

    atomic_save_to_path(&config_path, &extreme_config)
        .expect("Must save extreme config to AppData");

    // Simulate exact CLI flag execution flow from lib.rs:
    let mut app_config = load_config_from_path(&config_path);
    apply_penalty_core(&mut app_config);
    atomic_save_to_path(&config_path, &app_config).expect("Must save updated config to AppData");

    // Re-read directly from disk and verify
    let penalized_config = load_config_from_path(&config_path);
    assert_eq!(penalized_config.level, 1, "Level must be reset to 1");
    assert_eq!(penalized_config.xp, 0, "XP must be reset to 0");
    assert_eq!(penalized_config.streak, 0, "Streak must be reset to 0");
    assert_eq!(
        penalized_config.total_focus_hours, 0,
        "Total focus hours must be reset to 0"
    );
    assert_eq!(
        penalized_config.violations_count, 16,
        "Violations count must increment to 16"
    );
    assert!(
        penalized_config.daily_stats.is_empty(),
        "daily_stats must be empty"
    );

    // Clean up / restore backup
    if had_backup && backup_path.exists() {
        let _ = fs::copy(&backup_path, &config_path);
        let _ = fs::remove_file(&backup_path);
    }
}
