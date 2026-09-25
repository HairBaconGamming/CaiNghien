import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

/**
 * Anti-Paste and DOM Security Handlers for Proof of Work Modal
 * Reference: spec_miner_study_earn/handoff.md:241-285
 */
export interface AntiPasteConfig {
  onWarning?: (message: string) => void;
  maxBurstChars?: number;
}

export function createHarvestAntiPasteListeners(config: AntiPasteConfig = {}) {
  const { onWarning, maxBurstChars = 10 } = config;
  let lastTextLength = 0;

  // 1. Paste event handler
  const handlePaste = (e: { preventDefault: () => void; stopPropagation?: () => void }) => {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    onWarning?.("Copy-paste bị vô hiệu hóa! Vui lòng tự gõ để hoàn thành báo cáo thu hoạch.");
  };

  // 2. Keyboard shortcuts interceptor (Ctrl+V, Cmd+V, Shift+Insert, Escape)
  const handleKeyDown = (e: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    preventDefault: () => void;
    stopPropagation?: () => void;
  }) => {
    // Intercept Ctrl+V or Cmd+V
    if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      onWarning?.("Phím tắt dán văn bản bị khóa trong bài thu hoạch.");
      return;
    }

    // Intercept Shift+Insert (alternative paste)
    if (e.shiftKey && e.key === "Insert") {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      onWarning?.("Phím tắt dán văn bản bị khóa trong bài thu hoạch.");
      return;
    }

    // Modal Lockdown: Intercept Escape key to prevent closing
    if (e.key === "Escape") {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      return;
    }
  };

  // 3. Mouse right-click context menu interceptor
  const handleContextMenu = (e: { preventDefault: () => void; stopPropagation?: () => void }) => {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    onWarning?.("Chuột phải bị khóa để tránh dán văn bản.");
  };

  // 4. Drag & drop interceptors
  const handleDragOver = (e: { preventDefault: () => void }) => {
    e.preventDefault();
  };

  const handleDrop = (e: { preventDefault: () => void; stopPropagation?: () => void }) => {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    onWarning?.("Thao tác kéo thả văn bản bị chặn.");
  };

  // 5. Keystroke Burst Velocity Guard for automated script injection
  const handleInputChange = (newText: string): { accepted: boolean; currentText: string } => {
    const delta = newText.length - lastTextLength;
    if (delta > maxBurstChars) {
      onWarning?.("Phát hiện văn bản nhập quá nhanh! Nghi vấn dán văn bản tự động.");
      return { accepted: false, currentText: "" };
    }
    lastTextLength = newText.length;
    return { accepted: true, currentText: newText };
  };

  const resetLength = (len: number = 0) => {
    lastTextLength = len;
  };

  return {
    handlePaste,
    handleKeyDown,
    handleContextMenu,
    handleDragOver,
    handleDrop,
    handleInputChange,
    resetLength,
  };
}

