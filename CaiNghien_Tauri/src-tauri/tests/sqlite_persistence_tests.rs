use std::fs;
use std::io::Read;
use std::path::PathBuf;
use chrono::Local;

use cainghien_tauri_lib::db::{
    apply_penalty, get_database_path, get_heatmap_data,
    get_typing_scores, get_user_profile, init_db, open_connection,
    record_discipline_minute, record_focus_session,
    save_typing_score, update_user_profile,
};
use cainghien_tauri_lib::models::{TypingScoreInput, UserProfile};

fn get_unique_temp_db_path(test_name: &str) -> (PathBuf, PathBuf) {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("cainghien_{}_{}_{}", test_name, std::process::id(), nonce));
    fs::create_dir_all(&dir).expect("Failed to create temporary directory for test");
    let db_path = dir.join("cainghien_test.db");
    (dir, db_path)
}

#[test]
fn test_sqlite_disk_lifecycle_and_non_ram_persistence() {
    let (temp_dir, db_path) = get_unique_temp_db_path("persistence_lifecycle");

    // Phase 1: Initialize DB on physical disk, run migrations, seed data, and perform writes
    {
        assert!(!db_path.exists(), "DB file should not exist prior to init");

        let mut conn = init_db(&db_path, None).expect("init_db must succeed on physical disk");

        // Verify initial seeded profile
        let initial_profile = get_user_profile(&conn).expect("Must read initial seeded profile");
        assert_eq!(initial_profile.username, "User");
        assert_eq!(initial_profile.level, 1);
        assert_eq!(initial_profile.streak, 0);

        // Update profile with rich Vietnamese Unicode characters
        let mut custom_profile = initial_profile.clone();
        custom_profile.username = "Đại Sứ Không Gian".to_string();
        custom_profile.handle = "@astro_viet_🚀".to_string();
        custom_profile.title = "Thiền Sư Vũ Trụ".to_string();
        custom_profile.level = 30;
        custom_profile.current_xp = 12500;
        custom_profile.next_level_xp = 20000;
        custom_profile.streak = 150;
        update_user_profile(&conn, &custom_profile).expect("Updating profile must succeed");

        // Record a focus session
        let focus_res = record_focus_session(&mut conn, 50, "deep_focus_pomodoro".to_string())
            .expect("Recording focus session must succeed");
        assert!(focus_res.success);
        assert_eq!(focus_res.xp_earned, 200); // 50 mins * 4 XP

        // Save a typing challenge score
        let typing_input = TypingScoreInput {
            wpm: 88,
            accuracy: 99.2,
            time_seconds: 45,
            words_count: 66,
            difficulty: Some("quantum_speed".to_string()),
        };
        let typing_res = save_typing_score(&mut conn, typing_input)
            .expect("Saving typing score must succeed");
        assert!(typing_res.saved);
        assert_eq!(typing_res.rank, "Quantum Master");

        // Record a discipline minute
        let today = Local::now().format("%Y-%m-%d").to_string();
        record_discipline_minute(&mut conn, &today, 5)
            .expect("Recording discipline minute must succeed");

        // Force WAL checkpoint to flush to main DB file before dropping connection
        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);

        // Explicitly drop connection and flush all OS file handles
        drop(conn);
    }

    // Phase 2: Inspect physical file on disk directly (non-RAM validation)
    assert!(db_path.exists(), "DB file must physically exist on disk after dropping connection");
    let metadata = fs::metadata(&db_path).expect("Must read DB file metadata");
    assert!(metadata.len() >= 4096, "Physical SQLite file must be at least one page in size (>= 4096 bytes)");

    // Validate SQLite 3 magic header
    let mut file = fs::File::open(&db_path).expect("Must open physical DB file on disk");
    let mut header_buf = [0u8; 16];
    file.read_exact(&mut header_buf).expect("Must read 16 bytes of SQLite header");
    drop(file);

    assert_eq!(
        &header_buf,
        b"SQLite format 3\0",
        "Physical file on disk must start with exact SQLite 3 magic header 'SQLite format 3\\0'"
    );

    // Phase 3: Reopen database in a completely fresh connection from the physical disk file
    {
        let conn = open_connection(&db_path).expect("Must reopen DB via fresh physical connection");

        // Verify updated profile persisted identically
        let profile = get_user_profile(&conn).expect("Must read user profile from reopened connection");
        assert_eq!(profile.username, "Đại Sứ Không Gian");
        assert_eq!(profile.handle, "@astro_viet_🚀");
        assert_eq!(profile.title, "Thiền Sư Vũ Trụ");
        assert_eq!(profile.level, 30);
        assert_eq!(profile.streak, 151); // 150 + 1 (focus session increments streak)

        // Verify typing scores persisted identically
        let scores = get_typing_scores(&conn).expect("Must read typing scores");
        assert!(!scores.is_empty(), "Typing scores must not be empty");
        let latest = &scores[0];
        assert_eq!(latest.wpm, 88);
        assert!((latest.accuracy - 99.2).abs() < 0.001);
        assert_eq!(latest.time_seconds, 45);
        assert_eq!(latest.words_count, 66);

        // Verify heatmap data persisted and includes today's contributions
        let heatmap = get_heatmap_data(&conn).expect("Must read heatmap data");
        assert_eq!(heatmap.days.len(), 365, "Must retain 365 days window");
        assert!(heatmap.total_contributions >= 1, "Total contributions must include seeds and new sessions");
        assert!(heatmap.current_streak >= 128, "Current streak must be preserved");

        // Verify focus session was written to focus_sessions table
        let session_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM focus_sessions WHERE session_type = 'deep_focus_pomodoro';", [], |r| r.get(0))
            .expect("Must count focus sessions");
        assert_eq!(session_count, 1, "Expected 1 deep_focus_pomodoro session in DB");
    }

    // Cleanup
    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_sqlite_multiple_reconnect_cycles_and_monotonicity() {
    let (temp_dir, db_path) = get_unique_temp_db_path("reconnect_cycles");

    // Cycle 0: Initialize
    {
        let _conn = init_db(&db_path, None).expect("Init DB");
    }

    // Cycles 1 to 3: Open, increment typing score with distinct timestamp, drop, reopen, verify monotonic count
    for iteration in 1..=3 {
        // Sleep 1010ms to ensure distinct second-granularity timestamp for score ID
        if iteration > 1 {
            std::thread::sleep(std::time::Duration::from_millis(1010));
        }

        let mut conn = open_connection(&db_path).expect("Reopen DB connection");

        let input = TypingScoreInput {
            wpm: 60 + iteration * 5,
            accuracy: 95.0,
            time_seconds: 30,
            words_count: 30,
            difficulty: Some("quantum".to_string()),
        };
        save_typing_score(&mut conn, input).expect("Save typing score in iteration");

        let scores = get_typing_scores(&conn).expect("Get typing scores");
        assert_eq!(scores.len(), iteration as usize, "Score count must match iteration number");

        // Force WAL flush and close
        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);
        drop(conn);
    }

    // Final verification from a brand new connection
    {
        let conn = open_connection(&db_path).expect("Final reopen DB");
        let scores = get_typing_scores(&conn).expect("Final get typing scores");
        assert_eq!(scores.len(), 3, "All 3 records across 3 connection cycles must be present");
        assert_eq!(scores[0].wpm, 75); // Latest iteration 3 (60 + 3*5)
        assert_eq!(scores[2].wpm, 65); // Earliest iteration 1 (60 + 1*5)
    }

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_sqlite_adversarial_sql_injection_and_unicode_escaping() {
    let (temp_dir, db_path) = get_unique_temp_db_path("adversarial_escaping");

    let injection_username = "Robert'); DROP TABLE user_profile;--";
    let injection_handle = "@inject'; DELETE FROM daily_contributions;--";
    let complex_unicode_title = "Thiền sư Thích Nhất Hạnh: Ứ, Ợ, Đ, Ơ, Á, À, Ả, Ã, Ạ | 🌌🪐✨ | \"'\\/`";

    // Write adversarial payload
    {
        let conn = init_db(&db_path, None).expect("Init DB");
        let profile = UserProfile {
            username: injection_username.to_string(),
            handle: injection_handle.to_string(),
            title: complex_unicode_title.to_string(),
            avatar_type: "cosmic_singularity".to_string(),
            level: 42,
            level_title: "Sentinel".to_string(),
            next_level_title: "Arch-Voyager".to_string(),
            current_xp: 9999,
            next_level_xp: 10000,
            streak: 99,
            longest_streak: 100,
            rank: "Sentinel".to_string(),
            total_focus_hours: 88,
        };
        update_user_profile(&conn, &profile).expect("Updating with adversarial strings must safely parameterize");
        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);
        drop(conn);
    }

    // Reopen and verify tables are completely intact and strings match byte-for-byte
    {
        let conn = open_connection(&db_path).expect("Reopen after injection test");

        // Verify user_profile table was NOT dropped
        let retrieved = get_user_profile(&conn).expect("user_profile table must exist and be queryable");
        assert_eq!(retrieved.username, injection_username);
        assert_eq!(retrieved.handle, injection_handle);
        assert_eq!(retrieved.title, complex_unicode_title);
        assert_eq!(retrieved.level, 42);

        // Verify daily_contributions was NOT deleted
        let heatmap = get_heatmap_data(&conn).expect("daily_contributions must be intact");
        assert_eq!(heatmap.days.len(), 365);
        assert_eq!(heatmap.total_contributions, 0);
    }

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_sqlite_penalty_persistence_across_connections() {
    let (temp_dir, db_path) = get_unique_temp_db_path("penalty_persistence");

    // Phase 1: Set high level and streak, then apply penalty
    {
        let mut conn = init_db(&db_path, None).expect("Init DB");

        let mut high_profile = get_user_profile(&conn).expect("Get profile");
        high_profile.level = 80;
        high_profile.current_xp = 50000;
        high_profile.streak = 250;
        update_user_profile(&conn, &high_profile).expect("Update to high profile");

        // Apply penalty
        let penalized = apply_penalty(&mut conn).expect("Apply penalty must succeed");
        assert_eq!(penalized.level, 1, "Level must be reset to 1");
        assert_eq!(penalized.current_xp, 0, "XP must be reset to 0");
        assert_eq!(penalized.streak, 0, "Streak must be reset to 0");

        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);
        drop(conn);
    }

    // Phase 2: Reopen in brand new connection and assert penalty persisted on disk
    {
        let conn = open_connection(&db_path).expect("Reopen DB after penalty");
        let profile = get_user_profile(&conn).expect("Get profile from fresh connection");
        assert_eq!(profile.level, 1, "Persisted level must remain 1");
        assert_eq!(profile.current_xp, 0, "Persisted XP must remain 0");
        assert_eq!(profile.streak, 0, "Persisted streak must remain 0");

        // Verify violation was recorded in daily_contributions for today
        let today = Local::now().format("%Y-%m-%d").to_string();
        let violations: i64 = conn
            .query_row(
                "SELECT violations FROM daily_contributions WHERE date = ?1;",
                [&today],
                |r| r.get(0),
            )
            .expect("Must query today's violations");
        assert!(violations >= 1, "Today must have recorded at least 1 violation");
    }

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_cainghien_db_path_env_override() {
    let (temp_dir, custom_db_path) = get_unique_temp_db_path("env_override");

    std::env::set_var("CAINGHIEN_DB_PATH", custom_db_path.to_str().unwrap());
    let resolved = get_database_path();
    assert_eq!(resolved, custom_db_path, "get_database_path must respect CAINGHIEN_DB_PATH override");

    // Clean up env var
    std::env::remove_var("CAINGHIEN_DB_PATH");
    let _ = fs::remove_dir_all(&temp_dir);
}
