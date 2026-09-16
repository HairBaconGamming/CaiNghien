/**
 * Tier 1: Feature Coverage - R3 Mindfulness Commitment Typing Barrier
 * Authoritative Source: ORIGINAL_REQUEST.md §R3 (~50 words Vietnamese pledge, 100% exact match)
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assert } from '../test_framework.mjs';
import { validateMindfulnessTyping } from '../core_logic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/sample_pledges.json'), 'utf8'));

registry.setContext(1, 'R3: Mindfulness Commitment Typing Barrier');

defineTest('T1_R3_01', 'Commitment pledge text conforms to target ~50 Vietnamese words requirement', () => {
  const words = fixtures.canonical_pledge.trim().split(/\s+/);
  const wordCount = words.length;

  // Requirement specifies approximately 50 words ("khoảng 50 chữ")
  assert(wordCount >= 45 && wordCount <= 55, `Expected word count around 50 (45-55), got ${wordCount}`);
  assertEqual(wordCount, fixtures.canonical_word_count, 'Word count must match fixture declaration');
});

defineTest('T1_R3_02', '100% exact character-for-character match succeeds and unlocks barrier', () => {
  const pledge = fixtures.canonical_pledge;
  const result = validateMindfulnessTyping(pledge, pledge);

  assertTrue(result.valid, 'Exact input must pass validation');
  assertEqual(result.matchPercentage, 100, 'Match percentage must be exactly 100%');
  assertEqual(result.errorIndex, null, 'Error index must be null on success');
  assertEqual(result.errorMessage, null, 'Error message must be null on success');
});

defineTest('T1_R3_03', 'Incomplete typing rejects unlock and reports incomplete character progress', () => {
  const pledge = fixtures.canonical_pledge;
  const partial = fixtures.partial_pledge_35_words;

  const result = validateMindfulnessTyping(pledge, partial);
  assertFalse(result.valid, 'Partial input must be rejected');
  assert(result.matchPercentage < 100, 'Partial match percentage must be strictly less than 100%');
  assert(result.errorMessage.includes('Incomplete'), 'Error message must indicate incomplete input');
});

defineTest('T1_R3_04', 'Single character typo anywhere in the pledge blocks unlock', () => {
  const pledge = fixtures.canonical_pledge;
  const typo = fixtures.typo_pledge_one_char;

  const result = validateMindfulnessTyping(pledge, typo);
  assertFalse(result.valid, 'Single typo must cause validation rejection');
  assert(result.errorIndex !== null, 'Error index must point to the mismatch position');
});

defineTest('T1_R3_05', 'Empty user input is rejected with zero match percentage', () => {
  const pledge = fixtures.canonical_pledge;
  const result = validateMindfulnessTyping(pledge, '');

  assertFalse(result.valid, 'Empty input must be rejected');
  assertEqual(result.matchPercentage, 0, 'Match percentage must be 0 for empty input');
  assertEqual(result.errorMessage, 'User input is empty');
});
