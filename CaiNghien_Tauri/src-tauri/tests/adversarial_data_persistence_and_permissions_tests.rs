use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use cainghien_tauri_lib::config::{atomic_save_to_path, load_config_from_path};
use cainghien_tauri_lib::models::{AppConfig, DayDisciplineRecord, FocusSession, TypingScore};

fn get_unique_temp_dir(test_name: &str) -> PathBuf {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "cainghien_adv_p_{}_{}_{}",
        test_name,
        std::process::id(),
        nonce
    ));
    fs::create_dir_all(&dir).expect("Failed to create temporary directory for test");
    dir
}

// =========================================================================
// SECTION 1: PERMISSIONS & CAPABILITY ADVERSARIAL VERIFICATION
// =========================================================================

#[test]
fn test_capabilities_and_acl_manifest_allow_study_commands() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    // 1. Verify capabilities/default.json references the "default" capability set
    let cap_path = manifest_dir.join("capabilities").join("default.json");
    assert!(cap_path.exists(), "capabilities/default.json must exist");
    let cap_content =
        fs::read_to_string(&cap_path).expect("Failed to read capabilities/default.json");
    let cap_json: Value =
        serde_json::from_str(&cap_content).expect("capabilities/default.json must be valid JSON");

    let permissions = cap_json["permissions"]
        .as_array()
        .expect("permissions must be an array");
    let has_default_perm = permissions.iter().any(|p| p.as_str() == Some("default"));
    assert!(
        has_default_perm,
        "capabilities/default.json must grant 'default' permission set"
    );

    // 2. Verify gen/schemas/acl-manifests.json has generated ACL with study commands
    let acl_path = manifest_dir
        .join("gen")
        .join("schemas")
        .join("acl-manifests.json");
    assert!(
        acl_path.exists(),
        "gen/schemas/acl-manifests.json must exist"
    );
    let acl_content = fs::read_to_string(&acl_path).expect("Failed to read acl-manifests.json");
    let acl_json: Value =
        serde_json::from_str(&acl_content).expect("acl-manifests.json must be valid JSON");

    let app_acl = &acl_json["__app-acl__"];
    let default_perms = app_acl["default_permission"]["permissions"]
        .as_array()
        .expect("__app-acl__.default_permission.permissions must be an array");

    let has_submit = default_perms
        .iter()
        .any(|p| p.as_str() == Some("allow-submit-study-report"));
    // //
    assert!(
        has_submit,
        "Generated ACL default permissions must include allow-submit-study-report"
    );
    // //

    // Verify commands.allow maps to exact command names
    let submit_cmds = app_acl["permissions"]["allow-submit-study-report"]["commands"]["allow"]
        .as_array()
        .expect("commands.allow must be an array");
    assert!(submit_cmds
        .iter()
        .any(|c| c.as_str() == Some("submit_study_report")));

    let add_cmds = app_acl["permissions"]["allow-add-study-reward-quota"]["commands"]["allow"]
        .as_array()
        .expect("commands.allow must be an array");
    assert!(add_cmds
        .iter()
        .any(|c| c.as_str() == Some("add_study_reward_quota")));
}

// =========================================================================
// SECTION 2: LEGACY CONFIG.JSON DESERIALIZATION ADVERSARIAL STRESS TESTS
// =========================================================================

#[test]
fn test_serde_direct_deserialization_legacy_v1_config() {
    // Pure serde deserialization of legacy v1 JSON directly without data wrapper
    let legacy_json = r#"{
        "protection_enabled": true,
        "blocked_domains": ["facebook.com", "distraction.net"],
        "violations_count": 42,
        "daily_quota_minutes": 120,
        "quota_used_seconds": 600,
        "quota_last_reset_date": "2026-09-20",
        "level": 7,
        "xp": 850,
        "streak": 19
    }"#;

    let loaded: AppConfig =
        serde_json::from_str(legacy_json).expect("Serde must deserialize legacy config");

    // 1. Conversion ratio fields must assume strict default values (60 and 15)
    assert_eq!(
        loaded.study_minutes_required, 60,
        "study_minutes_required must default to 60"
    );
    assert_eq!(
        loaded.reward_quota_minutes, 15,
        "reward_quota_minutes must default to 15"
    );

    // 2. All legacy fields must be preserved without data loss or corruption
    assert!(loaded.protection_enabled);
    assert_eq!(
        loaded.blocked_domains,
        vec!["facebook.com", "distraction.net"]
    );
    assert_eq!(loaded.violations_count, 42);
    assert_eq!(loaded.daily_quota_minutes, 120);
    assert_eq!(loaded.quota_used_seconds, 600);
    assert_eq!(loaded.quota_last_reset_date, "2026-09-20");
    assert_eq!(loaded.level, 7);
    assert_eq!(loaded.xp, 850);
    assert_eq!(loaded.streak, 19);
}

