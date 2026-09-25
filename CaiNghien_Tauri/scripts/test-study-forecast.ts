import assert from "node:assert/strict";

/**
 * Study-to-Earn Reward Forecast Formula Specification
 * Reference: spec_miner_study_earn/handoff.md:85-99
 * Formula: floor( (duration / max(1, required)) * reward )
 */
export interface ForecastResult {
  forecastMinutes: number;
  minMinutesForOneReward: number;
  ratioPercentage: number;
}

export function calculateStudyRewardForecast(
  studyMinutes: number,
  studyMinutesRequired: number = 60,
  rewardQuotaMinutes: number = 15
): ForecastResult {
  // Guard against non-numeric, negative, or zero denominator
  const duration = Math.max(0, Math.floor(Number(studyMinutes)) || 0);
  const rawReq = Math.floor(Number(studyMinutesRequired));
  // Zero or negative required minutes is safely clamped to 60 or minimum 1
  const req = rawReq <= 0 ? 60 : rawReq;
  const reward = Math.max(0, Math.floor(Number(rewardQuotaMinutes)) || 0);

  const forecastMinutes = Math.floor((duration / req) * reward);
  const minMinutesForOneReward = reward > 0 ? Math.ceil(req / reward) : 0;
  const ratioPercentage = Math.round((reward / req) * 100);

  return {
    forecastMinutes,
    minMinutesForOneReward,
    ratioPercentage,
  };
}

/**
 * Settings Conversion Ratio Validation Specification
 * Reference: spec_miner_study_earn/handoff.md:140-163
 */
export interface RatioValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateStudyRatioInput(
  studyMinutesRequired: number | string,
  rewardQuotaMinutes: number | string
): RatioValidationResult {
  const reqNum = Number(studyMinutesRequired);
  const rewardNum = Number(rewardQuotaMinutes);

  if (isNaN(reqNum) || !Number.isInteger(reqNum) || reqNum <= 0) {
    return {
      isValid: false,
      error: "Thời gian học yêu cầu phải là số nguyên dương lớn hơn 0",
    };
  }

  if (isNaN(rewardNum) || !Number.isInteger(rewardNum) || rewardNum <= 0) {
    return {
      isValid: false,
      error: "Thời gian thưởng quota phải là số nguyên dương lớn hơn 0",
    };
  }

  if (reqNum > 1440) {
    return {
      isValid: false,
      error: "Thời gian học yêu cầu không vượt quá 1440 phút (24h)",
    };
  }

  if (rewardNum > 720) {
    return {
      isValid: false,
      error: "Thời gian thưởng quota không vượt quá 720 phút (12h)",
    };
  }

  return { isValid: true };
}