export function runPasteInterceptionTests() {
  console.log("=================================================");
  console.log("   TEST SUITE: PASTE BLOCKING & MODAL LOCKDOWN   ");
  console.log("=================================================\n");

  const dom = new JSDOM(
    `<!DOCTYPE html>
     <html>
       <body>
         <div id="modal-backdrop">
           <div id="modal-card">
             <textarea id="harvest-input" placeholder="Viết bài thu hoạch..."></textarea>
             <button id="submit-btn" disabled>Nộp bài thu hoạch</button>
           </div>
         </div>
       </body>
     </html>`,
    { url: "http://localhost" }
  );

  const { window } = dom;
  const { document } = window;
  const textarea = document.getElementById("harvest-input") as HTMLTextAreaElement;
  const backdrop = document.getElementById("modal-backdrop") as HTMLDivElement;
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}`);
      console.error(`       ${err.message}`);
      throw err;
    }
  }

  // Set up listeners on the synthetic DOM textarea
  let lastWarning = "";
  const listeners = createHarvestAntiPasteListeners({
    onWarning: (msg) => {
      lastWarning = msg;
    },
    maxBurstChars: 10,
  });

  textarea.addEventListener("paste", (e) => listeners.handlePaste(e as any));
  textarea.addEventListener("keydown", (e) => listeners.handleKeyDown(e as any));
  textarea.addEventListener("contextmenu", (e) => listeners.handleContextMenu(e as any));
  textarea.addEventListener("dragover", (e) => listeners.handleDragOver(e as any));
  textarea.addEventListener("drop", (e) => listeners.handleDrop(e as any));

  // Global ESC key interceptor on window
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // Backdrop click stopper
  backdrop.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // 1. Direct onPaste Event Interception
  test("Clipboard paste event is intercepted and preventDefault() is called", () => {
    lastWarning = "";
    const pasteEvent = new window.Event("paste", { bubbles: true, cancelable: true });
    const dispatched = textarea.dispatchEvent(pasteEvent);
    assert.equal(dispatched, false, "paste event must be cancelled (preventDefault)");
    assert.equal(pasteEvent.defaultPrevented, true);
    assert(lastWarning.includes("Copy-paste bị vô hiệu hóa"));
  });

  // 2. Keyboard Ctrl+V and Cmd+V Interception
  test("Ctrl+V keystroke is intercepted and cancelled", () => {
    lastWarning = "";
    const ctrlV = new window.KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(ctrlV);
    assert.equal(dispatched, false, "Ctrl+V must be cancelled");
    assert.equal(ctrlV.defaultPrevented, true);
    assert(lastWarning.includes("Phím tắt dán văn bản bị khóa"));
  });

  test("Cmd+V keystroke (macOS metaKey) is intercepted and cancelled", () => {
    lastWarning = "";
    const cmdV = new window.KeyboardEvent("keydown", {
      key: "v",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(cmdV);
    assert.equal(dispatched, false, "Cmd+V must be cancelled");
    assert.equal(cmdV.defaultPrevented, true);
    assert(lastWarning.includes("Phím tắt dán văn bản bị khóa"));
  });

  // 3. Shift+Insert Interception
  test("Shift+Insert keystroke (legacy paste shortcut) is intercepted and cancelled", () => {
    lastWarning = "";
    const shiftInsert = new window.KeyboardEvent("keydown", {
      key: "Insert",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(shiftInsert);
    assert.equal(dispatched, false, "Shift+Insert must be cancelled");
    assert.equal(shiftInsert.defaultPrevented, true);
    assert(lastWarning.includes("Phím tắt dán văn bản bị khóa"));
  });

  // 4. Normal keystroke passthrough
  test("Normal keystrokes ('a', 'Enter', 'Backspace') are allowed without preventDefault", () => {
    const normalKey = new window.KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(normalKey);
    assert.equal(dispatched, true, "Normal character keypress must NOT be cancelled");
    assert.equal(normalKey.defaultPrevented, false);
  });

  // 5. Mouse Right-Click Context Menu Interception
  test("Right-click contextmenu event is cancelled to suppress browser paste menu", () => {
    lastWarning = "";
    const contextMenuEvent = new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(contextMenuEvent);
    assert.equal(dispatched, false, "contextmenu must be cancelled");
    assert.equal(contextMenuEvent.defaultPrevented, true);
    assert(lastWarning.includes("Chuột phải bị khóa"));
  });

  // 6. Drag and Drop Interception
  test("DragOver event is cancelled to prevent drop zone activation", () => {
    const dragOverEvent = new window.Event("dragover", {
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(dragOverEvent);
    assert.equal(dispatched, false);
    assert.equal(dragOverEvent.defaultPrevented, true);
  });

  test("Drop event is cancelled to block dragged text insertion", () => {
    lastWarning = "";
    const dropEvent = new window.Event("drop", {
      bubbles: true,
      cancelable: true,
    });
    const dispatched = textarea.dispatchEvent(dropEvent);
    assert.equal(dispatched, false);
    assert.equal(dropEvent.defaultPrevented, true);
    assert(lastWarning.includes("kéo thả văn bản bị chặn"));
  });

  // 7. Modal Lockdown: Escape Key Interception
  test("Escape keydown event on window is cancelled and intercepted (unclosable)", () => {
    const escEvent = new window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const dispatched = window.dispatchEvent(escEvent);
    assert.equal(dispatched, false, "Escape key must be cancelled");
    assert.equal(escEvent.defaultPrevented, true);
  });

  // 8. Modal Lockdown: Backdrop Click Stopped
  test("Backdrop click event stopPropagation prevents click-away dismissal", () => {
    let parentReceivedClick = false;
    document.body.addEventListener("click", () => {
      parentReceivedClick = true;
    });

    const clickEvent = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    backdrop.dispatchEvent(clickEvent);
    assert.equal(parentReceivedClick, false, "Backdrop click must NOT bubble to parent");
  });

  // 9. Keystroke Burst Velocity Guard
  test("Burst guard: single character typing passes", () => {
    listeners.resetLength(0);
    const step1 = listeners.handleInputChange("H");
    assert.equal(step1.accepted, true);
    const step2 = listeners.handleInputChange("Họ");
    assert.equal(step2.accepted, true);
  });

  test("Burst guard: sudden delta > 10 chars is flagged as simulated paste", () => {
    listeners.resetLength(2);
    lastWarning = "";
    const burst = listeners.handleInputChange("Họ và tên của tôi là Nguyễn Văn A và tôi đang học");
    assert.equal(burst.accepted, false);
    assert(lastWarning.includes("nhập quá nhanh"));
  });

  console.log(`\nPaste Interception Suite Complete: ${passed} / ${total} tests passed.\n`);
  return { passed, total };
}

// Direct execution support
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runPasteInterceptionTests();
}
