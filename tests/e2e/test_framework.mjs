/**
 * ============================================================================
 * CaiNghien Core 5 Features - E2E Test Framework Harness
 * ============================================================================
 */

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

export const PASS_ICON = `${colors.green}✔ PASS${colors.reset}`;
export const FAIL_ICON = `${colors.red}✘ FAIL${colors.reset}`;
export const INFO_ICON = `${colors.cyan}ℹ INFO${colors.reset}`;

class TestRegistry {
  constructor() {
    this.tests = [];
    this.currentTier = 1;
    this.currentFeature = '';
  }

  setContext(tier, feature) {
    this.currentTier = tier;
    this.currentFeature = feature;
  }

  register(id, name, fn) {
    this.tests.push({
      id,
      name,
      fn,
      tier: this.currentTier,
      feature: this.currentFeature,
      passed: false,
      error: null,
      durationMs: 0
    });
  }

  async runAll(options = {}) {
    const { tierFilter = null, searchFilter = null, verbose = true } = options;
    const filteredTests = this.tests.filter(t => {
      if (tierFilter !== null && t.tier !== tierFilter) return false;
      if (searchFilter && !t.id.toLowerCase().includes(searchFilter.toLowerCase()) && !t.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });

    let passedCount = 0;
    let failedCount = 0;

    let lastTier = null;
    let lastFeature = null;

    for (const t of filteredTests) {
      if (verbose && (t.tier !== lastTier || t.feature !== lastFeature)) {
        console.log(`\n${colors.bold}${colors.cyan}--- Tier ${t.tier}: ${t.feature} ---${colors.reset}`);
        lastTier = t.tier;
        lastFeature = t.feature;
      }

      const start = Date.now();
      try {
        await t.fn();
        t.passed = true;
        passedCount++;
        t.durationMs = Date.now() - start;
        if (verbose) {
          console.log(`  ${PASS_ICON} ${colors.bold}[${t.id}]${colors.reset} ${t.name} ${colors.gray}(${t.durationMs}ms)${colors.reset}`);
        }
      } catch (err) {
        t.passed = false;
        t.error = err;
        failedCount++;
        t.durationMs = Date.now() - start;
        if (verbose) {
          console.log(`  ${FAIL_ICON} ${colors.bold}[${t.id}]${colors.reset} ${t.name}`);
          console.log(`         ${colors.red}Assertion Error: ${err.message}${colors.reset}`);
          if (err.stack) {
            const stackLines = err.stack.split('\n').slice(1, 3);
            stackLines.forEach(l => console.log(`         ${colors.gray}${l.trim()}${colors.reset}`));
          }
        }
      }
    }

    return {
      total: filteredTests.length,
      passed: passedCount,
      failed: failedCount,
      tests: filteredTests
    };
  }
}

export const registry = new TestRegistry();

export function defineTest(id, name, fn) {
  registry.register(id, name, fn);
}

// Assertion Helpers
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertTrue(actual, message = 'Expected true') {
  if (actual !== true) {
    throw new Error(`${message}: got ${JSON.stringify(actual)}`);
  }
}

export function assertFalse(actual, message = 'Expected false') {
  if (actual !== false) {
    throw new Error(`${message}: got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message ? message + ': ' : ''}Deep equality mismatch.\nExpected: ${expectedStr}\nActual:   ${actualStr}`);
  }
}

export function assertThrows(fn, expectedErrorSubstring = null, message = 'Expected function to throw') {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedErrorSubstring && !err.message.includes(expectedErrorSubstring)) {
      throw new Error(`Expected error message to include "${expectedErrorSubstring}", got "${err.message}"`);
    }
  }
  if (!threw) {
    throw new Error(message);
  }
}
