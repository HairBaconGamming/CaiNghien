from __future__ import annotations

import sys

from PySide6 import QtCore, QtGui, QtWidgets

from .config import ConfigStore
from .services.enforcement import EnforcementController
from .services.uninstall_flow import (
    clear_close_denied,
    clear_close_request,
    close_request_file_paths,
    write_uninstall_approval,
    write_close_denied,
)
from .ui.main_window import MainWindow
from .ui.uninstall_dialog import UninstallApprovalDialog

# [CẢI CÁCH] Nhóm các thành phần theo Component để dễ bảo trì
APP_STYLE = """
/* =========================================================
   1. GLOBAL & SHELL
========================================================= */
QMainWindow {
    background: #efe7dc;
}

QWidget {
    font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    font-size: 14px;
    color: #16221d;
}

/* SỬA LỖI UI CỐT LÕI: Ép nền trong suốt cho các thành phần chữ và check box */
QLabel, QCheckBox {
    background: transparent;
}

QWidget#AppShell {
    background: qradialgradient(
        cx: 0.08, cy: 0.08, radius: 1.2,
        fx: 0.08, fy: 0.08,
        stop: 0 #f7f1e7,
        stop: 0.45 #efe7dc,
        stop: 1 #e5ddd1
    );
}

/* =========================================================
   2. TYPOGRAPHY & TEXT
========================================================= */
QLabel#PanelEyebrow, QLabel#PanelSection, QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
}

QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: #886145; /* Chữ nổi bật trên nền sáng */
}

QLabel#PanelTitle, QLabel#LockTitle {
    color: #fff7ed;
    font-family: "Bahnschrift SemiBold", "Segoe UI Variable", sans-serif;
    font-size: 30px;
    font-weight: 700;
}

QLabel#FocusTitle {
    color: #1a2a22;
    font-family: "Bahnschrift SemiBold", "Segoe UI Variable", sans-serif;
    font-size: 28px;
    font-weight: 700;
}

QLabel#CardTitle {
    color: #192620;
    font-family: "Bahnschrift SemiBold", "Segoe UI Variable", sans-serif;
    font-size: 20px;
    font-weight: 700;
}

QLabel#PanelSubtitle, QLabel#PanelSummary, QLabel#SideNoteBody {
    color: rgba(248, 244, 238, 0.92);
}

QLabel#CardSubtitle, QLabel#MutedLabel, QLabel#FocusTimeBody, QLabel#FocusBody {
    color: #46544d;
}

QLabel#SideNoteTitle, QLabel#FocusTimeCaption {
    font-weight: bold;
    color: #1a2a22;
}
QLabel#SideNoteTitle { color: #fff7ed; }

QLabel#FocusTime {
    font-family: "Bahnschrift SemiBold", "Segoe UI Variable", sans-serif;
    font-size: 22px;
    color: #c06d31;
    font-weight: bold;
}

QLabel#LockBadge, QLabel#LockCardCaption {
    color: #ffca99;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
}

QLabel#LockFormTitle {
    color: #fff5ea;
    font-size: 16px;
    font-weight: 700;
    padding-bottom: 2px;
}

QLabel#LockMessage {
    color: #f3eadf;
    font-size: 15px;
    line-height: 1.35;
}

QLabel#LockSchedule {
    color: #fff8ef;
    font-family: "Bahnschrift SemiBold", "Segoe UI Variable", sans-serif;
    font-size: 24px;
    font-weight: 700;
}

QLabel#LockHint {
    color: rgba(231, 220, 207, 0.92);
    font-size: 13px;
}

/* --- Mini Card Text --- */
QLabel#MiniCaption {
    color: rgba(255, 247, 237, 0.74);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
}
QLabel#MiniValue {
    color: #fffdf9;
    font-size: 13px;
    font-weight: bold;
}

/* =========================================================
   3. PANELS & CARDS
========================================================= */
QScrollArea#WorkspaceScroll, QScrollArea#SidePanelScroll, QWidget#Workspace {
    background: transparent;
    border: none;
}

QFrame#SidePanel {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #17231f, stop:1 #243730);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 30px;
}

QFrame#Card {
    background: rgba(255, 251, 246, 0.94);
    border: 1px solid #d8cab7;
    border-radius: 24px;
}

QFrame#InsetCard {
    background: #f8f1e8;
    border: 1px solid #e2d7c8;
    border-radius: 18px;
}

QFrame#MiniCard {
    background: rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
}

QFrame#FocusBanner {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #fcf7f0, stop:1 #e5efe7);
    border: 1px solid #ddd0be;
    border-radius: 28px;
}

QFrame#FocusTimeCard {
    background: rgba(255,255,255,0.7);
    border-radius: 18px;
    border: 1px solid #e5ddd1;
}

QFrame#SideNote {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

QSplitter::handle:horizontal {
    background: transparent;
    width: 10px;
    margin: 10px 0;
}
QSplitter::handle:horizontal:hover {
    background: rgba(151, 121, 96, 0.16);
    border-radius: 5px;
}

QWidget#WorkspaceTabPage {
    background: transparent;
}

QTabWidget#WorkspaceTabs::pane {
    border: none;
    background: transparent;
    top: -2px;
}

QTabBar#WorkspaceTabBar {
    background: transparent;
}

QTabBar#WorkspaceTabBar::tab {
    background: rgba(255, 251, 246, 0.72);
    border: 1px solid #d8cab7;
    color: #6a5645;
    padding: 11px 18px;
    margin-right: 10px;
    min-width: 110px;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    font-size: 13px;
    font-weight: 700;
}

QTabBar#WorkspaceTabBar::tab:hover {
    background: rgba(255, 251, 246, 0.9);
    color: #2c231d;
}

QTabBar#WorkspaceTabBar::tab:selected {
    background: rgba(255, 251, 246, 0.98);
    color: #1a2a22;
    border-color: #ccb79d;
}

QWidget#LockScreen {
    background: qradialgradient(
        cx: 0.22, cy: 0.18, radius: 1.15,
        fx: 0.22, fy: 0.18,
        stop: 0 #21342d,
        stop: 0.42 #0f1815,
        stop: 1 #060a09
    );
}

QScrollArea#LockScroll, QWidget#LockContainer, QWidget#LockViewport {
    background: transparent;
    border: none;
}

QFrame#LockShell {
    background: qlineargradient(
        x1: 0, y1: 0, x2: 1, y2: 1,
        stop: 0 rgba(26, 37, 33, 0.96),
        stop: 1 rgba(13, 20, 17, 0.96)
    );
    border: 1px solid rgba(255, 248, 239, 0.10);
    border-radius: 30px;
}

QFrame#LockInfoCard, QFrame#LockForm {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 22px;
}

QFrame#LockAccent {
    min-width: 72px;
    max-width: 72px;
    min-height: 4px;
    max-height: 4px;
    border: none;
    border-radius: 2px;
    background: #d98946;
}

/* =========================================================
   4. BUTTONS
========================================================= */
QPushButton#PrimaryButton, QPushButton#LockPrimaryButton {
    background: #c06d31;
    color: white;
    border: none;
    border-radius: 18px;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 700;
}
QPushButton#LockPrimaryButton { border-radius: 16px; padding: 13px 18px; }
QPushButton#PrimaryButton:hover, QPushButton#LockPrimaryButton:hover { background: #aa5c25; }
QPushButton#PrimaryButton:pressed, QPushButton#LockPrimaryButton:pressed { background: #8e4c1e; }
QPushButton#LockPrimaryButton:disabled {
    background: rgba(123, 93, 70, 0.75);
    color: rgba(255, 247, 237, 0.58);
}

QPushButton#SecondaryButton {
    background: rgba(255, 255, 255, 0.07);
    color: #fff7ed;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 700;
}
QPushButton#SecondaryButton:hover { background: rgba(255, 255, 255, 0.12); }
QPushButton#SecondaryButton:pressed { background: rgba(255, 255, 255, 0.04); }

QPushButton#GhostButton {
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    border: none;
    padding: 8px;
    font-size: 13px;
    text-decoration: underline;
}
QPushButton#GhostButton:hover { color: rgba(255, 255, 255, 0.9); }

QPushButton#DangerButton {
    background: #ffd7d3;
    color: #932c22;
    border: none;
    border-radius: 18px;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 700;
}
QPushButton#DangerButton:hover { background: #ffc4be; }
QPushButton#DangerButton:pressed { background: #e8a9a2; }

QToolButton#ModeButton {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 22px;
    padding: 16px 12px; /* Giảm padding ngang từ 18 xuống 12 để có không gian cho chữ */
    text-align: left;
    color: #f9f3ea;
    font-size: 13px; /* Giảm nhẹ font size */
    font-weight: 700;
}
QToolButton#ModeButton:hover { background: rgba(255, 255, 255, 0.08); }
QToolButton#ModeButton:checked {
    background: rgba(196, 107, 44, 0.20);
    border: 1px solid rgba(238, 179, 130, 0.52);
    color: #fff5eb;
}

/* Làm sạch nút tăng giảm thời gian của QTimeEdit */
QTimeEdit::up-button, QTimeEdit::down-button, QSpinBox::up-button, QSpinBox::down-button {
    background: transparent;
    border: none;
    width: 16px;
}

/* =========================================================
   5. INPUTS & CONTROLS
========================================================= */
QLineEdit, QTimeEdit, QSpinBox, QComboBox { min-height: 44px; }

QLineEdit#SoftInput, QTimeEdit#SoftInput, QSpinBox#SoftInput, QComboBox#SoftInput, QPlainTextEdit#CodeLikeEdit, QPlainTextEdit#LogOutput, QTextBrowser#HelpBrowser {
    background: #fffaf4;
    border: 1px solid #d8cdbf;
    border-radius: 16px;
    padding: 12px 14px;
    selection-background-color: #bd6b2d;
    selection-color: white;
}
QLineEdit#SoftInput:focus, QTimeEdit#SoftInput:focus, QSpinBox#SoftInput:focus, QComboBox#SoftInput:focus, QPlainTextEdit#CodeLikeEdit:focus, QPlainTextEdit#LogOutput:focus, QTextBrowser#HelpBrowser:focus {
    border: 1px solid #b96a37;
    background: #ffffff;
}
QPlainTextEdit#CodeLikeEdit { font-family: "Consolas", monospace; }
QComboBox#SoftInput {
    padding-right: 34px;
}
QComboBox#SoftInput::drop-down {
    border: none;
    width: 28px;
    background: transparent;
}
QComboBox#SoftInput::down-arrow {
    image: none;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #7b5a43;
    margin-right: 10px;
}
QComboBox#SoftInput QAbstractItemView {
    background: #fffaf4;
    border: 1px solid #d8cdbf;
    border-radius: 12px;
    padding: 6px;
    selection-background-color: #f2e2d1;
    selection-color: #16221d;
}

QCheckBox#SoftCheck {
    color: #16221d;
    font-size: 14px;
    font-weight: 500;
    spacing: 12px;
}
QCheckBox#SoftCheck::indicator {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid #d8cdbf;
    background: #fffaf4;
}
QCheckBox#SoftCheck::indicator:hover { border: 2px solid #c06d31; }
QCheckBox#SoftCheck::indicator:checked {
    background: #c06d31;
    border: 2px solid #c06d31;
    image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'></polyline></svg>");
}

/* =========================================================
   6. MISC (BADGES, SCROLLBAR, MENU)
========================================================= */
QLabel#Badge {
    border-radius: 12px;
    padding: 6px 14px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
QLabel#Badge[badgeVariant="secondary"] { background: rgba(255, 255, 255, 0.11); color: #fff7ed; }
QLabel#Badge[badgeVariant="warm"] { background: #f2d1b5; color: #7b3f13; }
QLabel#Badge[badgeVariant="danger"] { background: #ffd7d3; color: #932c22; }
QLabel#Badge[badgeVariant="success"] { background: #d6f0dd; color: #205b37; }
QLabel#Badge[badgeVariant="soft"] { background: #e0e8e2; color: #264032; } /* FIX LỖI THIẾU SOFT BADGE */

QScrollBar:vertical {
    background: transparent;
    width: 10px;
    margin: 0px;
}
QScrollBar::handle:vertical {
    background: rgba(99, 114, 104, 0.35);
    border-radius: 5px;
    min-height: 30px;
    margin: 2px;
}
QScrollBar::handle:vertical:hover { background: rgba(99, 114, 104, 0.6); }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { background: transparent; border: none; height: 0px; }
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }

QMenu {
    background: #fffaf4;
    border: 1px solid #d9ccb8;
    padding: 6px;
    border-radius: 12px;
}
QMenu::item {
    padding: 8px 16px;
    border-radius: 6px;
    margin: 2px 0px;
}
QMenu::item:selected {
    background: #f1e4d5;
    color: #16221d;
}

/* =========================================================
   7. STRICT LOCK SCREEN OVERRIDES (UPGRADED GLASSMORPHISM)
========================================================= */
/* Form bọc ngoài cùng - Tạo hiệu ứng kính nổi 3D với ánh sáng viền */
QFrame#LockShell {
    background: qlineargradient(
        x1: 0, y1: 0, x2: 1, y2: 1,
        stop: 0 rgba(33, 52, 45, 0.85),
        stop: 1 rgba(10, 15, 13, 0.95)
    );
    /* Giả lập ánh sáng hắt từ góc trên trái xuống */
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    border-left: 1px solid rgba(255, 255, 255, 0.10);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    border-radius: 32px;
}

/* Các thẻ thông tin bên trong - Hiệu ứng kính chìm */
QFrame#LockInfoCard, QFrame#LockForm {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
}
QFrame#LockInfoCard:hover, QFrame#LockForm:hover {
    background: rgba(255, 255, 255, 0.05); /* Sáng lên một chút khi di chuột qua */
    border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Ô nhập mật khẩu - Đậm, sâu và gõ sướng mắt hơn */
QLineEdit#LockInput {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 0px 20px;
    min-height: 56px;
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
}
QLineEdit#LockInput:focus {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid #d98946;
    border-bottom: 3px solid #d98946;
}
QLineEdit#LockInput:disabled {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(255, 255, 255, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

/* Nút bấm chính - Ép height */
QPushButton#LockPrimaryButton {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 0, stop: 0 #d98946, stop: 1 #b55d22);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    padding: 0px 20px;
    min-height: 56px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
}
QPushButton#LockPrimaryButton:hover { 
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 0, stop: 0 #e59e60, stop: 1 #cc7439); 
}
QPushButton#LockPrimaryButton:pressed { 
    background: #934919; 
    border-top: 2px solid rgba(0, 0, 0, 0.2); /* Cảm giác lún nút khi bấm */
}
QPushButton#LockPrimaryButton:disabled {
    background: rgba(123, 93, 70, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 247, 237, 0.4);
}

/* Căn chỉnh lại Feedback Text cho gọn gàng */
QLabel#LockFeedback {
    font-size: 13px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
}
QLabel#LockFeedback[error="true"] { 
    color: #ffb4ab; 
    background: rgba(147, 44, 34, 0.2); /* Nền đỏ mờ cảnh báo mạnh hơn */
}
QLabel#LockFeedback[error="false"] { 
    color: #b7e4b0; 
}

/* =========================================================
   9. MASTER OVERRIDES (FLUENT & GLASS REFRESH)
========================================================= */
QMainWindow {
    background: #F4EBE1;
}

QWidget {
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
    font-size: 14px;
    color: #1A2621;
}

QLabel, QCheckBox {
    background: transparent;
}

QWidget#AppShell {
    background: qradialgradient(
        cx: 0.1, cy: 0.1, radius: 1.5,
        fx: 0.1, fy: 0.1,
        stop: 0 #FBF7F2,
        stop: 0.5 #F4EBE1,
        stop: 1 #EADDD0
    );
}

QLabel#PanelEyebrow, QLabel#PanelSection, QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: rgba(255, 255, 255, 0.6);
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding-bottom: 4px;
}

QLabel#FocusEyebrow, QLabel#SectionCaption, QLabel#InsetTitle {
    color: #8C6A53;
}

QLabel#PanelTitle {
    color: #FFFFFF;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

QLabel#FocusTitle {
    color: #111A16;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

QLabel#CardTitle {
    color: #16221C;
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 20px;
    font-weight: 700;
}

QLabel#PanelSubtitle, QLabel#SideNoteBody, QLabel#PanelSummary {
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
}

QLabel#CardSubtitle, QLabel#MutedLabel, QLabel#FocusTimeBody, QLabel#FocusBody {
    color: #5C6E65;
}

QLabel#SideNoteTitle {
    font-weight: 700;
    color: #FFFFFF;
}

QLabel#FocusTimeCaption {
    font-weight: 700;
    color: #16221C;
}

QLabel#FocusTime {
    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-size: 24px;
    color: #D36A22;
    font-weight: 800;
}

QFrame#SidePanel {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #16241E, stop:1 #0F1814);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 28px;
}

QFrame#Card {
    background: #FFFFFF;
    border: 1px solid #E2D7CB;
    border-radius: 24px;
    border-bottom: 2px solid #D5C9BD;
}

QFrame#InsetCard {
    background: #FAF5F0;
    border: 1px solid #EAE1D6;
    border-radius: 16px;
}

QFrame#MiniCard {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

QLabel#MiniCaption {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

QLabel#MiniValue {
    color: #FFFFFF;
    font-size: 16px;
    font-weight: bold;
}

QFrame#FocusBanner {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #FFFFFF, stop:1 #F2ECE4);
    border: 1px solid #E2D7CB;
    border-bottom: 2px solid #D5C9BD;
    border-radius: 28px;
}

QFrame#FocusTimeCard {
    background: rgba(255, 255, 255, 0.6);
    border-radius: 20px;
    border: 1px solid #EAE1D6;
}

QFrame#SideNote {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
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
    color: #7A8C83;
    padding: 10px 16px;
    margin-right: 8px;
    border-radius: 18px;
    font-size: 14px;
    font-weight: 700;
    border: 1px solid transparent;
    min-width: 0px;
}

QTabBar#WorkspaceTabBar::tab:hover {
    background: rgba(0, 0, 0, 0.04);
    color: #16221C;
}

QTabBar#WorkspaceTabBar::tab:selected {
    background: #FFFFFF;
    color: #16221C;
    border: 1px solid #E2D7CB;
    border-bottom: 2px solid #D5C9BD;
}

QPushButton#PrimaryButton {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #D36A22, stop:1 #B85616);
    color: white;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 18px;
    padding: 14px 24px;
    font-size: 14px;
    font-weight: 700;
}
QPushButton#PrimaryButton:hover { background: #E07833; }
QPushButton#PrimaryButton:pressed { background: #A34A10; }

QPushButton#SecondaryButton {
    background: rgba(255, 255, 255, 0.05);
    color: #FFFFFF;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 18px;
    padding: 14px 24px;
    font-size: 14px;
    font-weight: 700;
}
QPushButton#SecondaryButton:hover { background: rgba(255, 255, 255, 0.1); }
QPushButton#SecondaryButton:pressed { background: rgba(255, 255, 255, 0.02); }

QPushButton#DangerButton {
    background: #FFEDEA;
    color: #BA2D1D;
    border: 1px solid #F5C6C1;
    border-radius: 18px;
    padding: 14px 24px;
    font-size: 14px;
    font-weight: 700;
}
QPushButton#DangerButton:hover { background: #FADBD7; }
QPushButton#DangerButton:pressed { background: #E8B4AE; }

QToolButton#ModeButton {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 16px 16px;
    text-align: left;
    color: #FFFFFF;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
}
QToolButton#ModeButton:hover { background: rgba(255, 255, 255, 0.08); }
QToolButton#ModeButton:checked {
    background: rgba(211, 106, 34, 0.15);
    border: 1px solid rgba(211, 106, 34, 0.6);
    color: #FFF2E8;
}

QLineEdit#SoftInput, QTimeEdit#SoftInput, QSpinBox#SoftInput, QComboBox#SoftInput {
    background: #FAEBDE;
    border: 1px solid #E2D2C3;
    border-radius: 16px;
    padding: 12px 16px;
    selection-background-color: #D36A22;
    selection-color: white;
    font-size: 14px;
    min-height: 0px;
}
QLineEdit#SoftInput:focus, QTimeEdit#SoftInput:focus, QSpinBox#SoftInput:focus, QComboBox#SoftInput:focus {
    background: #FFFFFF;
    border: 1px solid #D36A22;
}

QPlainTextEdit#CodeLikeEdit, QPlainTextEdit#LogOutput, QTextBrowser#HelpBrowser {
    background: #FAEBDE;
    border: 1px solid #E2D2C3;
    border-radius: 16px;
    padding: 16px;
    font-family: "Consolas", monospace;
    font-size: 13px;
}
QPlainTextEdit#CodeLikeEdit:focus, QPlainTextEdit#LogOutput:focus, QTextBrowser#HelpBrowser:focus {
    background: #FFFFFF;
    border: 1px solid #D36A22;
}

QComboBox#SoftInput::drop-down { border: none; width: 36px; }
QComboBox#SoftInput::down-arrow {
    image: none;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #8C6A53;
}
QComboBox#SoftInput QAbstractItemView {
    background: #FFFFFF;
    border: 1px solid #E2D2C3;
    border-radius: 12px;
    padding: 8px;
}

QCheckBox#SoftCheck {
    color: #16221C;
    font-size: 14px;
    font-weight: 500;
    spacing: 12px;
}
QCheckBox#SoftCheck::indicator {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    border: 2px solid #D1C5B8;
    background: #FFFFFF;
}
QCheckBox#SoftCheck::indicator:hover { border: 2px solid #D36A22; }
QCheckBox#SoftCheck::indicator:checked {
    background: #D36A22;
    border: 2px solid #D36A22;
    image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'></polyline></svg>");
}

QTimeEdit::up-button, QTimeEdit::down-button, QSpinBox::up-button, QSpinBox::down-button {
    background: transparent;
    border: none;
    width: 24px;
}

QLabel#Badge {
    border-radius: 12px;
    padding: 6px 14px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
}
QLabel#Badge[badgeVariant="secondary"] { background: rgba(255, 255, 255, 0.1); color: #FFFFFF; }
QLabel#Badge[badgeVariant="warm"] { background: #FFE6D6; color: #9E4A10; }
QLabel#Badge[badgeVariant="danger"] { background: #FFEDEA; color: #BA2D1D; }
QLabel#Badge[badgeVariant="success"] { background: #E3F2E8; color: #2B6642; }
QLabel#Badge[badgeVariant="soft"] { background: #EDF2EF; color: #375443; }

QScrollBar:vertical {
    background: transparent;
    width: 12px;
    margin: 0px;
}
QScrollBar::handle:vertical {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    min-height: 40px;
    margin: 3px;
}
QScrollBar::handle:vertical:hover { background: rgba(0, 0, 0, 0.3); }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { background: transparent; border: none; height: 0px; }
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }

QMenu {
    background: #FFFFFF;
    border: 1px solid #E2D7CB;
    padding: 6px;
    border-radius: 12px;
}
QMenu::item {
    padding: 8px 16px;
    border-radius: 6px;
    margin: 2px 0px;
}
QMenu::item:selected {
    background: #F1E4D5;
    color: #16221D;
}
"""


