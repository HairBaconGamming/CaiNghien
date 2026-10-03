use cainghien_tauri_lib::commands::{calculate_study_reward_quota, validate_study_report_text};

// ----------------------------------------------------------------------===
// SECTION 1: WORD VALIDATION HELPER ADVERSARIAL STRESS TESTS
// ----------------------------------------------------------------------===

#[test]
fn test_word_validation_empty_and_whitespace_only() {
    // 1. Empty string
    let empty_res = validate_study_report_text("");
    assert!(empty_res.is_err(), "Empty string must be rejected");
    let err_msg = empty_res.unwrap_err();
    assert!(
        err_msg.contains("0 từ"),
        "Error should report 0 words, got: {}",
        err_msg
    );

    // 2. Spaces only
    let spaces_res = validate_study_report_text("     ");
    assert!(spaces_res.is_err(), "Spaces-only string must be rejected");
    assert!(spaces_res.unwrap_err().contains("0 từ"));

    // 3. Tabs only
    let tabs_res = validate_study_report_text("\t\t\t\t\t");
    assert!(tabs_res.is_err(), "Tabs-only string must be rejected");
    assert!(tabs_res.unwrap_err().contains("0 từ"));

    // 4. Newlines only
    let newlines_res = validate_study_report_text("\n\n\r\n\r\r\n");
    assert!(
        newlines_res.is_err(),
        "Newlines-only string must be rejected"
    );
    assert!(newlines_res.unwrap_err().contains("0 từ"));

    // 5. Mixed whitespace
    let mixed_ws = "  \t \n \r\n  \t   \n  ";
    let mixed_res = validate_study_report_text(mixed_ws);
    assert!(mixed_res.is_err(), "Mixed whitespace must be rejected");
    assert!(mixed_res.unwrap_err().contains("0 từ"));

    // 6. Unicode whitespace characters (non-breaking space, em quad, ideographic space)
    let unicode_ws = "\u{00A0} \u{2000} \u{2003} \u{3000}";
    let unicode_res = validate_study_report_text(unicode_ws);
    assert!(
        unicode_res.is_err(),
        "Unicode whitespace only must be rejected"
    );
    assert!(unicode_res.unwrap_err().contains("0 từ"));
}

#[test]
fn test_word_validation_boundary_99_100_101_words() {
    // Exactly 99 words
    let words_99: Vec<String> = (1..=99).map(|i| format!("word{}", i)).collect();
    let text_99 = words_99.join(" ");
    let res_99 = validate_study_report_text(&text_99);
    assert!(res_99.is_err(), "99 words must be rejected (< 100)");
    let err_99 = res_99.unwrap_err();
    assert!(
        err_99.contains("99 từ"),
        "Error message should say 99 words, got: {}",
        err_99
    );

    // Exactly 100 words
    let words_100: Vec<String> = (1..=100).map(|i| format!("word{}", i)).collect();
    let text_100 = words_100.join(" ");
    let res_100 = validate_study_report_text(&text_100);
    assert!(res_100.is_ok(), "100 words must be accepted");
    assert_eq!(res_100.unwrap(), 100);

    // Exactly 101 words
    let words_101: Vec<String> = (1..=101).map(|i| format!("word{}", i)).collect();
    let text_101 = words_101.join(" ");
    let res_101 = validate_study_report_text(&text_101);
    assert!(res_101.is_ok(), "101 words must be accepted");
    assert_eq!(res_101.unwrap(), 101);
}

#[test]
fn test_word_validation_vietnamese_text_and_irregular_spacing() {
    // 100 Vietnamese words with diacritics and varying punctuation
    let vi_words = vec![
        "Hôm",
        "nay",
        "tôi",
        "đã",
        "hoàn",
        "thành",
        "buổi",
        "học",
        "rất",
        "hiệu",
        "quả",
        "về",
        "kiến",
        "trúc",
        "hệ",
        "thống",
        "Rust",
        "và",
        "Tauri",
        "framework.",
        "Tôi",
        "đã",
        "hiểu",
        "rõ",
        "cách",
        "thức",
        "hoạt",
        "động",
        "của",
        "State",
        "management,",
        "Mutex,",
        "và",
        "tương",
        "tác",
        "cơ",
        "sở",
        "dữ",
        "liệu",
        "SQLite.",
        "Việc",
        "tối",
        "ưu",
        "hóa",
        "hiệu",
        "năng",
        "và",
        "đảm",
        "bảo",
        "an",
        "toàn",
        "bộ",
        "nhớ",
        "là",
        "điểm",
        "mạnh",
        "nổi",
        "bật",
        "của",
        "ngôn",
        "ngữ",
        "này.",
        "Tôi",
        "sẽ",
        "tiếp",
        "tục",
        "thực",
        "hành",
        "các",
        "thuật",
        "toán",
        "phức",
        "tạp",
        "hơn",
        "trong",
        "những",
        "ngày",
        "tới",
        "để",
        "nâng",
        "cao",
        "kỹ",
        "năng",
        "lập",
        "trình",
        "chuyên",
        "nghiệp,",
        "xây",
        "dựng",
        "ứng",
        "dụng",
        "desktop",
        "chất",
        "lượng",
        "cao",
        "cho",
        "người",
        "dùng",
        "Việt",
        "Nam.",
    ];
    assert_eq!(vi_words.len(), 100);

    // Joined by irregular spaces, newlines, and tabs
    let messy_text = vi_words.join("   \n\t  ");
    let res = validate_study_report_text(&messy_text);
    assert!(
        res.is_ok(),
        "100 Vietnamese words with messy spacing should be valid"
    );
    assert_eq!(res.unwrap(), 100);
}