export function runForecastTests() {
  console.log("=================================================");
  console.log("   TEST SUITE: STUDY REWARD FORECAST & SETTINGS  ");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}`);
      console.error(`       ${err.message}`);
      throw err;
    }
  }

  // 1. Preset Durations with Standard Ratio (60m required : 15m quota)
  test("Standard Ratio (60:15) - 15 minutes session -> 3 minutes quota", () => {
    const res = calculateStudyRewardForecast(15, 60, 15);
    assert.equal(res.forecastMinutes, 3);
    assert.equal(res.minMinutesForOneReward, 4);
    assert.equal(res.ratioPercentage, 25);
  });

  test("Standard Ratio (60:15) - 25 minutes session -> 6 minutes quota (floor from 6.25)", () => {
    const res = calculateStudyRewardForecast(25, 60, 15);
    assert.equal(res.forecastMinutes, 6);
  });

  test("Standard Ratio (60:15) - 45 minutes session -> 11 minutes quota (floor from 11.25)", () => {
    const res = calculateStudyRewardForecast(45, 60, 15);
    assert.equal(res.forecastMinutes, 11);
  });

  test("Standard Ratio (60:15) - 60 minutes session -> exactly 15 minutes quota", () => {
    const res = calculateStudyRewardForecast(60, 60, 15);
    assert.equal(res.forecastMinutes, 15);
  });

  test("Standard Ratio (60:15) - 90 minutes session -> 22 minutes quota (floor from 22.5)", () => {
    const res = calculateStudyRewardForecast(90, 60, 15);
    assert.equal(res.forecastMinutes, 22);
  });

  test("Standard Ratio (60:15) - 120 minutes session -> 30 minutes quota", () => {
    const res = calculateStudyRewardForecast(120, 60, 15);
    assert.equal(res.forecastMinutes, 30);
  });

  // 2. Sub-Threshold and Zero Quota Guidance
  test("Sub-threshold: 3 minutes study produces 0 quota, prompts 4m minimum", () => {
    const res = calculateStudyRewardForecast(3, 60, 15);
    assert.equal(res.forecastMinutes, 0);
    assert.equal(res.minMinutesForOneReward, 4);
  });

  test("Zero study minutes produces 0 quota", () => {
    const res = calculateStudyRewardForecast(0, 60, 15);
    assert.equal(res.forecastMinutes, 0);
  });

  // 3. Custom Ratio Scenarios
  test("Custom Ratio (45m required : 10m reward) - 45m study -> 10m quota", () => {
    const res = calculateStudyRewardForecast(45, 45, 10);
    assert.equal(res.forecastMinutes, 10);
  });

  test("Custom Ratio (45m required : 10m reward) - 90m study -> 20m quota", () => {
    const res = calculateStudyRewardForecast(90, 45, 10);
    assert.equal(res.forecastMinutes, 20);
  });

  test("Custom Ratio (30m required : 15m reward, 50%) - 60m study -> 30m quota", () => {
    const res = calculateStudyRewardForecast(60, 30, 15);
    assert.equal(res.forecastMinutes, 30);
    assert.equal(res.ratioPercentage, 50);
  });

  // 4. Boundary & Divide-by-Zero Resilience
  test("Resilience: required = 0 falls back to default 60 (no Infinity/NaN)", () => {
    const res = calculateStudyRewardForecast(60, 0, 15);
    assert(!isNaN(res.forecastMinutes));
    assert(isFinite(res.forecastMinutes));
    assert.equal(res.forecastMinutes, 15);
  });

  test("Resilience: negative required = -30 falls back safely without negative quota", () => {
    const res = calculateStudyRewardForecast(60, -30, 15);
    assert(!isNaN(res.forecastMinutes));
    assert(res.forecastMinutes >= 0);
  });

  test("Resilience: negative study minutes clamped to 0", () => {
    const res = calculateStudyRewardForecast(-25, 60, 15);
    assert.equal(res.forecastMinutes, 0);
  });

  test("Resilience: upper bound 1440m (24h) with 60:15 ratio -> 360m quota", () => {
    const res = calculateStudyRewardForecast(1440, 60, 15);
    assert.equal(res.forecastMinutes, 360);
  });

  // 5. Settings Ratio Input Validation
  test("Validation: Default (60, 15) is valid", () => {
    const val = validateStudyRatioInput(60, 15);
    assert.equal(val.isValid, true);
    assert.equal(val.error, undefined);
  });

  test("Validation: Custom valid integers (45, 10) are valid", () => {
    const val = validateStudyRatioInput("45", "10");
    assert.equal(val.isValid, true);
  });

  test("Validation: Zero required minutes is rejected", () => {
    const val = validateStudyRatioInput(0, 15);
    assert.equal(val.isValid, false);
    assert(val.error?.includes("lớn hơn 0"));
  });

  test("Validation: Zero reward quota minutes is rejected", () => {
    const val = validateStudyRatioInput(60, 0);
    assert.equal(val.isValid, false);
    assert(val.error?.includes("lớn hơn 0"));
  });

  test("Validation: Negative numbers are rejected", () => {
    const val = validateStudyRatioInput(-10, 15);
    assert.equal(val.isValid, false);
  });

  test("Validation: Floating point numbers are rejected", () => {
    const val = validateStudyRatioInput(45.5, 15);
    assert.equal(val.isValid, false);
  });

  test("Validation: Non-numeric strings are rejected", () => {
    const val = validateStudyRatioInput("sixty", 15);
    assert.equal(val.isValid, false);
  });

  test("Validation: Exceeding 1440 minutes study is rejected", () => {
    const val = validateStudyRatioInput(1441, 15);
    assert.equal(val.isValid, false);
    assert(val.error?.includes("1440"));
  });

  test("Validation: Exceeding 720 minutes quota reward is rejected", () => {
    const val = validateStudyRatioInput(60, 721);
    assert.equal(val.isValid, false);
    assert(val.error?.includes("720"));
  });

  console.log(`\nForecast & Settings Suite Complete: ${passed} / ${total} tests passed.\n`);
  return { passed, total };
}

// Direct execution support
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runForecastTests();
}
