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
        self.resize(760, 560)
        self.setStyleSheet("background: #F3F4F6;")

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(16)
        layout.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        
        layout.addStretch()

        title = QtWidgets.QLabel("GỠ CÀI ĐẶT")
        title.setObjectName("GiantDangerStatus")
        title.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        subtitle = QtWidgets.QLabel(
            "App sẽ dừng bảo vệ, gỡ bỏ các thay đổi hệ thống và xóa toàn bộ dữ liệu cài đặt."
        )
        subtitle.setObjectName("CardSubtitle")
        subtitle.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        subtitle.setWordWrap(True)
        layout.addWidget(subtitle)
        
        layout.addSpacing(20)

        self.purge_checkbox = QtWidgets.QCheckBox("Xóa cả lịch sử, cấu hình và nhật ký")
        self.purge_checkbox.setObjectName("SoftCheck")
        self.purge_checkbox.setChecked(True)
        cb_layout = QtWidgets.QHBoxLayout()
        cb_layout.addStretch()
        cb_layout.addWidget(self.purge_checkbox)
        cb_layout.addStretch()
        layout.addLayout(cb_layout)
        
        layout.addSpacing(20)

        if require_auth:
            self.auth_stack = QtWidgets.QStackedWidget()
            self.auth_stack.setObjectName("AppShell")
            
            # 0: Mật khẩu
            pw_page = QtWidgets.QWidget()
            pw_layout = QtWidgets.QVBoxLayout(pw_page)
            pw_layout.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
            self.password_edit = QtWidgets.QLineEdit()
            self.password_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
            self.password_edit.setPlaceholderText("Nhập mật khẩu nghiêm khắc")
            self.password_edit.setObjectName("SoftInput")
            self.password_edit.setMinimumHeight(48)
            pw_layout.addWidget(self.password_edit)
            
            btn_row = QtWidgets.QHBoxLayout()
            btn_row.addStretch()
            sw_rec = QtWidgets.QPushButton("Dùng mã khôi phục")
            sw_rec.setObjectName("GhostButton")
            sw_rec.clicked.connect(lambda: self.auth_stack.setCurrentIndex(1))
            btn_row.addWidget(sw_rec)
            sw_emg = QtWidgets.QPushButton("Khôi phục khẩn cấp")
            sw_emg.setObjectName("GhostButton")
            sw_emg.clicked.connect(lambda: self.auth_stack.setCurrentIndex(2))
            btn_row.addWidget(sw_emg)
            btn_row.addStretch()
            pw_layout.addLayout(btn_row)
            self.auth_stack.addWidget(pw_page)

            # 1: Mã khôi phục
            rec_page = QtWidgets.QWidget()
            rec_layout = QtWidgets.QVBoxLayout(rec_page)
            rec_layout.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
            self.recovery_edit = QtWidgets.QLineEdit()
            self.recovery_edit.setPlaceholderText("Nhập mã khôi phục gồm 24 ký tự")
            self.recovery_edit.setObjectName("SoftInput")
            self.recovery_edit.setMinimumHeight(48)
            rec_layout.addWidget(self.recovery_edit)
            
            rec_btn_row = QtWidgets.QHBoxLayout()
            rec_btn_row.addStretch()
            sw_pw2 = QtWidgets.QPushButton("Quay lại Mật khẩu")
            sw_pw2.setObjectName("GhostButton")
            sw_pw2.clicked.connect(lambda: self.auth_stack.setCurrentIndex(0))
            rec_btn_row.addWidget(sw_pw2)
            rec_btn_row.addStretch()
            rec_layout.addLayout(rec_btn_row)
            self.auth_stack.addWidget(rec_page)

            # 2: Khẩn cấp
            emg_page = QtWidgets.QWidget()
            emg_layout = QtWidgets.QVBoxLayout(emg_page)
            emg_layout.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
            emg_lbl = QtWidgets.QLabel(emergency_status)
            emg_lbl.setObjectName("MutedLabel")
            emg_lbl.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
            emg_lbl.setWordWrap(True)
            emg_layout.addWidget(emg_lbl)
            
            emg_btn_row = QtWidgets.QHBoxLayout()
            emg_btn_row.addStretch()
            
            self.start_emergency_button = QtWidgets.QPushButton("Bật đếm ngược")
            self.start_emergency_button.setObjectName("SecondaryButton")
            self.start_emergency_button.clicked.connect(self._start_emergency)
            emg_btn_row.addWidget(self.start_emergency_button)
            
            sw_pw3 = QtWidgets.QPushButton("Quay lại Mật khẩu")
            sw_pw3.setObjectName("GhostButton")
            sw_pw3.clicked.connect(lambda: self.auth_stack.setCurrentIndex(0))
            emg_btn_row.addWidget(sw_pw3)
            emg_btn_row.addStretch()
            emg_layout.addLayout(emg_btn_row)
            self.auth_stack.addWidget(emg_page)

            layout.addWidget(self.auth_stack)
            self.tabs = self.auth_stack  # Tạm map để không lỗi hàm _approve cũ
        else:
            self.tabs = None
            self.password_edit = None
            self.recovery_edit = None
            self.auth_stack = None

        layout.addSpacing(40)

        actions = QtWidgets.QHBoxLayout()
        actions.addStretch()

        self.continue_button = QtWidgets.QPushButton("XÁC NHẬN GỠ")
        self.continue_button.setObjectName("GiantDangerButton")
        self.continue_button.setCursor(QtGui.QCursor(QtCore.Qt.CursorShape.PointingHandCursor))
        self.continue_button.clicked.connect(self._approve)
        actions.addWidget(self.continue_button)

        cancel_button = QtWidgets.QPushButton("Hủy")
        cancel_button.setObjectName("GiantButton")
        cancel_button.setCursor(QtGui.QCursor(QtCore.Qt.CursorShape.PointingHandCursor))
        cancel_button.clicked.connect(self.reject)
        actions.addWidget(cancel_button)
        
        actions.addStretch()
        layout.addLayout(actions)
        layout.addStretch()

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
        if self._require_auth and self.auth_stack is not None:
            current_index = self.auth_stack.currentIndex()
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
