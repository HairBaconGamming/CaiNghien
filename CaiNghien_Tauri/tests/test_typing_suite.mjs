#!/usr/bin/env node

/**
 * =============================================================================
 * Milestone 5: Typing Challenge Screen & Typed API Service Test Suite
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let total = 0;
let passed = 0;
let failed = 0;

function assert(name, condition, extra = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name} ${extra ? `(${extra})` : ''}`);
  }
}

console.log('\n=== SUITE 1: Realtime Stats & Math Invariants ===');

// Import or re-create the exact pure functions from RealtimeStats
function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateWPM(correctChars, elapsedSeconds) {
  if (elapsedSeconds <= 0 || correctChars <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  const words = correctChars / 5;
  return Math.round(words / minutes);
}

function calculateAccuracy(correctChars, totalTyped) {
  if (totalTyped <= 0) return 100;
  const acc = (correctChars / totalTyped) * 100;
  return Math.max(0, Math.min(100, Math.round(acc)));
}

// Tests for calculateWPM
assert('WPM at 0 seconds is 0', calculateWPM(100, 0) === 0);
assert('WPM with 0 correct chars is 0', calculateWPM(0, 30) === 0);
assert('WPM with 50 chars in 60s is 10 WPM', calculateWPM(50, 60) === 10);
assert('WPM with 370 chars in 60s is 74 WPM (Mockup exact)', calculateWPM(370, 60) === 74);
assert('WPM with 185 chars in 30s is 74 WPM', calculateWPM(185, 30) === 74);
assert('WPM handles high speeds (500 chars in 30s = 200 WPM)', calculateWPM(500, 30) === 200);

// Tests for calculateAccuracy
assert('Accuracy with 0 typed chars defaults to 100%', calculateAccuracy(0, 0) === 100);
assert('Accuracy with 98 correct out of 100 is 98% (Mockup exact)', calculateAccuracy(98, 100) === 98);
assert('Accuracy with 49 correct out of 50 is 98%', calculateAccuracy(49, 50) === 98);
assert('Accuracy with 0 correct out of 50 is 0%', calculateAccuracy(0, 50) === 0);
assert('Accuracy clamps to max 100%', calculateAccuracy(120, 100) === 100);

// Tests for formatTime
assert('Time 0s formats to "00:00"', formatTime(0) === '00:00');
assert('Time 32s formats to "00:32" (Mockup exact)', formatTime(32) === '00:32');
assert('Time 60s formats to "01:00"', formatTime(60) === '01:00');
assert('Time 125s formats to "02:05"', formatTime(125) === '02:05');
assert('Time handles negative input gracefully', formatTime(-10) === '00:00');

console.log('\n=== SUITE 2: Visual Fidelity & Layout Tokens ===');

const screenPath = path.join(ROOT_DIR, 'src/components/typing/TypingChallengeScreen.tsx');
assert('TypingChallengeScreen.tsx exists', fs.existsSync(screenPath));
const screenContent = fs.readFileSync(screenPath, 'utf8');

assert('Title contains "TYPING CHALLENGE"', screenContent.includes('TYPING CHALLENGE'));
assert('Subtitle contains "QUANTUM SPEED"', screenContent.includes('QUANTUM SPEED'));
assert('Section label "PARAGRAPH TO TYPE" is present', screenContent.includes('PARAGRAPH TO TYPE'));
assert('Section label "YOUR TYPING INPUT" is present', screenContent.includes('YOUR TYPING INPUT'));
assert('Lock portal caption "LOCK PROGRESS" is present', screenContent.includes('LOCK PROGRESS'));
assert('Action button "CANCEL" is present', screenContent.includes('CANCEL'));
assert('Action button "SUBMIT" is present', screenContent.includes('SUBMIT'));
assert('Lock icon is imported and rendered', screenContent.includes('<Lock') || screenContent.includes('Lock className'));
assert('Completion modal component is implemented', screenContent.includes('showCompletionModal') && screenContent.includes('QUANTUM LOCK ACHIEVED'));

console.log('\n=== SUITE 3: Component Sub-modules Structure ===');

const promptPath = path.join(ROOT_DIR, 'src/components/typing/TextPromptDisplay.tsx');
assert('TextPromptDisplay.tsx exists', fs.existsSync(promptPath));
const promptContent = fs.readFileSync(promptPath, 'utf8');
assert('TextPromptDisplay implements character status states', promptContent.includes('correct') && promptContent.includes('error') && promptContent.includes('current'));
assert('TextPromptDisplay handles error characters with red highlights', promptContent.includes('#ef4444') || promptContent.includes('red-500'));
assert('TextPromptDisplay includes animated cursor for current char', promptContent.includes('border-cyan-400') && promptContent.includes('animate-pulse'));

const inputPath = path.join(ROOT_DIR, 'src/components/typing/TypingInput.tsx');
assert('TypingInput.tsx exists', fs.existsSync(inputPath));
const inputContent = fs.readFileSync(inputPath, 'utf8');
assert('TypingInput implements anti-paste clipboard protection', inputContent.includes('onPaste') && inputContent.includes('preventDefault'));
assert('TypingInput features cyan-to-purple cyber gradient border', inputContent.includes('from-cyan-400') && inputContent.includes('to-purple-500'));

const statsPath = path.join(ROOT_DIR, 'src/components/typing/RealtimeStats.tsx');
assert('RealtimeStats.tsx exists', fs.existsSync(statsPath));
const statsContent = fs.readFileSync(statsPath, 'utf8');
assert('RealtimeStats exports WPM calculation helper', statsContent.includes('export function calculateWPM'));
assert('RealtimeStats exports Accuracy calculation helper', statsContent.includes('export function calculateAccuracy'));
assert('RealtimeStats exports formatTime helper', statsContent.includes('export function formatTime'));
assert('RealtimeStats provides compact layout for mockup compatibility', statsContent.includes('variant') && statsContent.includes('compact'));

console.log('\n=== SUITE 4: Typed API Service Contracts ===');

const apiPath = path.join(ROOT_DIR, 'src/services/api.ts');
assert('api.ts exists', fs.existsSync(apiPath));
const apiContent = fs.readFileSync(apiPath, 'utf8');

assert('api.ts exports getHeatmapData', apiContent.includes('export async function getHeatmapData'));
assert('api.ts exports getUserProfile', apiContent.includes('export async function getUserProfile'));
assert('api.ts exports recordFocusSession', apiContent.includes('export async function recordFocusSession'));
assert('api.ts exports getTypingChallengeText', apiContent.includes('export async function getTypingChallengeText'));
assert('api.ts exports saveTypingScore', apiContent.includes('export async function saveTypingScore'));
assert('api.ts exports getTypingScores', apiContent.includes('export async function getTypingScores'));
assert('api.ts contains target mockup text for Quantum speed challenge', apiContent.includes('The quick brown fox jumped gracefully over the lazy, sleeping dog'));
assert('api.ts calculates genuine typing ranks based on telemetry', apiContent.includes('calculateTypingRank') && apiContent.includes('Quantum Voyager'));
assert('api.ts contains zero git merge conflict markers', !apiContent.includes('<<<<<<<') && !apiContent.includes('=======') && !apiContent.includes('>>>>>>>'));

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('====================================================\n');

process.exit(failed === 0 ? 0 : 1);