def run_uninstall_guard(controller: EnforcementController) -> int:
    dialog = UninstallApprovalDialog(
        require_auth=controller.requires_uninstall_auth(),
        emergency_status=controller.emergency_recovery_status_text(),
        emergency_due=controller.emergency_recovery_due(),
        parent=None,
    )
    if dialog.exec() != QtWidgets.QDialog.DialogCode.Accepted:
        return 1

    result = dialog.result_data
    if result.start_emergency_recovery:
        _, message = controller.start_emergency_recovery()
        QtWidgets.QMessageBox.information(None, "Khôi phục khẩn cấp", message)
        return 2

    if controller.requires_uninstall_auth():
        if result.password:
            if not controller.verify_strict_password(result.password):
                QtWidgets.QMessageBox.warning(None, "Không thể gỡ cài đặt", "Mật khẩu nghiêm khắc không đúng.")
                return 3
        elif result.recovery_code:
            if not controller.verify_recovery_code(result.recovery_code):
                QtWidgets.QMessageBox.warning(None, "Không thể gỡ cài đặt", "Mã khôi phục không đúng.")
                return 4
        elif result.use_emergency_recovery:
            if not controller.emergency_recovery_due():
                QtWidgets.QMessageBox.warning(
                    None,
                    "Không thể gỡ cài đặt",
                    controller.emergency_recovery_status_text(),
                )
                return 5
        else:
            QtWidgets.QMessageBox.warning(None, "Chưa xác thực", "Cần xác thực trước khi gỡ cài đặt.")
            return 6

    write_uninstall_approval(controller.store, purge_data=result.purge_data)
    return 0


