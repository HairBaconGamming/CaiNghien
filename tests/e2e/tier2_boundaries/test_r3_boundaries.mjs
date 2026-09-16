/**
 * Tier 2: Boundary & Corner Cases - R3 Mindfulness Typing Barrier
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse, assert } from '../test_framework.mjs';
import { validateMindfulnessTyping } from '../core_logic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/sample_pledges.json'), 'utf8'));

registry.setContext(2, 'R3: Mindfulness Typing Boundaries & Edge Conditions');

defineTest('T2_R3_01', 'Case sensitivity boundary: lowercase vs uppercase mismatch is rejected', () => {
  const pledge = fixtures.canonical_pledge;
  const wrongCase = fixtures.wrong_case_pledge;

  const result = validateMindfulnessTyping(pledge, wrongCase);
  assertFalse(result.valid, 'Casing mismatch must be rejected');
  assert(result.errorMessage.includes('Mismatch'), 'Error message must specify mismatch');
});

defineTest('T2_R3_02', 'Vietnamese Unicode normalization: NFD decomposed text normalizes to match NFC canonical pledge', () => {
  const pledge = fixtures.canonical_pledge;
  const nfdInput = fixtures.nfd_variant_pledge;

  const result = validateMindfulnessTyping(pledge, nfdInput);
  assertTrue(result.valid, 'NFD encoded Vietnamese diacritics must normalize to NFC and pass exact match');
  assertEqual(result.matchPercentage, 100);
});

defineTest('T2_R3_03', 'Whitespace boundary: extra trailing spaces or double spaces are strictly rejected', () => {
  const pledge = fixtures.canonical_pledge;
  const extraSpaces = pledge + '   ';

  const result = validateMindfulnessTyping(pledge, extraSpaces);
  assertFalse(result.valid, 'Input with trailing spaces must not be considered an exact match');
  assert(result.errorMessage.includes('exceeds pledge length'), 'Should report length excess');

  const doubleSpace = pledge.replace('giữ vững', 'giữ  vững');
  const resultDouble = validateMindfulnessTyping(pledge, doubleSpace);
  assertFalse(resultDouble.valid, 'Internal double spacing must be rejected');
});

defineTest('T2_R3_04', 'Tone mark / diacritic substitution (e.g. vững vs vung) is detected and rejected', () => {
  const pledge = fixtures.canonical_pledge;
  const toneTypo = fixtures.tone_substitution_typo;

  const result = validateMindfulnessTyping(pledge, toneTypo);
  assertFalse(result.valid, 'Tone mark omission/substitution must be detected');
  assert(result.errorIndex !== null, 'Error position must point to the substituted diacritic');
});

defineTest('T2_R3_05', 'Extreme input length (5,000 characters) rejected cleanly without hang or crash', () => {
  const pledge = fixtures.canonical_pledge;
  const massiveInput = pledge.repeat(25); // ~5,500 chars

  const start = Date.now();
  const result = validateMindfulnessTyping(pledge, massiveInput);
  const elapsed = Date.now() - start;

  assertFalse(result.valid, 'Massive input must be rejected');
  assert(elapsed < 100, `Comparison should execute in sub-100ms, took ${elapsed}ms`);
  assert(result.errorMessage.includes('exceeds pledge length'));
});
