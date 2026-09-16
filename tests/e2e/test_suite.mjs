#!/usr/bin/env node
/**
 * ============================================================================
 * CaiNghien Core 5 Features - Automated E2E Test Suite Runner
 * ============================================================================
 *
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§R1 Heatmap, §R2 Schedule, §R3 Typing, §R4 Focus, §R5 Penalty)
 * - PROJECT.md (Architecture, Code Layout, Interface Contracts)
 * - TEST_INFRA.md (4-Tier Test Architecture & Minimum Thresholds: >=65 tests)
 *
 * Usage:
 *   node tests/e2e/test_suite.mjs                # Run all 65+ tests
 *   node tests/e2e/test_suite.mjs --tier=1       # Run Tier 1 only (Feature Coverage)
 *   node tests/e2e/test_suite.mjs --tier=2       # Run Tier 2 only (Boundaries & Edge Cases)
 *   node tests/e2e/test_suite.mjs --tier=3       # Run Tier 3 only (Cross-Feature Pairwise)
 *   node tests/e2e/test_suite.mjs --tier=4       # Run Tier 4 only (Real-World Scenarios)
 *   node tests/e2e/test_suite.mjs --test=R5      # Filter tests matching query
 *   node tests/e2e/test_suite.mjs --json         # Output machine-readable JSON
 * ============================================================================
 */

import { registry, colors } from './test_framework.mjs';

// Import all Tier 1 Feature test modules
import './tier1_features/test_r1_heatmap.mjs';
import './tier1_features/test_r2_schedule.mjs';
import './tier1_features/test_r3_typing.mjs';
import './tier1_features/test_r4_focus.mjs';
import './tier1_features/test_r5_penalty.mjs';

// Import all Tier 2 Boundary & Corner test modules
import './tier2_boundaries/test_r1_boundaries.mjs';
import './tier2_boundaries/test_r2_boundaries.mjs';
import './tier2_boundaries/test_r3_boundaries.mjs';
import './tier2_boundaries/test_r4_boundaries.mjs';
import './tier2_boundaries/test_r5_boundaries.mjs';

// Import Tier 3 Cross-Feature Pairwise tests
import './tier3_pairwise/test_pairwise.mjs';

// Import Tier 4 Real-World Application Scenarios
import './tier4_realworld/test_scenarios.mjs';

// Parse arguments
const args = process.argv.slice(2);
const tierArg = args.find(a => a.startsWith('--tier='))?.split('=')[1];
const tierFilter = tierArg ? parseInt(tierArg, 10) : null;
const searchArg = args.find(a => a.startsWith('--test='))?.split('=')[1];
const jsonOutput = args.includes('--json');

async function main() {
  if (!jsonOutput) {
    console.log(`${colors.bold}${colors.cyan}============================================================================${colors.reset}`);
    console.log(`${colors.bold}  CAINGHIEN TAURI CORE 5 FEATURES - AUTOMATED E2E TEST SUITE${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}============================================================================${colors.reset}`);
    console.log(`Registered Total Tests: ${registry.tests.length}`);
    if (tierFilter) console.log(`Active Tier Filter: Tier ${tierFilter}`);
    if (searchArg) console.log(`Active Search Filter: "${searchArg}"`);
  }

  const results = await registry.runAll({
    tierFilter,
    searchFilter: searchArg,
    verbose: !jsonOutput
  });

  if (jsonOutput) {
    const summary = {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: results.total > 0 ? (results.passed / results.total) * 100 : 0,
      tests: results.tests.map(t => ({
        id: t.id,
        name: t.name,
        tier: t.tier,
        feature: t.feature,
        passed: t.passed,
        durationMs: t.durationMs,
        error: t.error ? t.error.message : null
      }))
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exit(results.failed > 0 ? 1 : 0);
  }

  // Calculate Breakdown by Tier
  const tierStats = { 1: { total: 0, passed: 0 }, 2: { total: 0, passed: 0 }, 3: { total: 0, passed: 0 }, 4: { total: 0, passed: 0 } };
  for (const t of results.tests) {
    if (tierStats[t.tier]) {
      tierStats[t.tier].total++;
      if (t.passed) tierStats[t.tier].passed++;
    }
  }

  console.log(`\n${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}  4-TIER E2E TEST EXECUTION SUMMARY MATRIX${colors.reset}`);
  console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  for (let tier = 1; tier <= 4; tier++) {
    const stat = tierStats[tier];
    const pct = stat.total > 0 ? Math.round((stat.passed / stat.total) * 100) : 0;
    const tierName = tier === 1 ? 'Tier 1 (Feature Coverage)'
      : tier === 2 ? 'Tier 2 (Boundary & Corner Cases)'
      : tier === 3 ? 'Tier 3 (Cross-Feature Pairwise)'
      : 'Tier 4 (Real-World Journeys)';

    const color = stat.passed === stat.total && stat.total > 0 ? colors.green : colors.red;
    console.log(`  ${tierName.padEnd(34)}: ${color}${stat.passed}/${stat.total} Passed (${pct}%)${colors.reset}`);
  }

  console.log(`${colors.dim}──────────────────────────────────────────────────────────────────────────${colors.reset}`);
  const totalColor = results.failed === 0 ? colors.green : colors.red;
  console.log(`  ${colors.bold}Total Test Checks Run             : ${totalColor}${results.passed}/${results.total} Passed${colors.reset}`);
  console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  if (results.failed === 0 && results.total >= 65) {
    console.log(`\n${colors.bold}${colors.green}>>> ALL 4 TIERS PASSED (${results.total} Checks) - E2E SPECIFICATION 100% VERIFIED <<<${colors.reset}\n`);
    process.exit(0);
  } else if (results.failed === 0) {
    console.log(`\n${colors.bold}${colors.green}>>> PASS: ${results.passed} checks executed successfully <<<${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bold}${colors.red}>>> FAIL: ${results.failed} tests failed <<<${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