def install_external_close_watcher(
    app: QtWidgets.QApplication,
    controller: EnforcementController,
    window: MainWindow,
) -> QtCore.QTimer:
    timer = QtCore.QTimer(app)
    timer.setInterval(1000)

    def handle_close_request() -> None:
        request_found = any(path.exists() for path in close_request_file_paths(controller.store))
        if not request_found:
            return

        clear_close_request(controller.store)
        clear_close_denied(controller.store)
        if controller.requires_exit_password():
            reason = "Đang trong strict mode hoặc khóa thủ công nên installer chưa thể đóng ứng dụng."
            write_close_denied(controller.store, reason=reason)
            controller.store.append_event(
                "installer_close_blocked",
                reason,
                level="warning",
            )
            return

        controller.store.append_event(
            "installer_close_requested",
            "Installer đã yêu cầu app thoát để tiếp tục cập nhật.",
        )
        window._ignore_close_to_tray = True
        window.hide()
        controller.shutdown()
        app.quit()

    timer.timeout.connect(handle_close_request)
    timer.start()
    return timer

def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    background = "--background" in args or "--startup" in args
    uninstall_guard = "--prepare-uninstall" in args

    app = QtWidgets.QApplication([sys.argv[0], *args])
    app.setApplicationName("CaiNghiện Focus Guard")
    app.setOrganizationName("Codex")
    app.setStyle("Fusion") # Cần thiết để QSS hiển thị chuẩn trên mọi OS
    app.setWindowIcon(app.style().standardIcon(QtWidgets.QStyle.StandardPixmap.SP_ComputerIcon))
    
    app.setStyleSheet(APP_STYLE)
    
    # Font Segoe UI Variable rất đẹp trên Windows 11, nhưng cần fallback
    app.setFont(QtGui.QFont("Segoe UI Variable", 10))

    store = ConfigStore()
    controller = EnforcementController(store)
    if uninstall_guard:
        return run_uninstall_guard(controller)

    window = MainWindow(controller)
    show_window = not background
    if show_window and controller.requires_strict_access_password():
        show_window = window.request_strict_access(
            "Nhập mật khẩu để mở app trong khung giờ nghiêm khắc.",
            reevaluate=False,
        )

    controller.start()
    close_watcher = install_external_close_watcher(app, controller, window)
    app.setProperty("installer_close_watcher", close_watcher)
    if show_window:
        window.show()
    return app.exec()

if __name__ == "__main__":
    sys.exit(main())
