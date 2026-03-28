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
        self.setWindowTitle("Recovery key moi")
        self.resize(560, 320)

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(14)

        title = QtWidgets.QLabel("Hay luu recovery key nay o noi an toan")
        title.setObjectName("CardTitle")
        title.setWordWrap(True)
        layout.addWidget(title)

        subtitle = QtWidgets.QLabel(
            f"{reason} Recovery key dung de reset mat khau hoac uy quyen go cai dat neu ban quen mat khau strict."
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
            "Khong luu recovery key trong app. Neu ban mat ca mat khau lan recovery key, app chi con emergency recovery cooldown de tranh bi khoa vinh vien."
        )
        hint.setObjectName("MutedLabel")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        actions = QtWidgets.QHBoxLayout()
        copy_button = QtWidgets.QPushButton("Copy")
        copy_button.setObjectName("SecondaryButton")
        copy_button.clicked.connect(self._copy_code)
        actions.addWidget(copy_button)

        save_button = QtWidgets.QPushButton("Luu thanh file")
        save_button.setObjectName("SecondaryButton")
        save_button.clicked.connect(self._save_file)
        actions.addWidget(save_button)

        close_button = QtWidgets.QPushButton("Dong")
        close_button.setObjectName("PrimaryButton")
        close_button.clicked.connect(self.accept)
        actions.addWidget(close_button)
        layout.addLayout(actions)

    def _copy_code(self) -> None:
        QtGui.QGuiApplication.clipboard().setText(self._code)

    def _save_file(self) -> None:
        path, _ = QtWidgets.QFileDialog.getSaveFileName(
            self,
            "Luu recovery key",
            "CaiNghien-Recovery-Key.txt",
            "Text Files (*.txt)",
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("CaiNghien Focus Guard Recovery Key\n")
                handle.write(self._code + "\n")
        except OSError as exc:
            QtWidgets.QMessageBox.warning(self, "Khong luu duoc", str(exc))


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

        self.setWindowTitle("Go cai dat CaiNghien Focus Guard")
        self.resize(620, 460)

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(14)

        title = QtWidgets.QLabel("Trinh go cai dat an toan")
        title.setObjectName("CardTitle")
        layout.addWidget(title)

        subtitle = QtWidgets.QLabel(
            "App se dung enforcement, cho phep bo go cai dat chuan cua Windows tiep tuc, va co the xoa ca du lieu cuc bo neu ban muon."
        )
        subtitle.setObjectName("CardSubtitle")
        subtitle.setWordWrap(True)
        layout.addWidget(subtitle)

        checklist = QtWidgets.QLabel(
            "- Stop service va startup\n"
            "- Bo hosts block con ton\n"
            "- Chon giu hoac xoa du lieu local\n"
            "- Neu strict dang duoc arm, bat buoc xac thuc truoc khi go"
        )
        checklist.setObjectName("MutedLabel")
        checklist.setWordWrap(True)
        layout.addWidget(checklist)

        self.purge_checkbox = QtWidgets.QCheckBox("Xoa ca log, state, cache cap nhat va recovery approval file")
        self.purge_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.purge_checkbox)

        if require_auth:
            self.tabs = QtWidgets.QTabWidget()
            self.tabs.setObjectName("InsetCard")

            password_tab = QtWidgets.QWidget()
            password_layout = QtWidgets.QVBoxLayout(password_tab)
            password_layout.setContentsMargins(14, 14, 14, 14)
            password_layout.setSpacing(10)
            password_layout.addWidget(self._caption("Nhap mat khau strict"))
            self.password_edit = QtWidgets.QLineEdit()
            self.password_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
            self.password_edit.setPlaceholderText("Mat khau strict")
            self.password_edit.setObjectName("SoftInput")
            password_layout.addWidget(self.password_edit)
            self.tabs.addTab(password_tab, "Mat khau")

            recovery_tab = QtWidgets.QWidget()
            recovery_layout = QtWidgets.QVBoxLayout(recovery_tab)
            recovery_layout.setContentsMargins(14, 14, 14, 14)
            recovery_layout.setSpacing(10)
            recovery_layout.addWidget(self._caption("Dung recovery key neu ban quên mat khau"))
            self.recovery_edit = QtWidgets.QLineEdit()
            self.recovery_edit.setPlaceholderText("Recovery key")
            self.recovery_edit.setObjectName("SoftInput")
            recovery_layout.addWidget(self.recovery_edit)
            self.tabs.addTab(recovery_tab, "Recovery key")

            emergency_tab = QtWidgets.QWidget()
            emergency_layout = QtWidgets.QVBoxLayout(emergency_tab)
            emergency_layout.setContentsMargins(14, 14, 14, 14)
            emergency_layout.setSpacing(10)
            emergency_layout.addWidget(self._caption("Emergency recovery cooldown"))
            status_label = QtWidgets.QLabel(emergency_status)
            status_label.setObjectName("MutedLabel")
            status_label.setWordWrap(True)
            emergency_layout.addWidget(status_label)
            note = QtWidgets.QLabel(
                "Neu ban quen ca mat khau lan recovery key, day la duong lui an toan de tranh bi khoa vinh vien. Co che nay co do tre nen khong tro thanh duong lat tuc thi."
            )
            note.setObjectName("MutedLabel")
            note.setWordWrap(True)
            emergency_layout.addWidget(note)
            self.tabs.addTab(emergency_tab, "Emergency")

            layout.addWidget(self.tabs)
        else:
            self.tabs = None
            self.password_edit = None
            self.recovery_edit = None

        actions = QtWidgets.QHBoxLayout()
        actions.addStretch()

        self.start_emergency_button = QtWidgets.QPushButton("Bat recovery 7 ngay")
        self.start_emergency_button.setObjectName("SecondaryButton")
        self.start_emergency_button.clicked.connect(self._start_emergency)
        self.start_emergency_button.setVisible(require_auth)
        actions.addWidget(self.start_emergency_button)

        cancel_button = QtWidgets.QPushButton("Huy")
        cancel_button.setObjectName("SecondaryButton")
        cancel_button.clicked.connect(self.reject)
        actions.addWidget(cancel_button)

        continue_button = QtWidgets.QPushButton("Tiep tuc go cai dat")
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
                        "Chua den han",
                        "Emergency recovery chua toi han. Ban co the bat recovery 7 ngay roi quay lai sau.",
                    )
                    return
                result.use_emergency_recovery = True
        self.result_data = result
        self.accept()
