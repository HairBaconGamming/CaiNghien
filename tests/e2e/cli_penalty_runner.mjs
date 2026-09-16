#!/usr/bin/env node
/**
 * CLI Penalty Runner & Validator for CaiNghien
 * Reads and applies the penalty reset operation directly to a target config file.
 * Used for testing CLI argument execution (--penalty) and AppData persistence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { applyPenalty, validateAppConfig } from './core_logic.mjs';

const args = process.argv.slice(2);
let targetConfigPath = null;

const pathArg = args.find(a => a.startsWith('--config='));
if (pathArg) {
  targetConfigPath = pathArg.split('=')[1];
} else if (args.includes('--penalty')) {
  // Default to Windows AppData if available
  const appData = process.env.APPDATA;
  if (appData) {
    targetConfigPath = path.join(appData, 'com.cainghien.desktop', 'config.json');
  }
}

if (!targetConfigPath) {
  console.error('Error: No target config path specified. Provide --config=<path> or --penalty.');
  process.exit(1);
}

if (!fs.existsSync(targetConfigPath)) {
  console.error(`Error: Target config file does not exist at ${targetConfigPath}`);
  process.exit(1);
}

try {
  const raw = fs.readFileSync(targetConfigPath, 'utf8');
  const cleaned = raw.replace(/^\uFEFF/, '');
  const parsed = JSON.parse(cleaned);

  let isWrapped = false;
  let configData = parsed;
  if (parsed && parsed.data && typeof parsed.data === 'object') {
    isWrapped = true;
    configData = parsed.data;
  }

  // Apply penalty
  const penalizedData = applyPenalty(configData);

  let outputContent;
  if (isWrapped) {
    parsed.data = penalizedData;
    parsed.saved_at = new Date().toISOString();
    outputContent = JSON.stringify(parsed, null, 2);
  } else {
    outputContent = JSON.stringify(penalizedData, null, 2);
  }

  fs.writeFileSync(targetConfigPath, outputContent, 'utf8');
  console.log(`Successfully applied penalty to ${targetConfigPath}`);
  console.log(`New Level: ${penalizedData.level}, XP: ${penalizedData.xp}, Streak: ${penalizedData.streak}, Violations: ${penalizedData.violations_count}`);
  process.exit(0);
} catch (err) {
  console.error(`Failed to apply penalty: ${err.message}`);
  process.exit(1);
}
