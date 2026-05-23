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
from .style import APP_STYLE



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

    if background:
        # On login/startup, enforce strict mode before the full management window finishes building.
        controller.start()
        app.processEvents()

    window = MainWindow(controller)
    show_window = not background
    if show_window and controller.requires_strict_access_password():
        show_window = window.request_strict_access(
            "Nhập mật khẩu để mở app trong khung giờ nghiêm khắc.",
            reevaluate=False,
        )

    if not background:
        controller.start()
    close_watcher = install_external_close_watcher(app, controller, window)
    app.setProperty("installer_close_watcher", close_watcher)
    if show_window:
        window.show()
    return app.exec()

if __name__ == "__main__":
    sys.exit(main())
