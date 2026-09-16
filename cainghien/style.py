APP_STYLE = """
/* =========================================================
   MODERN PREMIUM DARK THEME
======================================================== */

/* --- 1. GLOBAL & SHELL --- */
QMainWindow {
    background: #0B0F19;
}

QWidget {
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
    font-size: 14px;
    color: #F8FAFC;
}

QLabel, QCheckBox {
    background: transparent;
}

QWidget#AppShell {
    background: #0B0F19;
}

/* --- 2. TYPOGRAPHY & TEXT --- */
QLabel#PanelEyebrow, QLabel#PanelSection, QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: #64748B;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding-bottom: 4px;
}

QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: #94A3B8;
}

QLabel#PanelTitle {
    color: #F8FAFC;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
}

QLabel#FocusTitle {
    color: #F8FAFC;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
}

QLabel#CardTitle {
    color: #F8FAFC;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 600;
}

QLabel#PanelSubtitle, QLabel#SideNoteBody, QLabel#PanelSummary {
    color: #94A3B8;
    line-height: 1.5;
}

QLabel#CardSubtitle, QLabel#MutedLabel, QLabel#FocusTimeBody, QLabel#FocusBody {
    color: #64748B;
}

QLabel#SideNoteTitle {
    font-weight: 600;
    color: #F8FAFC;
}

QLabel#FocusTimeCaption {
    font-weight: 600;
    color: #F8FAFC;
}

QLabel#FocusTime {
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    color: #F8FAFC;
    font-weight: 800;
}

QLabel#LockTitle {
    color: #F8FAFC;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 28px;
    font-weight: 700;
}

QLabel#LockSchedule {
    color: #3B82F6;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    font-weight: 700;
}

QLabel#LockFormTitle {
    color: #F8FAFC;
    font-size: 16px;
    font-weight: 700;
    padding-bottom: 2px;
}

QLabel#LockMessage {
    color: #E2E8F0;
    font-size: 15px;
    line-height: 1.35;
}

QLabel#LockHint {
    color: #94A3B8;
    font-size: 13px;
}

QLabel#LockBadge, QLabel#LockCardCaption {
    color: #64748B;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
}

/* Mini Card Text */
QLabel#MiniCaption {
    color: #64748B;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

QLabel#MiniValue {
    color: #F8FAFC;
    font-size: 18px;
    font-weight: 700;
}

/* --- 3. PANELS & CARDS --- */
QScrollArea#WorkspaceScroll, QScrollArea#SidePanelScroll, QWidget#Workspace {
    background: transparent;
    border: none;
}

QFrame#SidePanel {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
}

QFrame#Card {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
}

QFrame#InsetCard {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
}

QFrame#MiniCard {
    background: #1F2937;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

QFrame#FocusBanner {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
}

QFrame#FocusTimeCard {
    background: #1F2937;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

QFrame#SideNote {
    background: #1F2937;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

QSplitter::handle:horizontal {
    background: transparent;
    width: 10px;
    margin: 10px 0;
}
QSplitter::handle:horizontal:hover {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 5px;
}

QWidget#WorkspaceTabPage {
    background: transparent;
}

QTabWidget#WorkspaceTabs::pane {
    border: none;
    background: transparent;
    top: 10px;
}

QTabBar#WorkspaceTabBar {
    background: transparent;
}

QTabBar#WorkspaceTabBar::tab {
    background: transparent;
    color: #94A3B8;
    padding: 10px 16px;
    margin-right: 8px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid transparent;
    min-width: 0px;
}

QTabBar#WorkspaceTabBar::tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #F8FAFC;
}

QTabBar#WorkspaceTabBar::tab:selected {
    background: #1F2937;
    color: #F8FAFC;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Lock Screen */
QWidget#LockScreen {
    background: #0B0F19;
}

QScrollArea#LockScroll, QWidget#LockContainer, QWidget#LockViewport {
    background: transparent;
    border: none;
}

QFrame#LockShell {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
}

QFrame#LockInfoCard, QFrame#LockForm {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
}

QFrame#LockAccent {
    min-width: 72px;
    max-width: 72px;
    min-height: 4px;
    max-height: 4px;
    border: none;
    border-radius: 2px;
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #8B5CF6, stop:1 #3B82F6);
}

/* --- 4. BUTTONS --- */
QPushButton#PrimaryButton, QPushButton#LockPrimaryButton {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1, stop: 0 #8B5CF6, stop: 1 #3B82F6);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#PrimaryButton:hover, QPushButton#LockPrimaryButton:hover { 
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1, stop: 0 #9F7AEA, stop: 1 #60A5FA); 
}
QPushButton#PrimaryButton:pressed, QPushButton#LockPrimaryButton:pressed { 
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1, stop: 0 #7C3AED, stop: 1 #2563EB); 
}
QPushButton#LockPrimaryButton:disabled {
    background: #334155;
    color: #64748B;
}

QPushButton#SecondaryButton, QPushButton#GhostButton {
    background: #1F2937;
    color: #F8FAFC;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#SecondaryButton:hover, QPushButton#GhostButton:hover { background: #374151; }
QPushButton#SecondaryButton:pressed, QPushButton#GhostButton:pressed { background: #4B5563; }

QPushButton#GhostButton {
    background: transparent;
    border: none;
}
QPushButton#GhostButton:hover { background: rgba(255,255,255,0.05); }

QToolButton#GhostButton {
    background: transparent;
    color: #94A3B8;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 600;
}
QToolButton#GhostButton:hover { background: rgba(255,255,255,0.05); color: #F8FAFC; }

QPushButton#DangerButton {
    background: rgba(220, 38, 38, 0.1);
    color: #FCA5A5;
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#DangerButton:hover { background: rgba(220, 38, 38, 0.2); }
QPushButton#DangerButton:pressed { background: rgba(220, 38, 38, 0.3); }

QToolButton#ModeButton {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 16px 16px;
    text-align: left;
    color: #F8FAFC;
    font-size: 14px;
    font-weight: 600;
}
QToolButton#ModeButton:hover { background: #374151; }
QToolButton#ModeButton:checked {
    background: #1E293B;
    border: 2px solid #3B82F6;
    color: #60A5FA;
}

/* --- 5. INPUTS & CONTROLS --- */
QLineEdit, QTimeEdit, QSpinBox, QComboBox { min-height: 40px; }

QLineEdit#SoftInput, QTimeEdit#SoftInput, QSpinBox#SoftInput, QComboBox#SoftInput, QPlainTextEdit#CodeLikeEdit, QPlainTextEdit#LogOutput, QTextBrowser#HelpBrowser {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 14px;
    selection-background-color: #3B82F6;
    selection-color: #FFFFFF;
    color: #F8FAFC;
    font-size: 14px;
}
QLineEdit#SoftInput:focus, QTimeEdit#SoftInput:focus, QSpinBox#SoftInput:focus, QComboBox#SoftInput:focus, QPlainTextEdit#CodeLikeEdit:focus, QPlainTextEdit#LogOutput:focus, QTextBrowser#HelpBrowser:focus {
    border: 2px solid #3B82F6;
    padding: 9px 13px;
    background: #0F172A;
}
QPlainTextEdit#CodeLikeEdit, QPlainTextEdit#LogOutput, QTextBrowser#HelpBrowser {
    font-family: "Consolas", monospace;
    font-size: 13px;
    padding: 14px;
}

QLineEdit#LockInput {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0px 16px;
    min-height: 48px;
    color: #F8FAFC;
    font-size: 16px;
    font-weight: 600;
}
QLineEdit#LockInput:focus {
    border: 2px solid #8B5CF6;
    background: #0F172A;
}
QLineEdit#LockInput:disabled {
    background: #111827;
    color: #475569;
}

QToolButton#LockInputToggle {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    min-width: 60px;
    min-height: 48px;
    color: #94A3B8;
    font-size: 13px;
    font-weight: 600;
}
QToolButton#LockInputToggle:hover { background: #334155; }
QToolButton#LockInputToggle:checked {
    background: #1E293B;
    border: 2px solid #8B5CF6;
    color: #C4B5FD;
}

QComboBox#SoftInput {
    padding-right: 34px;
}
QComboBox#SoftInput::drop-down {
    border: none;
    width: 32px;
}
QComboBox#SoftInput::down-arrow {
    image: none;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #94A3B8;
}
QComboBox#SoftInput QAbstractItemView {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 4px;
    selection-background-color: #3B82F6;
    color: #F8FAFC;
}

QCheckBox#SoftCheck {
    color: #E2E8F0;
    font-size: 14px;
    font-weight: 500;
    spacing: 12px;
}
QCheckBox#SoftCheck::indicator {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.2);
    background: #1F2937;
}
QCheckBox#SoftCheck::indicator:hover { border: 1px solid #3B82F6; }
QCheckBox#SoftCheck::indicator:checked {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #8B5CF6, stop:1 #3B82F6);
    border: none;
    image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'></polyline></svg>");
}

QTimeEdit::up-button, QTimeEdit::down-button, QSpinBox::up-button, QSpinBox::down-button {
    background: transparent;
    border: none;
    width: 20px;
}

/* --- 6. MISC (BADGES, SCROLLBAR, MENU) --- */
QLabel#Badge {
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
QLabel#Badge[badgeVariant="secondary"] { background: #1E293B; color: #94A3B8; }
QLabel#Badge[badgeVariant="warm"] { background: rgba(245, 158, 11, 0.15); color: #FCD34D; }
QLabel#Badge[badgeVariant="danger"] { background: rgba(220, 38, 38, 0.15); color: #FCA5A5; }
QLabel#Badge[badgeVariant="success"] { background: rgba(16, 185, 129, 0.15); color: #6EE7B7; }
QLabel#Badge[badgeVariant="soft"] { background: rgba(255,255,255,0.05); color: #CBD5E1; }

QScrollBar:vertical {
    background: transparent;
    width: 8px;
    margin: 0px;
}
QScrollBar::handle:vertical {
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    min-height: 40px;
    margin: 0px;
}
QScrollBar::handle:vertical:hover { background: rgba(255,255,255,0.2); }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { background: transparent; border: none; height: 0px; }
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }

QMenu {
    background: #111827;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 4px;
    border-radius: 8px;
    color: #F8FAFC;
}
QMenu::item {
    padding: 8px 16px;
    border-radius: 4px;
    margin: 2px 0px;
}
QMenu::item:selected {
    background: rgba(255,255,255,0.05);
}

QLabel#LockFeedback {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 6px;
}
QLabel#LockFeedback[error="true"] { 
    color: #FCA5A5; 
    background: rgba(220, 38, 38, 0.15);
}
QLabel#LockFeedback[error="false"] { 
    color: #6EE7B7; 
    background: rgba(16, 185, 129, 0.15);
}

/* --- 7. FOCUS-CENTRIC VIEW --- */
QLabel#GiantStatus {
    color: #F8FAFC;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1.5px;
}

QLabel#GiantSubstatus {
    color: #94A3B8;
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 600;
    margin-top: 8px;
}

QPushButton#GiantButton {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1, stop: 0 #8B5CF6, stop: 1 #3B82F6);
    color: white;
    border: none;
    border-radius: 32px;
    padding: 16px 40px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
QPushButton#GiantButton:hover { 
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1, stop: 0 #9F7AEA, stop: 1 #60A5FA); 
}
QPushButton#GiantButton:pressed { 
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1, stop: 0 #7C3AED, stop: 1 #2563EB); 
}

QPushButton#GiantDangerButton {
    background: rgba(220, 38, 38, 0.15);
    color: #FCA5A5;
    border: 1px solid rgba(220, 38, 38, 0.3);
    border-radius: 32px;
    padding: 16px 40px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
QPushButton#GiantDangerButton:hover { background: rgba(220, 38, 38, 0.25); }
QPushButton#GiantDangerButton:pressed { background: rgba(220, 38, 38, 0.4); }

QComboBox#Dropdown {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 8px 24px 8px 16px;
    color: #F8FAFC;
    font-size: 16px;
    font-weight: 600;
}
QComboBox#Dropdown::drop-down {
    border: none;
    width: 32px;
}
QComboBox#Dropdown::down-arrow {
    image: none;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #94A3B8;
}
QComboBox#Dropdown QAbstractItemView {
    background: #1F2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 4px;
    selection-background-color: #3B82F6;
    color: #F8FAFC;
}
"""
