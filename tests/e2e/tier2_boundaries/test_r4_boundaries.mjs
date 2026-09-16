/**
 * Tier 2: Boundary & Corner Cases - R4 Focus Room & Keyboard Hook
 */
import { defineTest, registry, assertEqual, assertTrue, assertFalse } from '../test_framework.mjs';
import { createFocusRoomStateMachine } from '../core_logic.mjs';

registry.setContext(2, 'R4: Focus Room Boundaries & Edge Conditions');

defineTest('T2_R4_01', 'Non-suppressed regular keys (alphanumeric, Space, Enter) are not intercepted by keyboard hook', () => {
  const room = createFocusRoomStateMachine();
  room.enter();

  assertFalse(room.isKeySuppressed('KeyA'), 'KeyA must not be suppressed');
  assertFalse(room.isKeySuppressed('Space'), 'Space must not be suppressed');
  assertFalse(room.isKeySuppressed('Enter'), 'Enter must not be suppressed');
  assertFalse(room.isKeySuppressed('Backspace'), 'Backspace must not be suppressed');
  assertFalse(room.isKeySuppressed('Digit1'), 'Digit1 must not be suppressed');
});

defineTest('T2_R4_02', 'Double entry idempotency: repeated enter calls maintain single active session', () => {
  const room = createFocusRoomStateMachine();
  room.enter();
  const secondEnter = room.enter();

  assertTrue(secondEnter.success, 'Second enter call must succeed');
  assertTrue(secondEnter.inFocusRoom, 'State must remain in Focus Room');
  assertTrue(secondEnter.hookInstalled, 'Hook must remain active');
});

defineTest('T2_R4_03', 'Double exit idempotency: repeated exit calls when already inactive succeed safely', () => {
  const room = createFocusRoomStateMachine();
  room.enter();
  room.exit();
  const secondExit = room.exit();

  assertTrue(secondExit.success, 'Second exit call must succeed');
  assertFalse(secondExit.inFocusRoom, 'inFocusRoom must remain false');
  assertFalse(secondExit.hookInstalled, 'hookInstalled must remain false');
});

defineTest('T2_R4_04', 'Safety panic recovery emulation releases keyboard hook and unhides taskbar', () => {
  const room = createFocusRoomStateMachine();
  room.enter();
  assertTrue(room.getState().hookInstalled);

  // Emulate panic hook / DropGuard execution
  const recovery = room.triggerPanicRecovery();
  assertTrue(recovery.recovered, 'Panic recovery must report success');

  const state = room.getState();
  assertFalse(state.hookInstalled, 'Hook must be uninstalled following panic recovery');
  assertFalse(state.taskbarHidden, 'Taskbar must be unhidden following panic recovery');
  assertFalse(state.inFocusRoom, 'Focus Room status must be cleared');
});

defineTest('T2_R4_05', 'Escape key attempts prior to entering Focus Room are not suppressed', () => {
  const room = createFocusRoomStateMachine();
  // Room has NOT been entered yet
  assertFalse(room.isKeySuppressed('Alt+Tab'), 'Alt+Tab must NOT be suppressed when outside Focus Room');
  assertFalse(room.isKeySuppressed('Win'), 'Win must NOT be suppressed when outside Focus Room');
  assertFalse(room.isKeySuppressed('Ctrl+Esc'), 'Ctrl+Esc must NOT be suppressed when outside Focus Room');
});