#[test]
fn test_word_validation_large_payload() {
    // Stress test with 10,000 words
    let large_words: Vec<String> = (1..=10_000).map(|i| format!("item{}", i)).collect();
    let large_text = large_words.join(" ");
    let res = validate_study_report_text(&large_text);
    assert!(res.is_ok(), "10,000 words should be handled gracefully");
    assert_eq!(res.unwrap(), 10_000);
}

// ----------------------------------------------------------------------===
// SECTION 2: REWARD QUOTA CALCULATION ADVERSARIAL STRESS TESTS
// ----------------------------------------------------------------------===

#[test]
fn test_reward_quota_zero_values_and_fallbacks() {
    // 1. study_minutes_required == 0 should fall back to 60
    assert_eq!(calculate_study_reward_quota(60, 0, 15), 15);
    assert_eq!(calculate_study_reward_quota(120, 0, 15), 30);
    assert_eq!(calculate_study_reward_quota(30, 0, 15), 7);

    // 2. reward_quota_minutes == 0 should fall back to 15
    assert_eq!(calculate_study_reward_quota(60, 60, 0), 15);
    assert_eq!(calculate_study_reward_quota(120, 60, 0), 30);

    // 3. Both req and reward zero -> both fall back (60, 15)
    assert_eq!(calculate_study_reward_quota(60, 0, 0), 15);
    assert_eq!(calculate_study_reward_quota(120, 0, 0), 30);
    assert_eq!(calculate_study_reward_quota(4, 0, 0), 1); // 4 / 60 * 15 = 1.0

    // 4. study_duration_minutes == 0 -> always 0 reward
    assert_eq!(calculate_study_reward_quota(0, 60, 15), 0);
    assert_eq!(calculate_study_reward_quota(0, 0, 0), 0);
    assert_eq!(calculate_study_reward_quota(0, 10, 100), 0);
}

#[test]
fn test_reward_quota_small_durations() {
    // Standard ratio: req=60, reward=15 (1 quota min per 4 study min)
    assert_eq!(calculate_study_reward_quota(1, 60, 15), 0); // 0.25 -> 0
    assert_eq!(calculate_study_reward_quota(2, 60, 15), 0); // 0.50 -> 0
    assert_eq!(calculate_study_reward_quota(3, 60, 15), 0); // 0.75 -> 0
    assert_eq!(calculate_study_reward_quota(4, 60, 15), 1); // 1.00 -> 1
    assert_eq!(calculate_study_reward_quota(5, 60, 15), 1); // 1.25 -> 1
    assert_eq!(calculate_study_reward_quota(7, 60, 15), 1); // 1.75 -> 1
    assert_eq!(calculate_study_reward_quota(8, 60, 15), 2); // 2.00 -> 2
    assert_eq!(calculate_study_reward_quota(15, 60, 15), 3); // 3.75 -> 3
    assert_eq!(calculate_study_reward_quota(29, 60, 15), 7); // 7.25 -> 7
    assert_eq!(calculate_study_reward_quota(30, 60, 15), 7); // 7.50 -> 7
    assert_eq!(calculate_study_reward_quota(31, 60, 15), 7); // 7.75 -> 7
    assert_eq!(calculate_study_reward_quota(32, 60, 15), 8); // 8.00 -> 8
    assert_eq!(calculate_study_reward_quota(59, 60, 15), 14); // 14.75 -> 14
    assert_eq!(calculate_study_reward_quota(60, 60, 15), 15); // 15.00 -> 15

    // Custom 1:1 ratio: req=10, reward=10
    assert_eq!(calculate_study_reward_quota(0, 10, 10), 0);
    assert_eq!(calculate_study_reward_quota(1, 10, 10), 1);
    assert_eq!(calculate_study_reward_quota(9, 10, 10), 9);
    assert_eq!(calculate_study_reward_quota(10, 10, 10), 10);

    // High hurdle ratio: req=120, reward=10 (12 study min per 1 quota min)
    assert_eq!(calculate_study_reward_quota(11, 120, 10), 0); // 0.916 -> 0
    assert_eq!(calculate_study_reward_quota(12, 120, 10), 1); // 1.000 -> 1
}

