/**
 * ============================================================================
 * EMPIRICAL CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS
 * Targets: R2 (Fixed Schedule), R3 (Mindfulness Typing Barrier), R4 (Focus Room Kiosk)
 * ============================================================================
 */

import { evaluateSchedule, validateMindfulnessTyping, createFocusRoomStateMachine } from './e2e/core_logic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    totalFailed++;
    failures.push(message);
    console.error(`  ❌ FAIL: ${message}`);
  } else {
    totalPassed++;
    console.log(`  ✔ PASS: ${message}`);
  }
}

// Function mirroring ScheduleModal.tsx lines 28-52
function isCurrentlyInScheduleModal(schedule, fakeNow) {
  if (!schedule || !schedule.enabled) return false;
  if (!schedule.start_time || !schedule.end_time) return false;

  const now = fakeNow || new Date();
  const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  if (!schedule.days_of_week.includes(currentDay)) {
    return false;
  }

  const [sHour, sMin] = schedule.start_time.split(':').map(Number);
  const [eHour, eMin] = schedule.end_time.split(':').map(Number);

  const startMinutes = sHour * 60 + sMin;
  const endMinutes = eHour * 60 + eMin;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

console.log('============================================================================');
console.log('  CHALLENGER 2 - ADVERSARIAL EMPIRICAL VERIFICATION HARNESS');
console.log('============================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: SCHEDULE EVALUATION (R2) ADVERSARIAL STRESS TESTS
// ----------------------------------------------------------------------------
console.log('--- Suite 1: R2 Fixed Schedule Evaluation Adversarial Stress Tests ---');

// 1.1 Overnight Shift Full 1440-minute scan (22:00 to 06:00)
{
  const sched = {
    enabled: true,
    start_time: '22:00',
    end_time: '06:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6] // all days
  };

  let activeCount = 0;
  let inactiveCount = 0;
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const res = evaluateSchedule(sched, timeStr, 1);
      const isExpectedActive = (h >= 22 || h < 6);
      if (res.active === isExpectedActive) {
        if (res.active) activeCount++;
        else inactiveCount++;
      } else {
        assert(false, `Overnight shift mismatch at ${timeStr}: got ${res.active}, expected ${isExpectedActive}`);
      }

      // Also verify ScheduleModal frontend helper matches
      const fakeDate = new Date(2026, 8, 16, h, m, 0); // Wednesday (3)
      const modalActive = isCurrentlyInScheduleModal(sched, fakeDate);
      if (modalActive !== isExpectedActive) {
        assert(false, `ScheduleModal.tsx helper mismatch at ${timeStr}: got ${modalActive}, expected ${isExpectedActive}`);
      }
    }
  }
  assert(activeCount === 8 * 60, `Overnight shift active minutes exactly 480 (8 hours), got ${activeCount}`);
  assert(inactiveCount === 16 * 60, `Overnight shift inactive minutes exactly 960 (16 hours), got ${inactiveCount}`);
}

// 1.2 Boundary minute precision for daytime shift (08:00 to 17:00)
{
  const sched = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [1, 2, 3, 4, 5]
  };

  assert(!evaluateSchedule(sched, '07:59', 1).active, '07:59 must be INACTIVE');
  assert(evaluateSchedule(sched, '08:00', 1).active, '08:00 must be ACTIVE');
  assert(evaluateSchedule(sched, '12:30', 1).active, '12:30 must be ACTIVE');
  assert(evaluateSchedule(sched, '16:59', 1).active, '16:59 must be ACTIVE');
  assert(!evaluateSchedule(sched, '17:00', 1).active, '17:00 exact boundary must be INACTIVE');
  assert(!evaluateSchedule(sched, '17:01', 1).active, '17:01 must be INACTIVE');
}

// 1.3 Empty days of week array
{
  const schedEmpty = {
    enabled: true,
    start_time: '00:00',
    end_time: '23:59',
    days_of_week: []
  };
  let anyActive = false;
  for (let d = 0; d < 7; d++) {
    if (evaluateSchedule(schedEmpty, '12:00', d).active) anyActive = true;
  }
  assert(!anyActive, 'Empty days_of_week must NEVER activate on any day of week');
}

// 1.4 Day of week indexing: 0-indexed (Sun=0) vs 1-indexed (Mon=1..Sun=7)
{
  // Test day 0 (Sunday)
  const schedSun = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [0]
  };
  assert(evaluateSchedule(schedSun, '10:00', 0).active, 'Sunday (0) must match schedule with [0]');
  assert(!evaluateSchedule(schedSun, '10:00', 1).active, 'Monday (1) must NOT match schedule with [0]');

  // Test day 6 (Saturday)
  const schedSat = {
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    days_of_week: [6]
  };
  assert(evaluateSchedule(schedSat, '10:00', 6).active, 'Saturday (6) must match schedule with [6]');
}