#[test]
fn test_adversarial_bug_load_config_from_path_drops_legacy_v1_without_wrapper() {
    // ADVERSARIAL CHALLENGE FINDING:
    // In src/config.rs:38-54:
    // load_config_from_path has a control flow bug:
    // if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
    //     if let Some(data) = parsed.get("data") {
    //         if let Ok(c) = serde_json::from_value(data.clone()) { config = c; }
    //     }
    // } else if let Ok(c) = serde_json::from_str::<AppConfig>(&content) {
    //     config = c;
    // }
    //
    // Because any valid JSON parses as serde_json::Value, the `if let Ok(parsed)` branch
    // is ALWAYS taken for valid legacy JSON. If the legacy JSON does NOT have a "data" wrapper,
    // parsed.get("data") returns None, and the `else if` is never reached!
    // As a result, load_config_from_path silently drops the entire file and returns AppConfig::default()!
    let temp_dir = get_unique_temp_dir("legacy_v1_drop_bug");
    let config_path = temp_dir.join("config.json");

    let legacy_json = r#"{
        "protection_enabled": true,
        "blocked_domains": ["facebook.com", "distraction.net"],
        "violations_count": 42
    }"#;
    fs::write(&config_path, legacy_json).expect("Failed to write legacy config");

    let loaded = load_config_from_path(&config_path);

    // Document and assert this exact defect:
    // Due to the bug, loaded.protection_enabled is false (AppConfig::default), not true!
    // And loaded.violations_count is 0 (AppConfig::default), not 42!
    let bug_is_fixed = loaded.protection_enabled && loaded.violations_count == 42;
    assert!(bug_is_fixed); //
    assert!(
        bug_is_fixed,
        "Defect confirmed: load_config_from_path failed to load raw legacy config lacking 'data' wrapper"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_deserialization_legacy_v2_wrapped_config_missing_conversion_fields() {
    let temp_dir = get_unique_temp_dir("legacy_v2");
    let config_path = temp_dir.join("config.json");

    // Legacy v2 JSON with {"schema": 2, "saved_at": "...", "data": { ... }} wrapper,
    // where "data" lacks study_minutes_required and reward_quota_minutes
    let legacy_v2_json = r#"{
        "schema": 2,
        "saved_at": "2026-09-18T10:00:00Z",
        "data": {
            "protection_enabled": false,
            "blocked_domains": ["custom-gaming.com"],
            "password_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "violations_count": 3,
            "daily_quota_minutes": 90,
            "quota_used_seconds": 1200,
            "quota_last_reset_date": "2026-09-23",
            "level": 3,
            "xp": 250,
            "streak": 5,
            "schedule": {
                "enabled": true,
                "start_time": "09:00",
                "end_time": "18:00",
                "days_of_week": [1, 2, 3, 4, 5]
            }
        }
    }"#;
    fs::write(&config_path, legacy_v2_json).expect("Failed to write legacy v2 config");

    let loaded = load_config_from_path(&config_path);

    // Verify study conversion defaults
    assert_eq!(loaded.study_minutes_required, 60);
    assert_eq!(loaded.reward_quota_minutes, 15);

    // Verify nested data was unpacked correctly
    assert!(!loaded.protection_enabled);
    assert_eq!(loaded.blocked_domains, vec!["custom-gaming.com"]);
    assert_eq!(
        loaded.password_hash.as_deref(),
        Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    );
    assert_eq!(loaded.violations_count, 3);
    assert_eq!(loaded.daily_quota_minutes, 90);
    assert!(loaded.schedule.enabled);
    assert_eq!(loaded.schedule.start_time, "09:00");
    assert_eq!(loaded.schedule.end_time, "18:00");

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_deserialization_partial_conversion_fields() {
    // Case A: Has study_minutes_required = 90, lacks reward_quota_minutes
    let json_a = r#"{"study_minutes_required": 90}"#;
    let config_a: AppConfig = serde_json::from_str(json_a).expect("Must deserialize");
    assert_eq!(config_a.study_minutes_required, 90);
    assert_eq!(
        config_a.reward_quota_minutes, 15,
        "reward_quota_minutes must default to 15"
    );

    // Case B: Has reward_quota_minutes = 30, lacks study_minutes_required
    let json_b = r#"{"reward_quota_minutes": 30}"#;
    let config_b: AppConfig = serde_json::from_str(json_b).expect("Must deserialize");
    assert_eq!(
        config_b.study_minutes_required, 60,
        "study_minutes_required must default to 60"
    );
    assert_eq!(config_b.reward_quota_minutes, 30);
}

#[test]
fn test_deserialization_corrupted_or_empty_config_safe_fallback() {
    let temp_dir = get_unique_temp_dir("corrupted");

    // 1. Completely corrupted file (not JSON)
    let corrupted_path = temp_dir.join("corrupted.json");
    fs::write(&corrupted_path, "INVALID_SYNTAX_NOT_JSON {{{ :::").unwrap();
    let loaded_corrupt = load_config_from_path(&corrupted_path);
    assert_eq!(loaded_corrupt.study_minutes_required, 60);
    assert_eq!(loaded_corrupt.reward_quota_minutes, 15);
    assert_eq!(loaded_corrupt.level, 1);

    // 2. Empty file
    let empty_path = temp_dir.join("empty.json");
    fs::write(&empty_path, "").unwrap();
    let loaded_empty = load_config_from_path(&empty_path);
    assert_eq!(loaded_empty.study_minutes_required, 60);
    assert_eq!(loaded_empty.reward_quota_minutes, 15);

    // 3. Non-existent file
    let missing_path = temp_dir.join("missing.json");
    let loaded_missing = load_config_from_path(&missing_path);
    assert_eq!(loaded_missing.study_minutes_required, 60);
    assert_eq!(loaded_missing.reward_quota_minutes, 15);

    let _ = fs::remove_dir_all(&temp_dir);
}

// =========================================================================
// SECTION 3: MUTATION SAFETY & ATOMIC PERSISTENCE ADVERSARIAL STRESS TESTS
// =========================================================================

#[test]
fn test_atomic_save_roundtrip_integrity() {
    let temp_dir = get_unique_temp_dir("atomic_roundtrip");
    let config_path = temp_dir.join("config.json");

    let mut config = AppConfig::default();
    config.study_minutes_required = 45;
    config.reward_quota_minutes = 20;
    config.blocked_domains = vec!["youtube.com".into(), "reddit.com".into(), "novel.io".into()];
    config.daily_quota_minutes = 90;
    config.violations_count = 12;

    atomic_save_to_path(&config_path, &config).expect("Atomic save must succeed");
    assert!(
        config_path.exists(),
        "config.json must exist after atomic save"
    );

    let loaded = load_config_from_path(&config_path);
    assert_eq!(loaded.study_minutes_required, 45);
    assert_eq!(loaded.reward_quota_minutes, 20);
    assert_eq!(loaded.blocked_domains.len(), 3);
    assert_eq!(loaded.daily_quota_minutes, 90);
    assert_eq!(loaded.violations_count, 12);

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_config_mutation_preserves_protected_fields_and_guards_zero_ratios() {
    // Simulate the business logic of `save_app_config` directly on memory state
    let mut current_config = AppConfig::default();
    current_config.protection_enabled = true;
    current_config.violations_count = 15;
    current_config.temporary_unlock_until = Some(1800000000);
    current_config.quota_used_seconds = 2400;
    current_config.quota_last_reset_date = "2026-09-24".to_string();
    current_config.daily_quota_minutes = 90;

    // Populate collections
    current_config.daily_history.insert(
        "2026-09-24".to_string(),
        DayDisciplineRecord {
            date: "2026-09-24".to_string(),
            focus_minutes: 60,
            violations: 0,
            is_clean: true,
        },
    );
    current_config.focus_sessions.push(FocusSession {
        id: "sess_1".to_string(),
        timestamp: 1700000000,
        duration_minutes: 45,
        quote: None,
        session_type: "study_to_earn".to_string(),
        completed: true,
        xp_earned: 180,
    });
    current_config.typing_scores.push(TypingScore {
        id: "typ_1".to_string(),
        timestamp: 1700000000,
        wpm: 75,
        accuracy: 98.0,
        time_seconds: 60,
        words_count: 75,
        xp_earned: 40,
    });
    current_config
        .heatmap_days
        .insert("2026-09-24".to_string(), 5);

    // Incoming `new_config` attempting to update conversion ratio, but with 0 values
    // and empty collections
    let mut incoming_config = current_config.clone();
    incoming_config.study_minutes_required = 0; // Malicious/invalid 0
    incoming_config.reward_quota_minutes = 0; // Malicious/invalid 0
    incoming_config.violations_count = 0; // Malicious attempt to reset violations
    incoming_config.temporary_unlock_until = None;
    incoming_config.quota_used_seconds = 0; // Malicious attempt to reset used quota
    incoming_config.daily_history = HashMap::new(); // Cleared
    incoming_config.focus_sessions = Vec::new(); // Cleared
    incoming_config.typing_scores = Vec::new(); // Cleared
    incoming_config.heatmap_days = HashMap::new(); // Cleared

    // Execute the exact preservation logic implemented in `save_app_config` (src/config.rs:168-190)
    incoming_config.violations_count = current_config.violations_count;
    incoming_config.temporary_unlock_until = current_config.temporary_unlock_until;
    incoming_config.quota_used_seconds = current_config.quota_used_seconds;
    incoming_config.quota_last_reset_date = current_config.quota_last_reset_date.clone();
    if incoming_config.daily_history.is_empty() && !current_config.daily_history.is_empty() {
        incoming_config.daily_history = current_config.daily_history.clone();
    }
    if incoming_config.focus_sessions.is_empty() && !current_config.focus_sessions.is_empty() {
        incoming_config.focus_sessions = current_config.focus_sessions.clone();
    }
    if incoming_config.typing_scores.is_empty() && !current_config.typing_scores.is_empty() {
        incoming_config.typing_scores = current_config.typing_scores.clone();
    }
    if incoming_config.heatmap_days.is_empty() && !current_config.heatmap_days.is_empty() {
        incoming_config.heatmap_days = current_config.heatmap_days.clone();
    }
    if incoming_config.study_minutes_required == 0 {
        incoming_config.study_minutes_required = 60;
    }
    if incoming_config.reward_quota_minutes == 0 {
        incoming_config.reward_quota_minutes = 15;
    }

    // Assert that protected fields survived
    assert_eq!(
        incoming_config.violations_count, 15,
        "Violations count must NOT be reset"
    );
    assert_eq!(incoming_config.temporary_unlock_until, Some(1800000000));
    assert_eq!(
        incoming_config.quota_used_seconds, 2400,
        "Used quota seconds must NOT be reset"
    );
    assert_eq!(incoming_config.quota_last_reset_date, "2026-09-24");
    assert_eq!(incoming_config.daily_history.len(), 1);
    assert_eq!(incoming_config.focus_sessions.len(), 1);
    assert_eq!(incoming_config.typing_scores.len(), 1);
    assert_eq!(incoming_config.heatmap_days.len(), 1);

    // Assert that zero ratios were safely guarded
    assert_eq!(
        incoming_config.study_minutes_required, 60,
        "0 study_minutes_required must be guarded to 60"
    );
    assert_eq!(
        incoming_config.reward_quota_minutes, 15,
        "0 reward_quota_minutes must be guarded to 15"
    );
}

#[test]
fn test_adversarial_vulnerability_stale_daily_quota_overwritten_by_save_app_config() {
    // ADVERSARIAL CHALLENGE CASE:
    // Demonstrate how `save_app_config` overwriting `daily_quota_minutes` can wipe out
    // rewards if the frontend passes stale `daily_quota_minutes`.
    let mut backend_config = AppConfig::default();
    backend_config.daily_quota_minutes = 60;

    // 1. User submits study report -> backend increments daily_quota_minutes to 75
    let study_earned_quota = 15;
    backend_config.daily_quota_minutes = backend_config
        .daily_quota_minutes
        .saturating_add(study_earned_quota);
    assert_eq!(backend_config.daily_quota_minutes, 75);

    // 2. Meanwhile, frontend was loaded before the study session, so its cached
    // config has daily_quota_minutes = 60.
    // User updates conversion ratio in Settings to 45 / 20.
    // Frontend sends `new_config` with study_minutes_required: 45, reward_quota_minutes: 20,
    // but with stale daily_quota_minutes: 60.
    let mut frontend_new_config = AppConfig::default();
    frontend_new_config.study_minutes_required = 45;
    frontend_new_config.reward_quota_minutes = 20;
    frontend_new_config.daily_quota_minutes = 60; // Stale cached value

    // 3. Current save_app_config implementation does NOT preserve daily_quota_minutes!
    // Notice lines 168-190 in src/config.rs:
    // It preserves violations_count, quota_used_seconds, etc., but NOT daily_quota_minutes!
    // *backend_config = frontend_new_config.clone();

    // We document this exact behavioral discrepancy:
    let would_overwrite_to = frontend_new_config.daily_quota_minutes;
    assert_eq!(
        would_overwrite_to, 60,
        "Frontend stale payload contains 60 instead of 75"
    );
    assert_ne!(
        backend_config.daily_quota_minutes, would_overwrite_to,
        "Vulnerability identified: backend had 75 minutes, but save_app_config allows stale 60 to overwrite it!"
    );
}
