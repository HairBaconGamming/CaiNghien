from __future__ import annotations

import sys

from PySide6 import QtCore, QtGui, QtWidgets

from .config import ConfigStore
from .services.enforcement import EnforcementController
from .services.uninstall_flow import (
    clear_close_denied,
    clear_close_request,
    close_request_file_path,
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
    font-size: 34px;
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
}

QLabel#LockMessage {
    color: #f3eadf;
    font-size: 16px;
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
   7. STRICT LOCK SCREEN OVERRIDES
========================================================= */
QLineEdit#LockInput {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 16px;
    padding: 14px 18px;
    color: #ffffff;
    font-size: 16px;
    letter-spacing: 2px; /* Mật khẩu nên gĩãn chữ ra chút cho đẹp */
}
QLineEdit#LockInput:focus {
    border: 1px solid #d98946;
    background: rgba(255, 255, 255, 0.12);
}
QLineEdit#LockInput:disabled {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.52);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

QLabel#LockFeedback {
    font-size: 13px;
    font-weight: 600;
    padding-top: 2px;
}
QLabel#LockFeedback[error="true"] { 
    color: #ffb4ab; /* Đỏ ấm dễ đọc hơn trên nền tối */
}
QLabel#LockFeedback[error="false"] { 
    color: #b7e4b0; /* Xanh sáng hơn cho nền tối */
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
        request_path = close_request_file_path(controller.store)
        if not request_path.exists():
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
