# [CẢI CÁCH] Nhóm các thành phần theo Component để dễ bảo trì
APP_STYLE = """
/* =========================================================
   7. FOCUS-CENTRIC VIEW
======================================================== */
QLabel#GiantStatus {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1.5px;
}

QLabel#GiantSubstatus {
    color: #4B5563;
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 600;
    margin-top: 8px;
}

QLabel#GiantDangerStatus {
    color: #DC2626;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1.5px;
}

QPushButton#GiantButton {
    background: #111827;
    color: white;
    border: none;
    border-radius: 32px;
    padding: 16px 40px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
QPushButton#GiantButton:hover { background: #374151; }
QPushButton#GiantButton:pressed { background: #4B5563; }

QPushButton#GiantDangerButton {
    background: #DC2626;
    color: white;
    border: none;
    border-radius: 32px;
    padding: 16px 40px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
QPushButton#GiantDangerButton:hover { background: #B91C1C; }
QPushButton#GiantDangerButton:pressed { background: #991B1B; }

/* =========================================================
   1. GLOBAL & SHELL
======================================================== */
QMainWindow {
    background: #F3F4F6;
}

QWidget {
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
    font-size: 14px;
    color: #111827;
}

QLabel, QCheckBox {
    background: transparent;
}

QWidget#AppShell {
    background: #F3F4F6;
}

/* =========================================================
   2. TYPOGRAPHY & TEXT
======================================================== */
QLabel#PanelEyebrow, QLabel#PanelSection, QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: #6B7280;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.0px;
    text-transform: uppercase;
    padding-bottom: 4px;
}

QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: #374151;
}

QLabel#PanelTitle {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
}

QLabel#FocusTitle {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
}

QLabel#CardTitle {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 600;
}

QLabel#PanelSubtitle, QLabel#SideNoteBody, QLabel#PanelSummary {
    color: #4B5563;
    line-height: 1.5;
}

QLabel#CardSubtitle, QLabel#MutedLabel, QLabel#FocusTimeBody, QLabel#FocusBody {
    color: #6B7280;
}

QLabel#SideNoteTitle {
    font-weight: 600;
    color: #111827;
}

QLabel#FocusTimeCaption {
    font-weight: 600;
    color: #111827;
}

QLabel#FocusTime {
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    color: #111827;
    font-weight: 800;
}

QLabel#LockTitle {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 28px;
    font-weight: 700;
}

QLabel#LockSchedule {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    font-weight: 700;
}

QLabel#LockFormTitle {
    color: #111827;
    font-size: 16px;
    font-weight: 700;
    padding-bottom: 2px;
}

QLabel#LockMessage {
    color: #374151;
    font-size: 15px;
    line-height: 1.35;
}

QLabel#LockHint {
    color: #6B7280;
    font-size: 13px;
}

QLabel#LockBadge, QLabel#LockCardCaption {
    color: #4B5563;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
}

/* --- Mini Card Text --- */
QLabel#MiniCaption {
    color: #6B7280;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

QLabel#MiniValue {
    color: #111827;
    font-size: 18px;
    font-weight: 700;
}

/* =========================================================
   3. PANELS & CARDS
======================================================== */
QScrollArea#WorkspaceScroll, QScrollArea#SidePanelScroll, QWidget#Workspace {
    background: transparent;
    border: none;
}

QFrame#SidePanel {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
}

QFrame#Card {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
}

QFrame#InsetCard {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
}

QFrame#MiniCard {
    background: #F9FAFB;
    border-radius: 8px;
    border: 1px solid #E5E7EB;
}

QFrame#FocusBanner {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
}

QFrame#FocusTimeCard {
    background: #F9FAFB;
    border-radius: 12px;
    border: 1px solid #E5E7EB;
}

QFrame#SideNote {
    background: #F3F4F6;
    border-radius: 8px;
    border: 1px solid #E5E7EB;
}

QSplitter::handle:horizontal {
    background: transparent;
    width: 10px;
    margin: 10px 0;
}
QSplitter::handle:horizontal:hover {
    background: #E5E7EB;
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
    color: #6B7280;
    padding: 10px 16px;
    margin-right: 8px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid transparent;
    min-width: 0px;
}

QTabBar#WorkspaceTabBar::tab:hover {
    background: #E5E7EB;
    color: #111827;
}

QTabBar#WorkspaceTabBar::tab:selected {
    background: #FFFFFF;
    color: #111827;
    border: 1px solid #E5E7EB;
}

/* Lock Screen */
QWidget#LockScreen {
    background: #F3F4F6;
}

QScrollArea#LockScroll, QWidget#LockContainer, QWidget#LockViewport {
    background: transparent;
    border: none;
}

QFrame#LockShell {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
}

QFrame#LockInfoCard, QFrame#LockForm {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
}

QFrame#LockAccent {
    min-width: 72px;
    max-width: 72px;
    min-height: 4px;
    max-height: 4px;
    border: none;
    border-radius: 2px;
    background: #111827;
}

/* =========================================================
   4. BUTTONS
======================================================== */
QPushButton#PrimaryButton, QPushButton#LockPrimaryButton {
    background: #111827;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#PrimaryButton:hover, QPushButton#LockPrimaryButton:hover { background: #374151; }
QPushButton#PrimaryButton:pressed, QPushButton#LockPrimaryButton:pressed { background: #4B5563; }
QPushButton#LockPrimaryButton:disabled {
    background: #D1D5DB;
    color: #9CA3AF;
}

QPushButton#SecondaryButton {
    background: #FFFFFF;
    color: #111827;
    border: 1px solid #D1D5DB;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#SecondaryButton:hover { background: #F3F4F6; }
QPushButton#SecondaryButton:pressed { background: #E5E7EB; }

QPushButton#DangerButton {
    background: #FEF2F2;
    color: #DC2626;
    border: 1px solid #FECACA;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#DangerButton:hover { background: #FEE2E2; }
QPushButton#DangerButton:pressed { background: #FECACA; }

QToolButton#ModeButton {
    background: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 8px;
    padding: 16px 16px;
    text-align: left;
    color: #111827;
    font-size: 14px;
    font-weight: 600;
}
QToolButton#ModeButton:hover { background: #F3F4F6; }
QToolButton#ModeButton:checked {
    background: #F3F4F6;
    border: 2px solid #111827;
    color: #111827;
}

/* =========================================================
   5. INPUTS & CONTROLS
======================================================== */
QLineEdit, QTimeEdit, QSpinBox, QComboBox { min-height: 40px; }

QLineEdit#SoftInput, QTimeEdit#SoftInput, QSpinBox#SoftInput, QComboBox#SoftInput, QPlainTextEdit#CodeLikeEdit, QPlainTextEdit#LogOutput, QTextBrowser#HelpBrowser {
    background: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 8px;
    padding: 10px 14px;
    selection-background-color: #E5E7EB;
    selection-color: #111827;
    font-size: 14px;
}
QLineEdit#SoftInput:focus, QTimeEdit#SoftInput:focus, QSpinBox#SoftInput:focus, QComboBox#SoftInput:focus, QPlainTextEdit#CodeLikeEdit:focus, QPlainTextEdit#LogOutput:focus, QTextBrowser#HelpBrowser:focus {
    border: 2px solid #111827;
    padding: 9px 13px; /* Adjust padding to prevent jitter on border width change */
}
QPlainTextEdit#CodeLikeEdit, QPlainTextEdit#LogOutput, QTextBrowser#HelpBrowser {
    font-family: "Consolas", monospace;
    font-size: 13px;
    padding: 14px;
}

QLineEdit#LockInput {
    background: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 8px;
    padding: 0px 16px;
    min-height: 48px;
    color: #111827;
    font-size: 16px;
    font-weight: 600;
}
QLineEdit#LockInput:focus {
    border: 2px solid #111827;
}
QLineEdit#LockInput:disabled {
    background: #F3F4F6;
    color: #9CA3AF;
}

QToolButton#LockInputToggle {
    background: #F3F4F6;
    border: 1px solid #D1D5DB;
    border-radius: 8px;
    min-width: 60px;
    min-height: 48px;
    color: #4B5563;
    font-size: 13px;
    font-weight: 600;
}
QToolButton#LockInputToggle:hover { background: #E5E7EB; }
QToolButton#LockInputToggle:checked {
    background: #E5E7EB;
    border: 2px solid #111827;
    color: #111827;
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
    border-top: 6px solid #6B7280;
}
QComboBox#SoftInput QAbstractItemView {
    background: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 8px;
    padding: 4px;
    selection-background-color: #F3F4F6;
    selection-color: #111827;
}

QCheckBox#SoftCheck {
    color: #111827;
    font-size: 14px;
    font-weight: 500;
    spacing: 12px;
}
QCheckBox#SoftCheck::indicator {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #D1D5DB;
    background: #FFFFFF;
}
QCheckBox#SoftCheck::indicator:hover { border: 1px solid #111827; }
QCheckBox#SoftCheck::indicator:checked {
    background: #111827;
    border: 1px solid #111827;
    image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'></polyline></svg>");
}

QTimeEdit::up-button, QTimeEdit::down-button, QSpinBox::up-button, QSpinBox::down-button {
    background: transparent;
    border: none;
    width: 20px;
}

/* =========================================================
   6. MISC (BADGES, SCROLLBAR, MENU)
======================================================== */
QLabel#Badge {
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
QLabel#Badge[badgeVariant="secondary"] { background: #F3F4F6; color: #4B5563; }
QLabel#Badge[badgeVariant="warm"] { background: #FEF3C7; color: #92400E; }
QLabel#Badge[badgeVariant="danger"] { background: #FEE2E2; color: #991B1B; }
QLabel#Badge[badgeVariant="success"] { background: #D1FAE5; color: #065F46; }
QLabel#Badge[badgeVariant="soft"] { background: #E5E7EB; color: #374151; }

QScrollBar:vertical {
    background: transparent;
    width: 8px;
    margin: 0px;
}
QScrollBar::handle:vertical {
    background: #D1D5DB;
    border-radius: 4px;
    min-height: 40px;
    margin: 0px;
}
QScrollBar::handle:vertical:hover { background: #9CA3AF; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { background: transparent; border: none; height: 0px; }
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }

QMenu {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    padding: 4px;
    border-radius: 8px;
}
QMenu::item {
    padding: 8px 16px;
    border-radius: 4px;
    margin: 2px 0px;
}
QMenu::item:selected {
    background: #F3F4F6;
    color: #111827;
}

/* Căn chỉnh lại Feedback Text cho gọn gàng */
QLabel#LockFeedback {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 6px;
}
QLabel#LockFeedback[error="true"] { 
    color: #991B1B; 
    background: #FEE2E2;
}
QLabel#LockFeedback[error="false"] { 
    color: #065F46; 
    background: #D1FAE5;
}

/* =========================================================
   7. FOCUS-CENTRIC VIEW
======================================================== */
QLabel#GiantStatus {
    color: #111827;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1.5px;
}

QLabel#GiantSubstatus {
    color: #4B5563;
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 600;
    margin-top: 8px;
}

QPushButton#GiantButton {
    background: #111827;
    color: white;
    border: none;
    border-radius: 32px;
    padding: 16px 40px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
QPushButton#GiantButton:hover { background: #374151; }
QPushButton#GiantButton:pressed { background: #4B5563; }
"""
