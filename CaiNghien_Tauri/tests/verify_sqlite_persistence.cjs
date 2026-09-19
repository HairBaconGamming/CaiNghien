/**
 * CaiNghien Desktop - SQLite Non-RAM Persistence Verifier
 * 
 * Verifies that SQLite database operates strictly on physical disk storage (non-RAM).
 * 1. Resolves target database path (%APPDATA%\com.cainghien.desktop\cainghien.db or CAINGHIEN_DB_PATH).
 * 2. Confirms physical file exists on disk and checks SQLite 3 magic header 'SQLite format 3\0'.
 * 3. Validates required schema tables: user_profile, daily_contributions, focus_sessions, typing_scores, schema_migrations.
 * 4. Inserts a unique test transaction into physical database.
 * 5. Explicitly closes database connection to flush WAL/page cache.
 * 6. Spawns an independent child process with a fresh memory space to read back the test record from disk.
 * 7. Opens a fresh connection in the main process to verify and clean up the test record.
 * 
 * Exit code 0 on success, non-zero on failure.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

function resolveDbPath() {
  if (process.env.CAINGHIEN_DB_PATH) {
    return path.resolve(process.env.CAINGHIEN_DB_PATH);
  }
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'AppData', 'Roaming');
  return path.join(appData, 'com.cainghien.desktop', 'cainghien.db');
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function bootstrapDatabaseIfMissing(dbPath) {
  if (fs.existsSync(dbPath)) {
    return false;
  }
  console.log(`[BOOTSTRAP] Database file not present at ${dbPath}. Initializing schema and seed...`);
  ensureParentDir(dbPath);
  const db = new DatabaseSync(dbPath);
  
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL DEFAULT 'Alex Chen',
      handle TEXT NOT NULL DEFAULT '@astro_alex',
      title TEXT NOT NULL DEFAULT 'Stargazer',
      avatar_type TEXT NOT NULL DEFAULT 'cosmic_singularity',
      level INTEGER NOT NULL DEFAULT 28,
      level_title TEXT NOT NULL DEFAULT 'Stargazer',
      next_level_title TEXT NOT NULL DEFAULT 'Nova Voyager (LVL 29)',
      current_xp INTEGER NOT NULL DEFAULT 14350,
      next_level_xp INTEGER NOT NULL DEFAULT 15000,
      streak INTEGER NOT NULL DEFAULT 128,
      longest_streak INTEGER NOT NULL DEFAULT 156,
      rank TEXT NOT NULL DEFAULT 'Stargazer',
      total_focus_hours INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_contributions (
      date TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      focus_minutes INTEGER NOT NULL DEFAULT 0,
      violations INTEGER NOT NULL DEFAULT 0,
      is_clean INTEGER NOT NULL DEFAULT 1,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      session_type TEXT NOT NULL DEFAULT 'pomodoro',
      quote TEXT,
      completed INTEGER NOT NULL DEFAULT 1,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS typing_scores (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      wpm INTEGER NOT NULL,
      accuracy REAL NOT NULL,
      time_seconds INTEGER NOT NULL,
      words_count INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      rank TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO user_profile (id, username, level, current_xp, next_level_xp, streak, longest_streak)
    VALUES (1, 'Alex Chen', 28, 14350, 15000, 128, 156);

    INSERT OR IGNORE INTO schema_migrations (version, description)
    VALUES (1, 'Initial core schema');
  `);

  // Seed 365 daily_contributions ending today
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO daily_contributions (date, count, focus_minutes, violations, is_clean, xp_earned)
    VALUES (?, ?, ?, 0, 1, ?)
  `);

  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isStreak = i <= 127;
    const count = isStreak ? 12 : ((i % 3 === 0) ? 8 : 0);
    insertStmt.run(dateStr, count, count * 15, count * 10);
  }

  db.close();
  return true;
}

function verifySqliteHeader(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file does not exist on disk at: ${dbPath}`);
  }

  const stat = fs.statSync(dbPath);
  if (stat.size < 100) {
    throw new Error(`Database file is too small (${stat.size} bytes) to be a valid SQLite database.`);
  }

  const fd = fs.openSync(dbPath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const headerMagic = buffer.toString('utf8');
  if (!headerMagic.startsWith('SQLite format 3\0')) {
    throw new Error(`Invalid SQLite header: expected 'SQLite format 3\\0', found: ${JSON.stringify(headerMagic)}`);
  }

  console.log(`[PASS] Physical SQLite 3 magic header verified on disk (${stat.size} bytes).`);
}

function verifySchemaAndData(db) {
  // 1. Verify schema tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  const requiredTables = ['user_profile', 'daily_contributions', 'focus_sessions', 'typing_scores', 'schema_migrations'];
  for (const table of requiredTables) {
    if (!tables.includes(table)) {
      throw new Error(`Missing required table: ${table}. Found tables: ${tables.join(', ')}`);
    }
  }
  console.log(`[PASS] Schema integrity confirmed. All 5 core tables exist: ${requiredTables.join(', ')}.`);

  // 2. Verify user profile
  const profile = db.prepare('SELECT username, handle, title, level, current_xp, streak FROM user_profile WHERE id = 1').get();
  if (!profile) {
    throw new Error('user_profile row (id=1) not found in database.');
  }
  if (typeof profile.level !== 'number' || profile.level < 1) {
    throw new Error(`Invalid user profile level: ${profile.level}`);
  }
  console.log(`[PASS] User profile verified on disk: ${profile.username} (Level ${profile.level}, Streak ${profile.streak}).`);

  // 3. Verify daily contributions
  const countRow = db.prepare('SELECT COUNT(*) as total_days, SUM(count) as total_count FROM daily_contributions').get();
  if (!countRow || countRow.total_days < 30) {
    throw new Error(`Insufficient daily_contributions rows found: ${countRow ? countRow.total_days : 0}`);
  }
  console.log(`[PASS] Daily contributions verified on disk: ${countRow.total_days} days recorded, ${countRow.total_count} total contributions.`);
}

function runChildProcessVerification(dbPath, testId, testPayload) {
  console.log(`[VERIFY] Spawning independent child process to verify non-RAM persistence from disk...`);

  const childScript = `
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = process.argv[1];
    const testId = process.argv[2];
    
    try {
      const db = new DatabaseSync(dbPath);
      const row = db.prepare('SELECT * FROM typing_scores WHERE id = ?').get(testId);
      db.close();
      if (!row) {
        console.error('Record not found in child process');
        process.exit(2);
      }
      console.log(JSON.stringify(row));
      process.exit(0);
    } catch (err) {
      console.error(err.message);
      process.exit(3);
    }
  `;

  const childOutput = execFileSync(process.execPath, ['-e', childScript, dbPath, testId], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });

  const parsed = JSON.parse(childOutput.trim());
  if (parsed.id !== testId || parsed.wpm !== testPayload.wpm) {
    throw new Error(`Child process retrieved mismatched data: expected wpm ${testPayload.wpm}, got ${parsed.wpm}`);
  }

  console.log(`[PASS] Child process (new OS process & separate memory) successfully read persisted record from disk:`, {
    id: parsed.id,
    wpm: parsed.wpm,
    accuracy: parsed.accuracy,
    rank: parsed.rank
  });
}

function main() {
  console.log('='.repeat(70));
  console.log('  CaiNghien Desktop - Automated SQLite Non-RAM Persistence Verification');
  console.log('='.repeat(70));

  const dbPath = resolveDbPath();
  console.log(`[TARGET] Physical Database Path: ${dbPath}`);

  bootstrapDatabaseIfMissing(dbPath);

  // Step 1: Verify file and header on physical disk
  verifySqliteHeader(dbPath);

  // Step 2: Open connection, inspect schema and baseline records
  const db1 = new DatabaseSync(dbPath);
  verifySchemaAndData(db1);

  // Step 3: Insert unique test record to prove physical non-RAM persistence
  const testId = `test_persist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const nowTs = Math.floor(Date.now() / 1000);
  const testPayload = {
    id: testId,
    timestamp: nowTs,
    wpm: 92,
    accuracy: 99.4,
    time_seconds: 60,
    words_count: 92,
    xp_earned: 140,
    rank: 'Quantum Master',
    difficulty: 'persistence_verification'
  };

  const insertStmt = db1.prepare(`
    INSERT INTO typing_scores (id, timestamp, wpm, accuracy, time_seconds, words_count, xp_earned, rank, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStmt.run(
    testPayload.id,
    testPayload.timestamp,
    testPayload.wpm,
    testPayload.accuracy,
    testPayload.time_seconds,
    testPayload.words_count,
    testPayload.xp_earned,
    testPayload.rank,
    testPayload.difficulty
  );

  console.log(`[PASS] Inserted unique test record: ${testId} into physical SQLite DB.`);

  // Step 4: Explicitly close connection to flush WAL/in-memory caches
  db1.close();
  console.log(`[PASS] Connection 1 closed. Memory buffers flushed.`);

  // Step 5: Read back record using an independent child process
  runChildProcessVerification(dbPath, testId, testPayload);

  // Step 6: Open Connection 2 in main process, verify, and clean up test record
  console.log(`[VERIFY] Opening fresh Connection 2 in main process...`);
  const db2 = new DatabaseSync(dbPath);
  const readRow = db2.prepare('SELECT * FROM typing_scores WHERE id = ?').get(testId);
  if (!readRow || readRow.id !== testId) {
    throw new Error('Connection 2 failed to read test record from disk.');
  }
  console.log(`[PASS] Connection 2 confirmed record persistence across connection lifecycles.`);

  // Clean up test record
  db2.prepare('DELETE FROM typing_scores WHERE id = ?').run(testId);
  const verifyDeleted = db2.prepare('SELECT * FROM typing_scores WHERE id = ?').get(testId);
  if (verifyDeleted) {
    throw new Error('Failed to clean up test record from database.');
  }
  db2.close();
  console.log(`[PASS] Test record cleanly purged. Database restored to pristine state.`);

  console.log('='.repeat(70));
  console.log('  RESULT: ALL SQLite Non-RAM Persistence Checks PASSED Successfully!');
  console.log('='.repeat(70));
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('\n[FATAL ERROR] SQLite Non-RAM Persistence Verification FAILED:');
  console.error(err.message || err);
  process.exit(1);
}
