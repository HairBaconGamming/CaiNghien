/**
 * Tier 1: Feature Coverage - R4 Focus Room Kiosk & Keyboard Hook
 * Authoritative Source: ORIGINAL_REQUEST.md §R4, PROJECT.md §Code Layout & §Interface Contracts
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse } from '../test_framework.mjs';
import { createFocusRoomStateMachine } from '../core_logic.mjs';

registry.setContext(1, 'R4: Focus Room & Keyboard Hook');

defineTest('T1_R4_01', 'Focus room entry engages keyboard hook and flags taskbar as hidden', () => {
  const room = createFocusRoomStateMachine();
  const enterResult = room.enter();

  assertTrue(enterResult.success, 'Focus room enter must succeed');
  assertTrue(enterResult.inFocusRoom, 'inFocusRoom must be true');
  assertTrue(enterResult.hookInstalled, 'hookInstalled must be true');
  assertTrue(enterResult.taskbarHidden, 'taskbarHidden must be true');
});

defineTest('T1_R4_02', 'Focus room exit disengages keyboard hook and restores Windows taskbar', () => {
  const room = createFocusRoomStateMachine();
  room.enter();
  const exitResult = room.exit();

  assertTrue(exitResult.success, 'Focus room exit must succeed');
  assertFalse(exitResult.inFocusRoom, 'inFocusRoom must be false after exit');
  assertFalse(exitResult.hookInstalled, 'hookInstalled must be false after exit');
  assertFalse(exitResult.taskbarHidden, 'taskbarHidden must be false after exit');
});

defineTest('T1_R4_03', 'Low-level keyboard hook actively suppresses Alt+Tab escape shortcut', () => {
  const room = createFocusRoomStateMachine();
  room.enter();

  const isSuppressed = room.isKeySuppressed('Alt+Tab');
  assertTrue(isSuppressed, 'Alt+Tab must be suppressed during Focus Room');
});

defineTest('T1_R4_04', 'Low-level keyboard hook actively suppresses Windows keys (LWin and RWin)', () => {
  const room = createFocusRoomStateMachine();
  room.enter();

  assertTrue(room.isKeySuppressed('LWin'), 'LWin must be suppressed during Focus Room');
  assertTrue(room.isKeySuppressed('RWin'), 'RWin must be suppressed during Focus Room');
  assertTrue(room.isKeySuppressed('Win'), 'Win generic identifier must be suppressed');
});

defineTest('T1_R4_05', 'Low-level keyboard hook actively suppresses Ctrl+Esc escape shortcut', () => {
  const room = createFocusRoomStateMachine();
  room.enter();

  const isSuppressed = room.isKeySuppressed('Ctrl+Esc');
  assertTrue(isSuppressed, 'Ctrl+Esc must be suppressed during Focus Room');
});
