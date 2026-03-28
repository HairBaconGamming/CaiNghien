from __future__ import annotations

from dataclasses import dataclass

from PySide6 import QtCore, QtGui, QtWidgets


@dataclass(slots=True)
class UninstallApprovalResult:
    approved: bool
    purge_data: bool = False
    password: str = ""
    recovery_code: str = ""
    use_emergency_recovery: bool = False
    start_emergency_recovery: bool = False


class RecoveryCodeDialog(QtWidgets.QDialog):
    def __init__(self, code: str, *, reason: str, parent: QtWidgets.QWidget | None = None) -> None:
        super().__init__(parent)
        self._code = code
        self.setWindowTitle("Mã khôi phục mới")
        self.resize(560, 320)

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(14)

        title = QtWidgets.QLabel("Hãy lưu mã khôi phục này ở nơi an toàn")
        title.setObjectName("CardTitle")
        title.setWordWrap(True)
        layout.addWidget(title)

        subtitle = QtWidgets.QLabel(
            f"{reason} Mã khôi phục dùng để đặt lại mật khẩu hoặc ủy quyền gỡ cài đặt nếu bạn quên mật khẩu nghiêm khắc."
        )
        subtitle.setObjectName("CardSubtitle")
        subtitle.setWordWrap(True)
        layout.addWidget(subtitle)

        self.code_edit = QtWidgets.QPlainTextEdit()
        self.code_edit.setReadOnly(True)
        self.code_edit.setObjectName("CodeLikeEdit")
        self.code_edit.setPlainText(code)
        self.code_edit.setMaximumHeight(90)
        layout.addWidget(self.code_edit)

        hint = QtWidgets.QLabel(
            "Không lưu mã khôi phục trong app. Nếu bạn mất cả mật khẩu lẫn mã khôi phục, app chỉ còn khôi phục khẩn cấp có thời gian chờ để tránh bị khóa vĩnh viễn."
        )
        hint.setObjectName("MutedLabel")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        actions = QtWidgets.QHBoxLayout()
        copy_button = QtWidgets.QPushButton("Sao chép")
        copy_button.setObjectName("SecondaryButton")
        copy_button.clicked.connect(self._copy_code)
        actions.addWidget(copy_button)

        save_button = QtWidgets.QPushButton("Lưu thành file")
        save_button.setObjectName("SecondaryButton")
        save_button.clicked.connect(self._save_file)
        actions.addWidget(save_button)

        close_button = QtWidgets.QPushButton("Đóng")
        close_button.setObjectName("PrimaryButton")
        close_button.clicked.connect(self.accept)
        actions.addWidget(close_button)
        layout.addLayout(actions)

    def _copy_code(self) -> None:
        QtGui.QGuiApplication.clipboard().setText(self._code)

    def _save_file(self) -> None:
        path, _ = QtWidgets.QFileDialog.getSaveFileName(
            self,
            "Lưu mã khôi phục",
            "CaiNghien-Recovery-Key.txt",
            "Text Files (*.txt)",
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("Mã khôi phục CaiNghiện Focus Guard\n")
                handle.write(self._code + "\n")
        except OSError as exc:
            QtWidgets.QMessageBox.warning(self, "Không lưu được", str(exc))


class UninstallApprovalDialog(QtWidgets.QDialog):
    def __init__(
        self,
        *,
        require_auth: bool,
        emergency_status: str,
        emergency_due: bool,
        parent: QtWidgets.QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.result_data = UninstallApprovalResult(approved=False)
        self._require_auth = require_auth
        self._emergency_due = emergency_due

        self.setWindowTitle("Gỡ cài đặt CaiNghiện Focus Guard")
        self.resize(620, 460)

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(14)

        title = QtWidgets.QLabel("Trình gỡ cài đặt an toàn")
        title.setObjectName("CardTitle")
        layout.addWidget(title)

        subtitle = QtWidgets.QLabel(
            "App sẽ dừng enforcement, cho phép bộ gỡ cài đặt chuẩn của Windows tiếp tục, và có thể xóa cả dữ liệu cục bộ nếu bạn muốn."
        )
        subtitle.setObjectName("CardSubtitle")
        subtitle.setWordWrap(True)
        layout.addWidget(subtitle)

        checklist = QtWidgets.QLabel(
            "- Dừng dịch vụ và khởi động cùng Windows\n"
            "- Bỏ hosts block còn tồn\n"
            "- Chọn giữ hoặc xóa dữ liệu cục bộ\n"
            "- Nếu chế độ nghiêm khắc đang bật, bắt buộc xác thực trước khi gỡ"
        )
        checklist.setObjectName("MutedLabel")
        checklist.setWordWrap(True)
        layout.addWidget(checklist)

        self.purge_checkbox = QtWidgets.QCheckBox("Xóa cả log, state, cache cập nhật và file phê duyệt khôi phục")
        self.purge_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.purge_checkbox)

        if require_auth:
            self.tabs = QtWidgets.QTabWidget()
            self.tabs.setObjectName("InsetCard")

            password_tab = QtWidgets.QWidget()
            password_layout = QtWidgets.QVBoxLayout(password_tab)
            password_layout.setContentsMargins(14, 14, 14, 14)
            password_layout.setSpacing(10)
            password_layout.addWidget(self._caption("Nhập mật khẩu nghiêm khắc"))
            self.password_edit = QtWidgets.QLineEdit()
            self.password_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
            self.password_edit.setPlaceholderText("Mật khẩu nghiêm khắc")
            self.password_edit.setObjectName("SoftInput")
            password_layout.addWidget(self.password_edit)
            self.tabs.addTab(password_tab, "Mật khẩu")

            recovery_tab = QtWidgets.QWidget()
            recovery_layout = QtWidgets.QVBoxLayout(recovery_tab)
            recovery_layout.setContentsMargins(14, 14, 14, 14)
            recovery_layout.setSpacing(10)
            recovery_layout.addWidget(self._caption("Dùng mã khôi phục nếu bạn quên mật khẩu"))
            self.recovery_edit = QtWidgets.QLineEdit()
            self.recovery_edit.setPlaceholderText("Mã khôi phục")
            self.recovery_edit.setObjectName("SoftInput")
            recovery_layout.addWidget(self.recovery_edit)
            self.tabs.addTab(recovery_tab, "Mã khôi phục")

            emergency_tab = QtWidgets.QWidget()
            emergency_layout = QtWidgets.QVBoxLayout(emergency_tab)
            emergency_layout.setContentsMargins(14, 14, 14, 14)
            emergency_layout.setSpacing(10)
            emergency_layout.addWidget(self._caption("Thời gian chờ khôi phục khẩn cấp"))
            status_label = QtWidgets.QLabel(emergency_status)
            status_label.setObjectName("MutedLabel")
            status_label.setWordWrap(True)
            emergency_layout.addWidget(status_label)
            note = QtWidgets.QLabel(
                "Nếu bạn quên cả mật khẩu lẫn mã khôi phục, đây là đường lui an toàn để tránh bị khóa vĩnh viễn. Cơ chế này có độ trễ nên không trở thành đường lách tức thì."
            )
            note.setObjectName("MutedLabel")
            note.setWordWrap(True)
            emergency_layout.addWidget(note)
            self.tabs.addTab(emergency_tab, "Khẩn cấp")

            layout.addWidget(self.tabs)
        else:
            self.tabs = None
            self.password_edit = None
            self.recovery_edit = None

        actions = QtWidgets.QHBoxLayout()
        actions.addStretch()

        self.start_emergency_button = QtWidgets.QPushButton("Bật khôi phục 7 ngày")
        self.start_emergency_button.setObjectName("SecondaryButton")
        self.start_emergency_button.clicked.connect(self._start_emergency)
        self.start_emergency_button.setVisible(require_auth)
        actions.addWidget(self.start_emergency_button)

        cancel_button = QtWidgets.QPushButton("Hủy")
        cancel_button.setObjectName("SecondaryButton")
        cancel_button.clicked.connect(self.reject)
        actions.addWidget(cancel_button)

        continue_button = QtWidgets.QPushButton("Tiếp tục gỡ cài đặt")
        continue_button.setObjectName("PrimaryButton")
        continue_button.clicked.connect(self._approve)
        actions.addWidget(continue_button)
        layout.addLayout(actions)

    def _caption(self, text: str) -> QtWidgets.QLabel:
        label = QtWidgets.QLabel(text)
        label.setObjectName("SectionCaption")
        label.setWordWrap(True)
        return label

    def _start_emergency(self) -> None:
        self.result_data = UninstallApprovalResult(
            approved=False,
            purge_data=self.purge_checkbox.isChecked(),
            start_emergency_recovery=True,
        )
        self.accept()

    def _approve(self) -> None:
        result = UninstallApprovalResult(
            approved=True,
            purge_data=self.purge_checkbox.isChecked(),
        )
        if self._require_auth and self.tabs is not None:
            current_index = self.tabs.currentIndex()
            if current_index == 0:
                result.password = (self.password_edit.text() if self.password_edit else "").strip()
            elif current_index == 1:
                result.recovery_code = (self.recovery_edit.text() if self.recovery_edit else "").strip()
            else:
                if not self._emergency_due:
                    QtWidgets.QMessageBox.information(
                        self,
                        "Chưa đến hạn",
                        "Khôi phục khẩn cấp chưa tới hạn. Bạn có thể bật khôi phục 7 ngày rồi quay lại sau.",
                    )
                    return
                result.use_emergency_recovery = True
        self.result_data = result
        self.accept()