// 1.5 Malformed and inverted edge inputs
{
  const schedDisabled = { enabled: false, start_time: '08:00', end_time: '17:00', days_of_week: [1] };
  assert(!evaluateSchedule(schedDisabled, '10:00', 1).active, 'Disabled schedule must be inactive');

  const schedZeroDuration = { enabled: true, start_time: '10:00', end_time: '10:00', days_of_week: [1] };
  assert(!evaluateSchedule(schedZeroDuration, '10:00', 1).active, 'Zero-duration schedule (10:00-10:00) must be inactive');

  const schedBadTime = { enabled: true, start_time: '99:99', end_time: '17:00', days_of_week: [1] };
  assert(!evaluateSchedule(schedBadTime, '10:00', 1).active, 'Malformed start_time must be handled safely');
}

// ----------------------------------------------------------------------------
// SUITE 2: MINDFULNESS TYPING BARRIER (R3) ADVERSARIAL STRESS TESTS
// ----------------------------------------------------------------------------
console.log('\n--- Suite 2: R3 Mindfulness Typing Barrier Adversarial Stress Tests ---');

// The two pledge texts in the codebase:
// A. E2E Fixture Canonical Pledge (50 words)
const PLEDGE_E2E = "Tôi cam kết giữ vững kỷ luật, không đầu hàng trước cám dỗ nhất thời. Tôi hiểu rằng kiên trì là chìa khóa của tự do và thành công. Mỗi phút giây tập trung hôm nay xây dựng tương lai vững chắc. Tôi quyết tâm rèn luyện ý chí mình.";
// B. MindfulnessModal.tsx UI Pledge (51 words)
const PLEDGE_UI = "Tôi xin cam kết giữ vững tâm trí, không để những cám dỗ nhất thời làm suy giảm ý chí và làm gián đoạn mục tiêu dài hạn của bản thân. Tôi nhận thức rõ hành động này, chịu trách nhiệm hoàn toàn cho sự tiến bộ của mình hôm nay.";

// 2.1 Word count verification (~50 Vietnamese words)
{
  const wordsE2E = PLEDGE_E2E.trim().split(/\s+/).filter(Boolean);
  const wordsUI = PLEDGE_UI.trim().split(/\s+/).filter(Boolean);
  assert(wordsE2E.length === 50, `E2E canonical pledge word count is 50 words: got ${wordsE2E.length}`);
  assert(wordsUI.length >= 45 && wordsUI.length <= 55, `UI pledge word count is ~50 words (45-55): got ${wordsUI.length}`);
}

// 2.2 100% exact match
{
  const resE2E = validateMindfulnessTyping(PLEDGE_E2E, PLEDGE_E2E);
  assert(resE2E.valid === true && resE2E.matchPercentage === 100, 'E2E pledge matches 100%');

  const resUI = validateMindfulnessTyping(PLEDGE_UI, PLEDGE_UI);
  assert(resUI.valid === true && resUI.matchPercentage === 100, 'UI pledge matches 100%');
}

// 2.3 Single typo rejection at EVERY character position across pledge
{
  let allTyposRejected = true;
  for (let i = 0; i < PLEDGE_E2E.length; i++) {
    const corruptedChar = PLEDGE_E2E[i] === 'X' ? 'Y' : 'X';
    const corrupted = PLEDGE_E2E.slice(0, i) + corruptedChar + PLEDGE_E2E.slice(i + 1);
    const res = validateMindfulnessTyping(PLEDGE_E2E, corrupted);
    if (res.valid) {
      allTyposRejected = false;
      assert(false, `Failed to reject single typo at character position ${i}`);
      break;
    }
  }
  assert(allTyposRejected, `All ${PLEDGE_E2E.length} single-typo permutations strictly rejected at 100% of character positions`);
}

// 2.4 Trailing and internal whitespace rejection
{
  assert(!validateMindfulnessTyping(PLEDGE_E2E, PLEDGE_E2E + ' ').valid, 'Trailing space must be rejected');
  assert(!validateMindfulnessTyping(PLEDGE_E2E, PLEDGE_E2E + '\t').valid, 'Trailing tab must be rejected');
  assert(!validateMindfulnessTyping(PLEDGE_E2E, PLEDGE_E2E + '\n').valid, 'Trailing newline must be rejected');
  assert(!validateMindfulnessTyping(PLEDGE_E2E, ' ' + PLEDGE_E2E).valid, 'Leading space must be rejected');
  assert(!validateMindfulnessTyping(PLEDGE_E2E, PLEDGE_E2E.replace('cam kết', 'cam  kết')).valid, 'Internal double space must be rejected');
}

