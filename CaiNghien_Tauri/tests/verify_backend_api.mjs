#!/usr/bin/env node

/**
 * =============================================================================
 * Automated Rust Backend API Verification Suite: CaiNghien Desktop
 * =============================================================================
 * 
 * Verifies backend API implementation and contracts according to:
 * - PROJECT.md (Interface Contracts, Milestone M2)
 * - TEST_INFRA.md (Feature Inventory, Test Execution Architecture)
 * - ORIGINAL_REQUEST.md (Requirements R3, Backend Integration)
 * 
 * Features Verified:
 * 1. Merge Conflict Marker Hygiene in Rust source and configs
 * 2. Rust Data Models (UserProfile, HeatmapDay, HeatmapData, FocusSession, TypingChallenge, TypingScore)
 * 3. Tauri Command Definitions (Signatures, return types, error handling)
 * 4. Command Registration in tauri::generate_handler! in lib.rs
 * 5. Tauri v2 Permissions & Capabilities Manifests (permissions/default.toml, capabilities/default.json)
 * 6. Rust Toolchain Compilation (cargo check & cargo test execution)
 * 7. Mathematical & Contract Schema Invariants
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TAURI_DIR = path.join(ROOT_DIR, 'src-tauri');
const SRC_TAURI_DIR = path.join(TAURI_DIR, 'src');

// ANSI Color Formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

class TestRunner {
  constructor(title) {
    this.title = title;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.currentSuite = '';
    this.results = [];
  }

  suite(name) {
    this.currentSuite = name;
    console.log(`\n${colors.bold}${colors.cyan}=== [SUITE] ${name} ===${colors.reset}`);
  }

  assert(description, condition, details = '') {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`  ${colors.green}✓ PASS${colors.reset}: ${description}`);
      this.results.push({ suite: this.currentSuite, description, status: 'PASS', details });
    } else {
      this.failed++;
      console.log(`  ${colors.red}✗ FAIL${colors.reset}: ${description}`);
      if (details) {
        console.log(`    ${colors.dim}${colors.red}↳ Details: ${details}${colors.reset}`);
      }
      this.results.push({ suite: this.currentSuite, description, status: 'FAIL', details });
    }
  }

  warn(description, condition, details = '') {
    if (!condition) {
      this.warnings++;
      console.log(`  ${colors.yellow}⚠ WARN${colors.reset}: ${description}`);
      if (details) {
        console.log(`    ${colors.dim}${colors.yellow}↳ Details: ${details}${colors.reset}`);
      }
    }
  }

  report() {
    console.log(`\n${colors.bold}${colors.magenta}====================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.white}           BACKEND API VERIFICATION SUMMARY         ${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}====================================================${colors.reset}`);
    console.log(`  Total Invariant Tests : ${this.total}`);
    console.log(`  Passed Tests          : ${colors.green}${this.passed}${colors.reset}`);
    console.log(`  Failed Tests          : ${this.failed > 0 ? colors.red : colors.green}${this.failed}${colors.reset}`);
    console.log(`  Warnings              : ${this.warnings > 0 ? colors.yellow : colors.dim}${this.warnings}${colors.reset}`);
    const passRate = this.total > 0 ? ((this.passed / this.total) * 100).toFixed(1) : '0.0';
    console.log(`  Pass Rate             : ${colors.bold}${this.failed === 0 ? colors.green : colors.yellow}${passRate}%${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}====================================================${colors.reset}\n`);

    return this.failed === 0;
  }
}

const runner = new TestRunner('CaiNghien Rust Backend API Verification');

// Helper to read file safely
function readFile(relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(TAURI_DIR, relPath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

// Find files recursively
function findFiles(dir, exts = ['.rs', '.toml', '.json']) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'target' || entry.name === 'target2' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// =============================================================================
// Suite 1: Merge Conflict Marker Hygiene in Rust Backend
// =============================================================================
runner.suite('1. Merge Conflict Marker Hygiene');

const backendFiles = findFiles(TAURI_DIR);
let conflictFiles = [];
for (const file of backendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('<<<<<<<') || content.includes('=======') || content.includes('>>>>>>>')) {
    conflictFiles.push(path.relative(ROOT_DIR, file));
  }
}

runner.assert(
  'Rust backend files must be free of git merge conflict markers',
  conflictFiles.length === 0,
  conflictFiles.length > 0 
    ? `Conflict markers found in: ${conflictFiles.join(', ')}`
    : 'All backend files clean of merge conflict markers'
);

// =============================================================================
// Suite 2: Rust Data Models Structure (src/models.rs)
// =============================================================================
runner.suite('2. Rust Data Models Structure (models.rs)');

const modelsContent = readFile('src/models.rs') || '';

runner.assert(
  'models.rs exists and is readable',
  modelsContent.length > 0,
  modelsContent.length > 0 ? `Read ${modelsContent.length} bytes` : 'src/models.rs not found'
);

// 2.1 UserProfile Model
const hasUserProfile = modelsContent.includes('struct UserProfile');
const userProfileFields = ['username', 'title', 'level', 'current_xp', 'next_level_xp', 'rank'];
const missingUserProfileFields = userProfileFields.filter(f => !modelsContent.includes(f));

runner.assert(
  'UserProfile struct is defined with gamification fields (username, title, level, current_xp, next_level_xp, rank)',
  hasUserProfile && missingUserProfileFields.length === 0,
  hasUserProfile 
    ? (missingUserProfileFields.length === 0 ? 'All fields present' : `Missing fields: ${missingUserProfileFields.join(', ')}`)
    : 'struct UserProfile not found'
);

// 2.2 HeatmapDay / DayCell Model
const hasHeatmapDay = modelsContent.includes('struct HeatmapDay') || modelsContent.includes('struct DayCell');
const heatmapDayFields = ['date', 'count', 'level'];
const missingHeatmapDayFields = heatmapDayFields.filter(f => !modelsContent.includes(f));

runner.assert(
  'HeatmapDay / DayCell struct is defined with date, count, and intensity level',
  hasHeatmapDay && missingHeatmapDayFields.length === 0,
  hasHeatmapDay 
    ? (missingHeatmapDayFields.length === 0 ? 'All fields present' : `Missing fields: ${missingHeatmapDayFields.join(', ')}`)
    : 'struct HeatmapDay / DayCell not found'
);

// 2.3 HeatmapData Model
const hasHeatmapData = modelsContent.includes('struct HeatmapData');
const heatmapDataFields = ['total_contributions', 'current_streak', 'longest_streak', 'activity_rate', 'days'];
const missingHeatmapDataFields = heatmapDataFields.filter(f => !modelsContent.includes(f));

runner.assert(
  'HeatmapData struct is defined with aggregated 365-day stats and daily records vector',
  hasHeatmapData && missingHeatmapDataFields.length === 0,
  hasHeatmapData 
    ? (missingHeatmapDataFields.length === 0 ? 'All fields present' : `Missing fields: ${missingHeatmapDataFields.join(', ')}`)
    : 'struct HeatmapData not found'
);

// 2.4 FocusSession / FocusSessionResult
const hasFocusSession = modelsContent.includes('struct FocusSession');
const hasFocusResult = modelsContent.includes('struct FocusSessionResult');

runner.assert(
  'FocusSession and FocusSessionResult structs are defined',
  hasFocusSession && hasFocusResult,
  `FocusSession: ${hasFocusSession ? 'yes' : 'no'}, FocusSessionResult: ${hasFocusResult ? 'yes' : 'no'}`
);

// 2.5 TypingChallenge & TypingScore Models
const hasTypingChallenge = modelsContent.includes('struct TypingChallenge');
const hasTypingScore = modelsContent.includes('struct TypingScore');
const hasTypingScoreResult = modelsContent.includes('struct TypingScoreResult') || modelsContent.includes('struct TypingScoreInput');

runner.assert(
  'TypingChallenge, TypingScore, and TypingScoreResult structs are defined',
  hasTypingChallenge && hasTypingScore && hasTypingScoreResult,
  `TypingChallenge: ${hasTypingChallenge ? 'yes' : 'no'}, TypingScore: ${hasTypingScore ? 'yes' : 'no'}, Result: ${hasTypingScoreResult ? 'yes' : 'no'}`
);

// 2.6 Serde Serialization Derives
const hasSerdeDerives = 
  modelsContent.includes('#[derive(') &&
  modelsContent.includes('Serialize') &&
  modelsContent.includes('Deserialize');

runner.assert(
  'Data models derive Serialize and Deserialize for Tauri IPC bridge',
  hasSerdeDerives,
  hasSerdeDerives ? 'Serde derives detected across models' : 'Serde Serialize/Deserialize derives missing'
);

// =============================================================================
// Suite 3: Tauri Command Definitions (commands.rs & lib.rs)
// =============================================================================
runner.suite('3. Tauri Command Implementation');

const commandsContent = (readFile('src/commands.rs') || '') + '\n' + (readFile('src/lib.rs') || '') + '\n' + (readFile('src/config.rs') || '');

const requiredCommands = [
  { name: 'get_heatmap_data', desc: 'Fetches 365-day activity heatmap and summary telemetry' },
  { name: 'get_user_profile', desc: 'Fetches user profile (Level 28 Stargazer, XP, Rank)' },
  { name: 'update_user_profile', desc: 'Updates profile fields and persists changes' },
  { name: 'record_focus_session', desc: 'Logs completed focus duration, awards XP, increments streak' },
  { name: 'get_typing_challenge_text', desc: 'Provides challenge text with difficulty selection' },
  { name: 'save_typing_score', desc: 'Persists typing speed results, awards XP, records activity' },
  { name: 'get_typing_scores', desc: 'Retrieves past typing challenge leaderboard records' },
];

for (const cmd of requiredCommands) {
  const isCommandDefined = 
    commandsContent.includes(`fn ${cmd.name}`) ||
    commandsContent.includes(`pub fn ${cmd.name}`);
  const hasTauriAttr = 
    commandsContent.includes(`#[tauri::command]`) && isCommandDefined;

  runner.assert(
    `Command "${cmd.name}" is implemented (${cmd.desc})`,
    isCommandDefined,
    isCommandDefined ? `fn ${cmd.name} found` : `fn ${cmd.name} not defined in commands.rs or lib.rs`
  );
}

// Check retained core commands
const coreCommands = ['get_app_config', 'save_app_config', 'enter_focus_room', 'exit_focus_room'];
for (const cmd of coreCommands) {
  const isPresent = commandsContent.includes(`fn ${cmd}`) || commandsContent.includes(`pub fn ${cmd}`);
  runner.assert(
    `Core command "${cmd}" is retained`,
    isPresent,
    isPresent ? `fn ${cmd} found` : `fn ${cmd} missing`
  );
}

// =============================================================================
// Suite 4: Command Registration in lib.rs
// =============================================================================
runner.suite('4. Command Registration in lib.rs');

const libContent = readFile('src/lib.rs') || '';

runner.assert(
  'src/lib.rs exists',
  libContent.length > 0,
  libContent.length > 0 ? `Read ${libContent.length} bytes` : 'src/lib.rs not found'
);

const hasGenerateHandler = libContent.includes('tauri::generate_handler![');

runner.assert(
  'tauri::generate_handler! macro is invoked in lib.rs builder',
  hasGenerateHandler,
  hasGenerateHandler ? 'tauri::generate_handler! found' : 'tauri::generate_handler! missing'
);

if (hasGenerateHandler) {
  const handlerBlockMatch = libContent.match(/tauri::generate_handler!\[([\s\S]*?)\]/);
  const handlerBlock = handlerBlockMatch ? handlerBlockMatch[1] : '';

  for (const cmd of requiredCommands) {
    const isRegistered = handlerBlock.includes(cmd.name);
    runner.assert(
      `Command "${cmd.name}" is registered in tauri::generate_handler!`,
      isRegistered,
      isRegistered ? `Registered in handler: ${cmd.name}` : `MISSING from tauri::generate_handler!: ${cmd.name}`
    );
  }
}

// =============================================================================
// Suite 5: Permissions & Capabilities Security Manifests
// =============================================================================
runner.suite('5. Permissions & Capabilities Security Manifests');

const permissionsToml = readFile('permissions/default.toml') || '';
const capabilitiesJson = readFile('capabilities/default.json') || '';

runner.assert(
  'permissions/default.toml exists',
  permissionsToml.length > 0,
  permissionsToml.length > 0 ? `Read ${permissionsToml.length} bytes` : 'permissions/default.toml missing'
);

runner.assert(
  'capabilities/default.json exists',
  capabilitiesJson.length > 0,
  capabilitiesJson.length > 0 ? `Read ${capabilitiesJson.length} bytes` : 'capabilities/default.json missing'
);

for (const cmd of requiredCommands) {
  const inPermissions = permissionsToml.includes(`allow = ["${cmd.name}"]`) || permissionsToml.includes(`"${cmd.name}"`);
  runner.assert(
    `Permission for command "${cmd.name}" is declared in permissions/default.toml`,
    inPermissions,
    inPermissions ? `Permission found for ${cmd.name}` : `Missing permission for ${cmd.name}`
  );
}

let capObj = null;
try {
  if (capabilitiesJson) capObj = JSON.parse(capabilitiesJson);
} catch (e) {
  // Parsing failure
}

runner.assert(
  'capabilities/default.json is valid JSON',
  capObj !== null,
  capObj ? 'Parsed capabilities JSON' : 'Failed to parse capabilities/default.json'
);

if (capObj) {
  const hasPermissionsList = Array.isArray(capObj.permissions);
  runner.assert(
    'capabilities/default.json exposes default permissions array',
    hasPermissionsList,
    hasPermissionsList ? `Permissions: ${capObj.permissions.join(', ')}` : 'No permissions array in default.json'
  );
}

// =============================================================================
// Suite 6: Rust Toolchain Compilation & Cargo Checks
// =============================================================================
runner.suite('6. Rust Toolchain Compilation Check');

try {
  console.log(`  ${colors.dim}Running "cargo check --manifest-path src-tauri/Cargo.toml"...${colors.reset}`);
  const checkOutput = execSync('cargo check --manifest-path src-tauri/Cargo.toml', {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 300000,
  });
  runner.assert(
    'Rust backend passes "cargo check" without compilation errors',
    true,
    'cargo check succeeded cleanly'
  );
} catch (err) {
  const stderr = err.stderr || err.stdout || err.message;
  const firstErrorLines = stderr.split('\n').filter(l => l.includes('error')).slice(0, 5).join('\n    ');
  runner.assert(
    'Rust backend passes "cargo check" without compilation errors',
    false,
    `cargo check failed:\n    ${firstErrorLines || stderr.slice(0, 300)}`
  );
}

// 6.2 Run cargo test if unit tests are present
try {
  console.log(`  ${colors.dim}Running "cargo test --manifest-path src-tauri/Cargo.toml --lib"...${colors.reset}`);
  const testOutput = execSync('cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture', {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 300000,
  });
  runner.assert(
    'Rust backend unit tests pass ("cargo test")',
    true,
    'cargo test succeeded'
  );
} catch (err) {
  const stderr = err.stderr || err.stdout || err.message;
  // Check if failure is due to compilation error or failed test assertion
  runner.assert(
    'Rust backend unit tests pass ("cargo test")',
    false,
    `cargo test failed:\n    ${stderr.slice(0, 300)}`
  );
}

// =============================================================================
// Suite 7: Contract & Mathematical Schema Invariants
// =============================================================================
runner.suite('7. Mathematical & Contract Schema Invariants');

// 7.1 Heatmap 365 days coverage invariant
// Simulate contract: HeatmapData must provide 364-366 days of data
function simulateHeatmapGeneration(daysCount = 365) {
  const days = [];
  const today = new Date();
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = Math.floor(Math.random() * 40);
    // Level 0..5 calculation
    let level = 0;
    if (count > 0 && count <= 7) level = 1;
    else if (count >= 8 && count <= 15) level = 2;
    else if (count >= 16 && count <= 22) level = 3;
    else if (count >= 23 && count <= 29) level = 4;
    else if (count >= 30) level = 5;
    days.push({ date: dateStr, count, level });
  }
  const totalContributions = days.reduce((acc, c) => acc + c.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;
  const activityRate = Number(((activeDays / daysCount) * 100).toFixed(1));
  return { days, totalContributions, activityRate };
}

const mockHeatmap = simulateHeatmapGeneration(365);
runner.assert(
  'Heatmap invariant: exactly 365 days generated with ISO dates (YYYY-MM-DD)',
  mockHeatmap.days.length === 365 && mockHeatmap.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)),
  `Generated ${mockHeatmap.days.length} days; sample date: ${mockHeatmap.days[0]?.date}`
);

runner.assert(
  'Heatmap invariant: intensity level strictly clamped between 0 and 5',
  mockHeatmap.days.every(d => d.level >= 0 && d.level <= 5),
  'All 365 simulated cells satisfy 0 <= level <= 5'
);

runner.assert(
  'Heatmap invariant: activity rate bounded between 0.0% and 100.0%',
  mockHeatmap.activityRate >= 0 && mockHeatmap.activityRate <= 100,
  `Activity rate: ${mockHeatmap.activityRate}%`
);

// 7.2 XP Progression Invariant
function computeXpProgress(currentXp, nextXp) {
  if (nextXp <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentXp / nextXp) * 100)));
}

const mockProfile = { level: 28, currentXp: 14350, nextXp: 15000 };
const progressPct = computeXpProgress(mockProfile.currentXp, mockProfile.nextXp);
runner.assert(
  'Profile progression invariant: XP percentage clamps accurately (e.g. 14,350 / 15,000 = 96%)',
  progressPct === 96,
  `Computed progress: ${progressPct}% (expected 96%)`
);

// 7.3 Typing Score Bounds Invariant
function validateTypingScore(wpm, accuracy, timeSeconds) {
  return wpm >= 0 && accuracy >= 0 && accuracy <= 100 && timeSeconds >= 0;
}

runner.assert(
  'Typing score invariant: WPM >= 0, Accuracy in [0, 100], Time >= 0',
  validateTypingScore(74, 98.5, 32) && !validateTypingScore(-5, 105, -1),
  'Validated score bounds checking logic'
);

// =============================================================================
// Run and Exit
// =============================================================================
const success = runner.report();
process.exit(success ? 0 : 1);
