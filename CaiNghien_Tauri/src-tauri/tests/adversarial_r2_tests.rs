use cainghien_tauri_lib::enforcement::is_time_in_schedule;
use cainghien_tauri_lib::models::ScheduleConfig;
use chrono::{Local, TimeZone};

#[test]
fn adversarial_test_schedule_overnight_all_minutes() {
    // 22:00 to 06:00, all 7 days
    let schedule = ScheduleConfig {
        enabled: true,
        start_time: "22:00".to_string(),
        end_time: "06:00".to_string(),
        days_of_week: vec![0, 1, 2, 3, 4, 5, 6],
    };

    // 21:59:00 -> false
    let t2159 = Local.with_ymd_and_hms(2026, 9, 16, 21, 59, 0).unwrap();
    assert!(!is_time_in_schedule(&schedule, &t2159));

    // 22:00:00 -> true
    let t2200 = Local.with_ymd_and_hms(2026, 9, 16, 22, 0, 0).unwrap();
    assert!(is_time_in_schedule(&schedule, &t2200));

    // 23:59:59 -> true
    let t2359 = Local.with_ymd_and_hms(2026, 9, 16, 23, 59, 59).unwrap();
    assert!(is_time_in_schedule(&schedule, &t2359));

    // 00:00:00 -> true
    let t0000 = Local.with_ymd_and_hms(2026, 9, 16, 0, 0, 0).unwrap();
    assert!(is_time_in_schedule(&schedule, &t0000));

    // 05:59:00 -> true
    let t0559 = Local.with_ymd_and_hms(2026, 9, 16, 5, 59, 0).unwrap();
    assert!(is_time_in_schedule(&schedule, &t0559));

    // 06:00:00 -> false
    let t0600 = Local.with_ymd_and_hms(2026, 9, 16, 6, 0, 0).unwrap();
    assert!(!is_time_in_schedule(&schedule, &t0600));

    // 06:01:00 -> false
    let t0601 = Local.with_ymd_and_hms(2026, 9, 16, 6, 1, 0).unwrap();
    assert!(!is_time_in_schedule(&schedule, &t0601));
}

#[test]
fn adversarial_test_schedule_daytime_boundaries() {
    let schedule = ScheduleConfig {
        enabled: true,
        start_time: "08:00".to_string(),
        end_time: "17:00".to_string(),
        days_of_week: vec![1, 2, 3, 4, 5],
    };

    // 07:59:59 -> false
    let t0759 = Local.with_ymd_and_hms(2026, 9, 16, 7, 59, 59).unwrap();
    assert!(!is_time_in_schedule(&schedule, &t0759));

    // 08:00:00 -> true
    let t0800 = Local.with_ymd_and_hms(2026, 9, 16, 8, 0, 0).unwrap();
    assert!(is_time_in_schedule(&schedule, &t0800));

    // 16:59:59 -> true
    let t1659 = Local.with_ymd_and_hms(2026, 9, 16, 16, 59, 59).unwrap();
    assert!(is_time_in_schedule(&schedule, &t1659));

    // 17:00:00 -> false
    let t1700 = Local.with_ymd_and_hms(2026, 9, 16, 17, 0, 0).unwrap();
    assert!(!is_time_in_schedule(&schedule, &t1700));
}

#[test]
fn adversarial_test_schedule_empty_days() {
    let schedule = ScheduleConfig {
        enabled: true,
        start_time: "00:00".to_string(),
        end_time: "23:59".to_string(),
        days_of_week: vec![],
    };

    let t1200 = Local.with_ymd_and_hms(2026, 9, 16, 12, 0, 0).unwrap();
    assert!(!is_time_in_schedule(&schedule, &t1200));
}

#[test]
fn adversarial_test_schedule_0_indexed_vs_1_indexed() {
    // Sunday 2026-09-20
    let sunday = Local.with_ymd_and_hms(2026, 9, 20, 10, 0, 0).unwrap();

    // With 0 (JS Sunday)
    let sched_0 = ScheduleConfig {
        enabled: true,
        start_time: "08:00".to_string(),
        end_time: "17:00".to_string(),
        days_of_week: vec![0],
    };
    assert!(
        is_time_in_schedule(&sched_0, &sunday),
        "0-indexed Sunday must match"
    );

    // With 7 (ISO Sunday)
    let sched_7 = ScheduleConfig {
        enabled: true,
        start_time: "08:00".to_string(),
        end_time: "17:00".to_string(),
        days_of_week: vec![7],
    };
    assert!(
        is_time_in_schedule(&sched_7, &sunday),
        "1-indexed (ISO 7) Sunday must match"
    );

    // Saturday 2026-09-19
    let saturday = Local.with_ymd_and_hms(2026, 9, 19, 10, 0, 0).unwrap();
    let sched_sat = ScheduleConfig {
        enabled: true,
        start_time: "08:00".to_string(),
        end_time: "17:00".to_string(),
        days_of_week: vec![6],
    };
    assert!(
        is_time_in_schedule(&sched_sat, &saturday),
        "Saturday 6 must match"
    );

    // Monday 2026-09-14
    let monday = Local.with_ymd_and_hms(2026, 9, 14, 10, 0, 0).unwrap();
    let sched_mon = ScheduleConfig {
        enabled: true,
        start_time: "08:00".to_string(),
        end_time: "17:00".to_string(),
        days_of_week: vec![1],
    };
    assert!(
        is_time_in_schedule(&sched_mon, &monday),
        "Monday 1 must match"
    );
}

#[test]
fn adversarial_test_schedule_malformed_and_edge_inputs() {
    // Malformed times
    let sched_malformed = ScheduleConfig {
        enabled: true,
        start_time: "invalid".to_string(),
        end_time: "17:00".to_string(),
        days_of_week: vec![1, 2, 3, 4, 5],
    };
    let now = Local::now();
    assert!(!is_time_in_schedule(&sched_malformed, &now));

    // Whitespace times
    let sched_spaces = ScheduleConfig {
        enabled: true,
        start_time: " 08:00 ".to_string(),
        end_time: " 17:00 ".to_string(),
        days_of_week: vec![0, 1, 2, 3, 4, 5, 6, 7],
    };
    let midday = Local.with_ymd_and_hms(2026, 9, 16, 12, 0, 0).unwrap();
    assert!(
        is_time_in_schedule(&sched_spaces, &midday),
        "Whitespace should be trimmed gracefully"
    );

    // Zero-duration window (start == end)
    let sched_zero = ScheduleConfig {
        enabled: true,
        start_time: "12:00".to_string(),
        end_time: "12:00".to_string(),
        days_of_week: vec![0, 1, 2, 3, 4, 5, 6, 7],
    };
    assert!(
        !is_time_in_schedule(&sched_zero, &midday),
        "Zero duration window should be inactive"
    );
}