// 2.5 Diacritic substitutions & omission
{
  const diacriticTests = [
    { target: 'vững', bad: 'vung', desc: 'vững -> vung' },
    { target: 'kỷ luật', bad: 'ky luat', desc: 'kỷ luật -> ky luat' },
    { target: 'cám dỗ', bad: 'cam do', desc: 'cám dỗ -> cam do' },
    { target: 'ý chí', bad: 'y chi', desc: 'ý chí -> y chi' },
    { target: 'Tôi', bad: 'Toi', desc: 'Tôi -> Toi' },
    { target: 'thời', bad: 'thơi', desc: 'thời -> thơi (missing horn accent)' },
    { target: 'tiến bộ', bad: 'tiên bô', desc: 'tiến bộ -> tiên bô (wrong diacritics)' }
  ];

  for (const t of diacriticTests) {
    if (PLEDGE_E2E.includes(t.target)) {
      const replaced = PLEDGE_E2E.replace(t.target, t.bad);
      const res = validateMindfulnessTyping(PLEDGE_E2E, replaced);
      assert(!res.valid, `Diacritic substitution '${t.desc}' correctly rejected`);
    } else if (PLEDGE_UI.includes(t.target)) {
      const replaced = PLEDGE_UI.replace(t.target, t.bad);
      const res = validateMindfulnessTyping(PLEDGE_UI, replaced);
      assert(!res.valid, `Diacritic substitution '${t.desc}' correctly rejected`);
    }
  }
}

// 2.6 Unicode NFC vs NFD Normalization Analysis
{
  // Decomposed NFD variant of Vietnamese text
  const nfdInput = PLEDGE_E2E.normalize('NFD');
  const nfcInput = PLEDGE_E2E.normalize('NFC');

  // Verify that NFD and NFC have different code points / length in raw JS
  assert(nfdInput.length > nfcInput.length, `NFD representation has more code points (${nfdInput.length}) than NFC (${nfcInput.length})`);
  assert(nfdInput !== nfcInput, 'Raw JS strict equality (===) distinguishes NFC from NFD');

  // validateMindfulnessTyping normalizes NFC internally:
  const resNorm = validateMindfulnessTyping(PLEDGE_E2E, nfdInput);
  assert(resNorm.valid === true, 'validateMindfulnessTyping with NFC normalization successfully validates NFD input');

  // Check UI implementation in MindfulnessModal.tsx:
  // In MindfulnessModal.tsx line 45: `const exactMatch = typedText === MINDFULNESS_PLEDGE;`
  const rawModalMatch = (nfdInput === PLEDGE_E2E);
  console.log(`  ℹ OBSERVATION: MindfulnessModal.tsx performs raw 'typedText === MINDFULNESS_PLEDGE' (result: ${rawModalMatch}).`);
  if (!rawModalMatch) {
    console.log('  ⚠️ ADVERSARIAL OBSERVATION: In MindfulnessModal.tsx, typing with NFD decomposed Unicode would fail exact match unless normalized to NFC.');
  }
}

// 2.7 Paste Prevention Analysis
{
  // Read MindfulnessModal.tsx source code to verify anti-paste handlers
  const modalSrc = fs.readFileSync(path.resolve(__dirname, '../CaiNghien_Tauri/src/components/MindfulnessModal.tsx'), 'utf8');
  assert(modalSrc.includes('onPaste={handlePaste}'), 'MindfulnessModal attaches onPaste handler');
  assert(modalSrc.includes('e.preventDefault()'), 'handlePaste invokes e.preventDefault() to block clipboard paste');
  assert(modalSrc.includes("e.ctrlKey || e.metaKey") && modalSrc.includes("key === 'v' || e.key === 'V'"), 'handleKeyDown intercepts Ctrl+V and Meta+V');
  assert(modalSrc.includes('onCopy={(e) => e.preventDefault()}'), 'MindfulnessModal blocks onCopy');
  assert(modalSrc.includes('onCut={(e) => e.preventDefault()}'), 'MindfulnessModal blocks onCut');
}

// ----------------------------------------------------------------------------
// SUITE 3: FOCUS ROOM KIOSK MODE & KEYBOARD HOOK (R4) ADVERSARIAL TESTS
// ----------------------------------------------------------------------------
console.log('\n--- Suite 3: R4 Focus Room & Keyboard Hook Adversarial Verification ---');

