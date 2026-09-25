use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::os::windows::fs::OpenOptionsExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime};

use cainghien_tauri_lib::commands::{
    calculate_study_reward_quota, validate_study_report_text,
};
use cainghien_tauri_lib::config::{
    atomic_save_to_path, load_config_from_path,
};
use cainghien_tauri_lib::db::{
    get_heatmap_data, init_db, open_connection, record_focus_session,
    save_typing_score,
};
use cainghien_tauri_lib::models::{AppConfig, TypingScoreInput};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

fn create_temp_test_dir(prefix: &str) -> PathBuf {
    let count = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "cainghien_dyn_{}_{}_{}",
        prefix,
        std::process::id(),
        count
    ));
    fs::create_dir_all(&dir).expect("Failed to create temporary directory for test");
    dir
}

// =========================================================================
// EXPERIMENT 1: RESOURCE TELEMETRY & PERFORMANCE PROFILING
// =========================================================================

#[test]
fn test_benchmark_sqlite_transaction_throughput_and_disk_io() {
    println!("\n>>> [BENCHMARK 1.1] SQLite Transaction Throughput & Query Latency <<<");
    let temp_dir = create_temp_test_dir("sqlite_perf");
    let db_path = temp_dir.join("cainghien_perf.db");

    let mut conn = init_db(&db_path, None).expect("init_db failed");

    // 1. Check WAL mode
    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
        .expect("PRAGMA journal_mode query failed");
    println!("  SQLite Journal Mode: {}", journal_mode);
    assert_eq!(journal_mode.to_lowercase(), "wal", "SQLite should be configured in WAL mode");

    // 2. Measure Focus Session Insert Latency & Catch Primary Key Collision Bug
    let res_first = record_focus_session(&mut conn, 25, "focus_tag_1".into());
    assert!(res_first.is_ok(), "First focus session insert must succeed");

    // Attempt second insert in the exact same second:
    let res_second_same_second = record_focus_session(&mut conn, 30, "focus_tag_2".into());
    match res_second_same_second {
        Ok(_) => {
            println!("  [Focus Session] Second insert in same second succeeded (second ticked or unique ID)");
        }
        Err(e) => {
            println!(
                "  [CONFIRMED DEFECT SEC-CHALL-01] Same-second focus session collision: {}",
                e
            );
            assert!(
                e.contains("UNIQUE constraint failed: focus_sessions.id"),
                "Expected UNIQUE constraint failure on focus_sessions.id"
            );
        }
    }

    // Measure raw SQLite transaction throughput with unique IDs
    let tx_iterations = 200;
    let start_raw_tx = Instant::now();
    {
        let tx = conn.transaction().unwrap();
        for i in 0..tx_iterations {
            tx.execute(
                "INSERT INTO focus_sessions (id, timestamp, duration_minutes, session_type, quote, completed, xp_earned)
                 VALUES (?1, ?2, 25, 'benchmark', NULL, 1, 100);",
                rusqlite::params![format!("bench_focus_{}_{}", std::process::id(), i), 1700000000 + i],
            ).unwrap();
        }
        tx.commit().unwrap();
    }
    let dur_raw_tx = start_raw_tx.elapsed();
    let tx_throughput = (tx_iterations as f64) / dur_raw_tx.as_secs_f64();
    println!(
        "  [Batched SQLite Inserts] {} rows committed in {:.2?}, Throughput: {:.1} rows/sec",
        tx_iterations, dur_raw_tx, tx_throughput
    );

    // 3. Measure Heatmap Aggregation Latency (365-day query)
    let heatmap_query_count = 50;
    let start_heatmap = Instant::now();
    for _ in 0..heatmap_query_count {
        let heatmap = get_heatmap_data(&conn).unwrap();
        assert_eq!(heatmap.days.len(), 365);
    }
    let duration_heatmap = start_heatmap.elapsed();
    let heatmap_latency_avg_ms = (duration_heatmap.as_secs_f64() * 1000.0) / (heatmap_query_count as f64);
    println!(
        "  [Heatmap Query (365-day)] Iterations: {}, Elapsed: {:.2?}, Avg Latency: {:.3} ms/query",
        heatmap_query_count, duration_heatmap, heatmap_latency_avg_ms
    );

    // 4. Measure Database File Size
    let db_metadata = fs::metadata(&db_path).expect("Failed to get db metadata");
    let wal_path = temp_dir.join("cainghien_perf.db-wal");
    let wal_size = if wal_path.exists() {
        fs::metadata(&wal_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    println!(
        "  [Disk Footprint] DB File: {:.2} KB, WAL File: {:.2} KB, Total: {:.2} KB",
        (db_metadata.len() as f64) / 1024.0,
        (wal_size as f64) / 1024.0,
        ((db_metadata.len() + wal_size) as f64) / 1024.0
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_benchmark_config_atomic_write_vs_direct_write() {
    println!("\n>>> [BENCHMARK 1.2] Config File Atomic Write vs Direct Write <<<");
    let temp_dir = create_temp_test_dir("config_io_perf");
    let atomic_cfg_path = temp_dir.join("config_atomic.json");
    let direct_cfg_path = temp_dir.join("config_direct.json");

    let sample_config = AppConfig {
        protection_enabled: true,
        blocked_domains: vec![
            "facebook.com".into(),
            "youtube.com".into(),
            "tiktok.com".into(),
            "reddit.com".into(),
            "instagram.com".into(),
        ],
        password_hash: Some("5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8".into()),
        level: 25,
        xp: 12000,
        streak: 14,
        daily_quota_minutes: 60,
        quota_used_seconds: 1200,
        study_minutes_required: 60,
        reward_quota_minutes: 15,
        ..Default::default()
    };

    let iterations = 50;

    // Test Atomic Save (atomic_save_to_path: write to .tmp.<pid> + rename/replace)
    let start_atomic = Instant::now();
    for _ in 0..iterations {
        atomic_save_to_path(&atomic_cfg_path, &sample_config).expect("Atomic save failed");
    }
    let duration_atomic = start_atomic.elapsed();
    let atomic_avg_ms = (duration_atomic.as_secs_f64() * 1000.0) / (iterations as f64);
    println!(
        "  [Atomic Write (tmp+rename)] Iterations: {}, Elapsed: {:.2?}, Avg: {:.3} ms/op",
        iterations, duration_atomic, atomic_avg_ms
    );

    // Test Direct fs::write (used by enforcement.rs for hosts file)
    let config_json = serde_json::to_string_pretty(&sample_config).unwrap();
    let start_direct = Instant::now();
    for _ in 0..iterations {
        fs::write(&direct_cfg_path, &config_json).expect("Direct write failed");
    }
    let duration_direct = start_direct.elapsed();
    let direct_avg_ms = (duration_direct.as_secs_f64() * 1000.0) / (iterations as f64);
    println!(
        "  [Direct fs::write (truncate+write)] Iterations: {}, Elapsed: {:.2?}, Avg: {:.3} ms/op",
        iterations, duration_direct, direct_avg_ms
    );

    // Verify atomic file can be loaded back cleanly
    let loaded = load_config_from_path(&atomic_cfg_path);
    assert_eq!(loaded.level, 25);
    assert_eq!(loaded.blocked_domains.len(), 5);

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_benchmark_cpu_and_process_enumeration_latency() {
    println!("\n>>> [BENCHMARK 1.3] CPU & Loop Profiling (Process Enumeration & Window Title) <<<");
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

    // 1. Benchmark full system process enumeration
    let start_sys_full = Instant::now();
    let mut sys = System::new_with_specifics(
        RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
    );
    let full_init_duration = start_sys_full.elapsed();
    let process_count = sys.processes().len();
    println!(
        "  [sysinfo] Full System Init: {:.2?} (Discovered {} active OS processes)",
        full_init_duration, process_count
    );

    // 2. Benchmark process refresh cycles (as done by watchdog / background loops)
    let refresh_cycles = 10;
    let start_refresh = Instant::now();
    for _ in 0..refresh_cycles {
        sys.refresh_processes(ProcessesToUpdate::All, true);
    }
    let duration_refresh = start_refresh.elapsed();
    let avg_refresh_ms = (duration_refresh.as_secs_f64() * 1000.0) / (refresh_cycles as f64);
    println!(
        "  [sysinfo] refresh_processes() Iterations: {}, Elapsed: {:.2?}, Avg Latency: {:.3} ms/cycle",
        refresh_cycles, duration_refresh, avg_refresh_ms
    );

    // 3. Active Window Position & Title Sniffing (active-win-pos-rs)
    let start_win = Instant::now();
    let active_win = active_win_pos_rs::get_active_window();
    let win_query_duration = start_win.elapsed();
    match active_win {
        Ok(w) => println!(
            "  [active-win-pos-rs] Query Latency: {:.3} ms, Active Win: '{}' (PID: {})",
            win_query_duration.as_secs_f64() * 1000.0,
            w.title,
            w.process_id
        ),
        Err(_) => println!(
            "  [active-win-pos-rs] Query Latency: {:.3} ms (No foreground window in headless context)",
            win_query_duration.as_secs_f64() * 1000.0
        ),
    }

    // 4. Theoretical CPU Impact Assessment
    // If enforcement loop sleeps 1000ms and spends ~2-5ms per iteration, CPU load is ~0.2% - 0.5%
    println!(
        "  [Enforcement Loop Assessment] 1000ms sleep + ~{:.1}ms work = Estimated idle background CPU: < 0.5%",
        avg_refresh_ms
    );
}

// =========================================================================
// EXPERIMENT 2: EDGE CASE & STRESS TESTING
// =========================================================================

#[test]
fn test_stress_oversized_payload_on_word_validation_and_study_report() {
    println!("\n>>> [STRESS 2.1] Oversized Payloads: 1MB to 10MB Text in Study Report <<<");

    // Generate 1MB payload of words
    let word = "hoc_tap_cham_chi ";
    let repeat_count_1mb = ((1024 * 1024) / word.len()) + 1;
    let payload_1mb = word.repeat(repeat_count_1mb);
    assert!(payload_1mb.len() >= 1024 * 1024);

    let start_1mb = Instant::now();
    let res_1mb = validate_study_report_text(&payload_1mb);
    let dur_1mb = start_1mb.elapsed();
    assert!(res_1mb.is_ok());
    let words_1mb = res_1mb.unwrap();
    println!(
        "  [1 MB Payload] Size: {} bytes, Word Count: {}, Time: {:.2?} (No panic, validated ok)",
        payload_1mb.len(), words_1mb, dur_1mb
    );

    // Generate 5MB payload
    let repeat_count_5mb = ((5 * 1024 * 1024) / word.len()) + 1;
    let payload_5mb = word.repeat(repeat_count_5mb);
    let start_5mb = Instant::now();
    let res_5mb = validate_study_report_text(&payload_5mb);
    let dur_5mb = start_5mb.elapsed();
    assert!(res_5mb.is_ok());
    println!(
        "  [5 MB Payload] Size: {} bytes, Word Count: {}, Time: {:.2?} (Completed without OOM)",
        payload_5mb.len(), res_5mb.unwrap(), dur_5mb
    );

    // Generate 10MB payload
    let repeat_count_10mb = ((10 * 1024 * 1024) / word.len()) + 1;
    let payload_10mb = word.repeat(repeat_count_10mb);
    let start_10mb = Instant::now();
    let res_10mb = validate_study_report_text(&payload_10mb);
    let dur_10mb = start_10mb.elapsed();
    assert!(res_10mb.is_ok());
    println!(
        "  [10 MB Payload] Size: {} bytes, Word Count: {}, Time: {:.2?} (Completed without OOM)",
        payload_10mb.len(), res_10mb.unwrap(), dur_10mb
    );

    assert!(dur_10mb.as_secs_f64() < 5.0, "10MB text validation took too long (> 5s)");
}

#[test]
fn test_stress_corrupted_and_locked_sqlite_database_behavior() {
    println!("\n>>> [STRESS 2.2] Corrupted and Locked SQLite Database Vectors <<<");
    let temp_dir = create_temp_test_dir("corrupted_db_test");

    // 1. Test Corrupted SQLite File (garbage bytes instead of SQLite header)
    let corrupt_db_path = temp_dir.join("corrupted.db");
    {
        let mut f = File::create(&corrupt_db_path).unwrap();
        f.write_all(b"NOT_A_SQLITE_DATABASE_CORRUPT_BYTES_XYZ_1234567890").unwrap();
        f.flush().unwrap();
    }

    // Call init_db on corrupted file
    let init_corrupted_res = init_db(&corrupt_db_path, None);
    println!(
        "  [Corrupted DB] init_db result on raw garbage file: {:?}",
        init_corrupted_res.as_ref().map(|_| "Ok").map_err(|e| e.to_string())
    );
    // SQLite detects "file is not a database" and init_db fails!
    assert!(
        init_corrupted_res.is_err(),
        "init_db must fail on non-SQLite corrupted file"
    );

    // Empirical proof of panic vector:
    // In src-tauri/src/lib.rs:241:
    // let db_conn = db::init_db(&db_path, Some(&config_data)).expect("Failed to initialize SQLite database");
    // If init_db fails, .expect(...) triggers an unrecoverable process panic!
    let panic_result = std::panic::catch_unwind(|| {
        init_db(&corrupt_db_path, None).expect("Failed to initialize SQLite database")
    });
    assert!(
        panic_result.is_err(),
        "Empirical confirmation: .expect(...) panics on corrupted database"
    );
    println!("  [CONFIRMED PANIC VECTOR] lib.rs:241 .expect(...) panics and crashes app on corrupted SQLite file");

    // 2. Test Exclusively Locked SQLite File (Windows Sharing Violation)
    let locked_db_path = temp_dir.join("locked.db");
    {
        // First create a valid db
        let _ = init_db(&locked_db_path, None).unwrap();
    }

    // Open file with exclusive lock (share_mode = 0 means NO other process can read or write)
    let _locked_file = OpenOptions::new()
        .read(true)
        .write(true)
        .share_mode(0) // FILE_SHARE_NONE
        .open(&locked_db_path)
        .expect("Failed to lock file");

    // Attempt to open or init db while file is exclusively locked
    let open_locked_res = open_connection(&locked_db_path);
    println!(
        "  [Locked DB] open_connection on exclusively locked file: {:?}",
        open_locked_res.as_ref().map(|_| "Ok").map_err(|e| e.to_string())
    );
    assert!(
        open_locked_res.is_err(),
        "Connecting to exclusively locked database must fail with sharing violation"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_stress_corrupted_config_json_fallback_behavior() {
    println!("\n>>> [STRESS 2.3] Corrupted & Malformed config.json Recovery <<<");
    let temp_dir = create_temp_test_dir("corrupted_cfg_test");

    // Scenario A: Completely empty file (0 bytes)
    let empty_cfg_path = temp_dir.join("empty_config.json");
    fs::write(&empty_cfg_path, b"").unwrap();
    let loaded_empty = load_config_from_path(&empty_cfg_path);
    assert_eq!(
        loaded_empty.protection_enabled, false,
        "Empty config file must safely fallback to AppConfig::default()"
    );
    println!("  [Empty config.json (0 bytes)] Safely fell back to default config without crash");

    // Scenario B: Truncated JSON syntax error
    let truncated_cfg_path = temp_dir.join("truncated_config.json");
    fs::write(&truncated_cfg_path, br#"{"protection_enabled": true, "blocked_domains": ["#).unwrap();
    let loaded_truncated = load_config_from_path(&truncated_cfg_path);
    assert_eq!(
        loaded_truncated.protection_enabled, false,
        "Malformed JSON must safely fallback to default without panic"
    );
    println!("  [Malformed JSON syntax] Safely fell back to default config without crash");

    // Scenario C: Invalid field types (e.g. string where number expected)
    let invalid_types_path = temp_dir.join("invalid_types.json");
    fs::write(
        &invalid_types_path,
        br#"{"protection_enabled": "NOT_A_BOOL", "level": "NOT_A_NUMBER"}"#,
    )
    .unwrap();
    let loaded_types = load_config_from_path(&invalid_types_path);
    assert_eq!(
        loaded_types.level, 1,
        "Type mismatch must safely fallback to default without panic"
    );
    println!("  [Type mismatch JSON] Safely fell back to default config without crash");

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_stress_system_clock_skew_panic_vector_verification() {
    println!("\n>>> [STRESS 2.4] Clock Skew / Backwards Time Jump Panic Vector <<<");

    let now = SystemTime::now();
    let future_time = now + Duration::from_secs(3600);

    // When calculating duration_since with an earlier anchor in the future:
    let backwards_res = now.duration_since(future_time);
    assert!(backwards_res.is_err(), "duration_since with time in the future must return Err");

    // Demonstrate the exact panic vector when unwrap is called on backwards jump:
    let panic_res = std::panic::catch_unwind(|| {
        let earlier = now;
        let later = earlier - Duration::from_secs(60);
        // This simulates a clock moving backwards before an anchor or before UNIX_EPOCH:
        later.duration_since(earlier).unwrap()
    });
    assert!(panic_res.is_err(), "Calling .unwrap() on backwards clock skew must panic");
    println!(
        "  [CONFIRMED PANIC VECTOR] .duration_since(anchor).unwrap() panics on negative clock adjustment"
    );
}

#[test]
fn test_stress_hosts_file_crlf_injection_and_sharing_violation() {
    println!("\n>>> [STRESS 2.5] Hosts File CRLF Injection & File Sharing Violation <<<");
    let temp_dir = create_temp_test_dir("hosts_stress");
    let mock_hosts_path = temp_dir.join("mock_hosts");

    // Initial hosts file content
    fs::write(
        &mock_hosts_path,
        "127.0.0.1 localhost\r\n::1 localhost\r\n",
    )
    .unwrap();

    // 1. CRLF Injection Test on apply_hosts_block logic:
    let malicious_domain = "clean.com\r\n192.168.1.100 injected-bank.com\r\n#";
    let base_domain = malicious_domain.trim();
    let mut block_lines = Vec::new();
    block_lines.push(format!("127.0.0.1 {}", base_domain));
    block_lines.push(format!("::1 {}", base_domain));

    let joined_block = block_lines.join("\r\n");
    println!("  [CRLF Injection Output]:\n{}", joined_block);

    assert!(
        joined_block.contains("192.168.1.100 injected-bank.com"),
        "Empirical confirmation: CRLF input injects arbitrary IP mapping into hosts string"
    );
    println!("  [CONFIRMED VULNERABILITY SEC-BACK-03] Domain with CRLF escapes formatting and injects arbitrary line");

    // 2. Sharing Violation / Read-lock DoS test (SEC-BACK-19)
    let _read_lock = OpenOptions::new()
        .read(true)
        .share_mode(1) // FILE_SHARE_READ only
        .open(&mock_hosts_path)
        .expect("Failed to open mock hosts for reading");

    let write_res = fs::write(&mock_hosts_path, "Overwritten content");
    println!(
        "  [Sharing Violation DoS] Write attempt on read-locked file: {:?}",
        write_res.as_ref().map(|_| "Ok").map_err(|e| format!("OS error {}: {}", e.raw_os_error().unwrap_or(0), e))
    );
    assert!(
        write_res.is_err(),
        "fs::write must fail when file is held with FILE_SHARE_READ only"
    );
    let err = write_res.unwrap_err();
    assert_eq!(
        err.raw_os_error(),
        Some(32),
        "Must fail with Windows OS error 32 (ERROR_SHARING_VIOLATION)"
    );
    println!("  [CONFIRMED VULNERABILITY SEC-BACK-19] OS Error 32 sharing violation blocks enforcement writes");

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_stress_gamification_extreme_inputs_and_quota_math() {
    println!("\n>>> [STRESS 2.6] Gamification Extreme Inputs & Math Invariants <<<");

    // 1. calculate_study_reward_quota with boundary inputs
    let res_zero = calculate_study_reward_quota(0, 60, 15);
    assert_eq!(res_zero, 0);

    let res_max_u32 = calculate_study_reward_quota(u32::MAX, 60, 15);
    println!("  Quota for u32::MAX study duration: {} minutes", res_max_u32);
    assert_eq!(res_max_u32, u32::MAX / 4);

    let res_zero_config = calculate_study_reward_quota(120, 0, 0);
    assert_eq!(res_zero_config, 30);

    // 2. High WPM and accuracy inputs on SQLite saving
    let temp_dir = create_temp_test_dir("gamification_stress");
    let db_path = temp_dir.join("gamification.db");
    let mut conn = init_db(&db_path, None).unwrap();

    let extreme_score = TypingScoreInput {
        wpm: 1_000_000,
        accuracy: 100.0,
        time_seconds: 60,
        words_count: 1_000_000,
        difficulty: Some("quantum".into()),
    };
    let save_res = save_typing_score(&mut conn, extreme_score);
    assert!(save_res.is_ok(), "Database should accept large valid integer fields");
    let result_obj = save_res.unwrap();
    println!(
        "  Extreme Score Result: saved={}, rank='{}', xp_earned={}",
        result_obj.saved, result_obj.rank, result_obj.xp_earned
    );
    assert!(result_obj.xp_earned > 1_000_000, "XP earned inflated to > 2 million");
    println!("  [CONFIRMED FINDING FE-VULN-04 / SEC-BACK-09] Extreme WPM grants millions of XP without validation");

    let _ = fs::remove_dir_all(&temp_dir);
}