#[test]
fn test_reward_quota_large_numbers_and_overflow() {
    let max = u32::MAX; // 4,294,967,295

    // 1. study = u32::MAX, standard ratio (60, 15) -> u32::MAX / 4
    let r1 = calculate_study_reward_quota(max, 60, 15);
    assert_eq!(r1, 1073741823);

    // 2. study = u32::MAX, req = u32::MAX, reward = 15 -> exactly 15
    let r2 = calculate_study_reward_quota(max, max, 15);
    assert_eq!(r2, 15);

    // 3. study = u32::MAX, req = 1, reward = 1 -> u32::MAX
    let r3 = calculate_study_reward_quota(max, 1, 1);
    assert_eq!(r3, max);

    // 4. study = u32::MAX, req = 1, reward = u32::MAX
    // In float math: (4.29e9 * 4.29e9) = 1.84e19.
    // Cast to u32 in Rust saturates to u32::MAX without panic.
    let r4 = calculate_study_reward_quota(max, 1, max);
    assert_eq!(
        r4, max,
        "Float overflow must saturate to u32::MAX without panic"
    );

    // 5. req = u32::MAX, study = 1, reward = u32::MAX -> exactly 1
    let r5 = calculate_study_reward_quota(1, max, max);
    assert_eq!(r5, 1);

    // 6. Zero fallbacks with u32::MAX
    let r6 = calculate_study_reward_quota(max, 0, 0);
    assert_eq!(r6, 1073741823);
}

#[test]
fn test_reward_quota_fractions_under_micro_steps() {
    // Test fine-grained fractional steps around transitions
    // req = 60, reward = 15 -> transition every 4 minutes
    for minute in 0..=120 {
        let actual = calculate_study_reward_quota(minute, 60, 15);
        let expected = minute / 4;
        assert_eq!(
            actual, expected,
            "Mismatch at minute {}: got {}, expected {}",
            minute, actual, expected
        );
    }
}

// ----------------------------------------------------------------------===
// SECTION 3: EMPIRICAL PROOF OF FLOATING POINT PRECISION DEFICIT BUG
// ----------------------------------------------------------------------===

/// Oracle function using exact 128-bit integer arithmetic.
fn calculate_study_reward_quota_oracle(study: u32, req: u32, reward: u32) -> u32 {
    let req = if req == 0 { 60 } else { req };
    let reward = if reward == 0 { 15 } else { reward };
    let total = (study as u128) * (reward as u128);
    let quota = total / (req as u128);
    quota.min(u32::MAX as u128) as u32
}

#[test]
fn test_empirical_proof_of_floating_point_rounding_bug_now_fixed() {
    // Case 1: 1:1 ratio with req=60, reward=60, study=245 min.
    // Mathematically: 245 * 60 / 60 = 245.
    let actual_245 = calculate_study_reward_quota(245, 60, 60);
    let expected_oracle_245 = calculate_study_reward_quota_oracle(245, 60, 60);
    assert_eq!(expected_oracle_245, 245);
    // Verified that the implementation is fixed and correctly returns 245
    assert_eq!(
        actual_245, 245,
        "Implementation should correctly return 245 without rounding loss"
    );
    assert_eq!(
        actual_245, expected_oracle_245,
        "Fixed bug: (245.0 / 60.0) * 60.0 correctly calculates to 245"
    );

    // Case 2: Custom ratio req=45, reward=45, study=115 min.
    // Mathematically: 115 * 45 / 45 = 115.
    let actual_115 = calculate_study_reward_quota(115, 45, 45);
    let expected_oracle_115 = calculate_study_reward_quota_oracle(115, 45, 45);
    assert_eq!(expected_oracle_115, 115);
    assert_eq!(actual_115, 115);
    assert_eq!(
        actual_115, expected_oracle_115,
        "Fixed bug: 115 min study yields 115 min reward"
    );

    // Case 3: Custom ratio req=90, reward=45, study=230 min.
    // Mathematically: 230 * 45 / 90 = 230 / 2 = 115.
    let actual_230 = calculate_study_reward_quota(230, 90, 45);
    let expected_oracle_230 = calculate_study_reward_quota_oracle(230, 90, 45);
    assert_eq!(expected_oracle_230, 115);
    assert_eq!(actual_230, 115);
    assert_eq!(
        actual_230, expected_oracle_230,
        "Fixed bug: 230 min study yields 115 min reward instead of 114"
    );

    // Case 4: Custom ratio req=25, reward=45, study=35 min.
    // Mathematically: 35 * 45 / 25 = 1575 / 25 = 63.
    let actual_35 = calculate_study_reward_quota(35, 25, 45);
    let expected_oracle_35 = calculate_study_reward_quota_oracle(35, 25, 45);
    assert_eq!(expected_oracle_35, 63);
    assert_eq!(actual_35, 63);
    assert_eq!(
        actual_35, expected_oracle_35,
        "Fixed bug: 35 min study yields 63 min reward instead of 62"
    );
}

#[test]
fn test_oracle_robustness_across_systematic_sweep() {
    // Prove that the proposed integer oracle produces exact results with 0 discrepancies
    for req in [1, 2, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240] {
        for reward in [1, 5, 10, 15, 20, 30, 45, 60] {
            for study in (0..=360).step_by(5) {
                let oracle_val = calculate_study_reward_quota_oracle(study, req, reward);
                let manual_expected = ((study as u128 * reward as u128) / req as u128) as u32;
                assert_eq!(oracle_val, manual_expected);
            }
        }
    }
}