// 3.1 State Machine Lifecycle
{
  const sm = createFocusRoomStateMachine();
  assert(!sm.getState().inFocusRoom, 'Initially not in focus room');
  assert(!sm.getState().hookInstalled, 'Initially hook not installed');
  assert(!sm.getState().taskbarHidden, 'Initially taskbar not hidden');

  // Enter
  sm.enter();
  assert(sm.getState().inFocusRoom, 'Entered focus room: inFocusRoom=true');
  assert(sm.getState().hookInstalled, 'Entered focus room: hookInstalled=true');
  assert(sm.getState().taskbarHidden, 'Entered focus room: taskbarHidden=true');

  // Exit
  sm.exit();
  assert(!sm.getState().inFocusRoom, 'Exited focus room: inFocusRoom=false');
  assert(!sm.getState().hookInstalled, 'Exited focus room: hookInstalled=false');
  assert(!sm.getState().taskbarHidden, 'Exited focus room: taskbarHidden=false');
}

// 3.2 Key suppression matrix
{
  const sm = createFocusRoomStateMachine();
  sm.enter();

  // Keys that MUST be suppressed
  const suppressedCombos = ['Alt+Tab', 'Win', 'LWin', 'RWin', 'Ctrl+Esc'];
  for (const combo of suppressedCombos) {
    assert(sm.isKeySuppressed(combo), `Escape shortcut '${combo}' MUST be suppressed by hook`);
  }

  // Keys that MUST NOT be suppressed (normal typing)
  const allowedKeys = ['A', 'B', 'Z', '0', '9', 'Space', 'Enter', 'Backspace', 'Shift', 'Period'];
  for (const key of allowedKeys) {
    assert(!sm.isKeySuppressed(key), `Typing key '${key}' MUST NOT be suppressed`);
  }

  // Outside focus room: even escape keys must NOT be suppressed
  sm.exit();
  for (const combo of suppressedCombos) {
    assert(!sm.isKeySuppressed(combo), `Escape shortcut '${combo}' MUST NOT be suppressed when outside Focus Room`);
  }
}

// 3.3 Static verification of Rust hooks.rs
{
  const hooksRs = fs.readFileSync(path.resolve(__dirname, '../CaiNghien_Tauri/src-tauri/src/hooks.rs'), 'utf8');

  // 1. WH_KEYBOARD_LL hook registration
  assert(hooksRs.includes('WH_KEYBOARD_LL'), 'hooks.rs uses WH_KEYBOARD_LL hook');

  // 2. Alt+Tab suppression: vk == VK_TAB && alt_down
  assert(hooksRs.includes('vk == VK_TAB && alt_down') && hooksRs.includes('return LRESULT(1);'), 'hooks.rs suppresses Alt+Tab (vk == VK_TAB && alt_down)');

  // 3. Windows keys suppression: vk == VK_LWIN || vk == VK_RWIN
  assert(hooksRs.includes('vk == VK_LWIN || vk == VK_RWIN') && hooksRs.includes('return LRESULT(1);'), 'hooks.rs suppresses Windows keys (LWIN and RWIN)');

  // 4. Ctrl+Esc suppression: vk == VK_ESCAPE && ctrl_down
  assert(hooksRs.includes('vk == VK_ESCAPE') && hooksRs.includes('ctrl_down') && hooksRs.includes('return LRESULT(1);'), 'hooks.rs suppresses Ctrl+Esc');

  // 5. Normal keys pass through to CallNextHookEx
  assert(hooksRs.includes('CallNextHookEx(Some(HHOOK::default()), code, wparam, lparam)'), 'hooks.rs calls CallNextHookEx for non-suppressed keys');

  // 6. Taskbar manipulation
  assert(hooksRs.includes('Shell_TrayWnd') && hooksRs.includes('Shell_SecondaryTrayWnd'), 'hooks.rs targets primary and secondary Windows taskbars');
  assert(hooksRs.includes('SW_HIDE') && hooksRs.includes('SW_SHOW'), 'hooks.rs toggles SW_HIDE and SW_SHOW');

  // 7. Panic hook safety
  assert(hooksRs.includes('DropGuard') && hooksRs.includes('init_panic_hook'), 'hooks.rs provides DropGuard and init_panic_hook for emergency recovery');
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n============================================================================');
console.log(`TOTAL ADVERSARIAL CHECKS: ${totalPassed + totalFailed}`);
console.log(`PASSED: ${totalPassed}`);
console.log(`FAILED: ${totalFailed}`);
console.log('============================================================================');

if (totalFailed > 0) {
  console.error('\nFailures encountered:');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
} else {
  console.log('\n>>> ALL ADVERSARIAL STRESS TESTS COMPLETED SUCCESSFULLY <<<');
  process.exit(0);
}
