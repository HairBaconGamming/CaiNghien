from __future__ import annotations

from PySide6 import QtCore, QtGui, QtWidgets

class StrictLockWindow(QtWidgets.QWidget):
    password_submitted = QtCore.Signal(str)

    def __init__(self, *, interactive: bool) -> None:
        super().__init__()
        self.interactive = interactive
        self.penalty_seconds = 0
        self.penalty_timer = QtCore.QTimer()
        self.penalty_timer.timeout.connect(self._tick_penalty)
        self._setup_window()
        self._build_ui()

    def _setup_window(self) -> None:
        self.setObjectName("LockScreen")
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowFlags(
            QtCore.Qt.WindowType.FramelessWindowHint
            | QtCore.Qt.WindowType.WindowStaysOnTopHint
            | QtCore.Qt.WindowType.Tool
        )
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, False)
        self.setCursor(QtCore.Qt.CursorShape.ArrowCursor)

    def _build_ui(self) -> None:
        root = QtWidgets.QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        scroll = QtWidgets.QScrollArea()
        scroll.setObjectName("LockScroll")
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.viewport().setObjectName("LockViewport")
        root.addWidget(scroll)

        container = QtWidgets.QWidget()
        container.setObjectName("LockContainer")
        scroll.setWidget(container)

        container_layout = QtWidgets.QVBoxLayout(container)
        container_layout.setContentsMargins(16, 16, 16, 16)
        container_layout.setSpacing(0)
        container_layout.addStretch()

        shell = QtWidgets.QFrame()
        shell.setObjectName("LockShell")
        shell.setMaximumWidth(860)
        shell.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Preferred,
            QtWidgets.QSizePolicy.Policy.Maximum,
        )
        shell_layout = QtWidgets.QVBoxLayout(shell)
        shell_layout.setContentsMargins(30, 28, 30, 30)
        shell_layout.setSpacing(14)

        badge = QtWidgets.QLabel("CHẾ ĐỘ NGHIÊM KHẮC")
        badge.setObjectName("LockBadge")
        shell_layout.addWidget(badge, 0, QtCore.Qt.AlignmentFlag.AlignLeft)

        title = QtWidgets.QLabel("Máy tính đang nằm trong khung giờ nghiêm khắc")
        title.setObjectName("LockTitle")
        title.setWordWrap(True)
        title.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Preferred,
            QtWidgets.QSizePolicy.Policy.Maximum,
        )
        shell_layout.addWidget(title)

        accent = QtWidgets.QFrame()
        accent.setObjectName("LockAccent")
        shell_layout.addWidget(accent, 0, QtCore.Qt.AlignmentFlag.AlignLeft)

        self.message_label = QtWidgets.QLabel(
            "Trong khung giờ này, giao diện giải trí và đường vòng sử dụng máy tính đã bị khóa. "
            "Nếu muốn tắt chế độ nghiêm khắc, bạn phải nhập đúng mật khẩu đã đặt trước đó."
        )
        self.message_label.setWordWrap(True)
        self.message_label.setObjectName("LockMessage")
        shell_layout.addWidget(self.message_label)

        info_card = QtWidgets.QFrame()
        info_card.setObjectName("LockInfoCard")
        info_layout = QtWidgets.QVBoxLayout(info_card)
        info_layout.setContentsMargins(18, 16, 18, 16)
        info_layout.setSpacing(6)

        schedule_caption = QtWidgets.QLabel("KHUNG GIỜ ĐANG ÁP DỤNG")
        schedule_caption.setObjectName("LockCardCaption")
        info_layout.addWidget(schedule_caption)

        self.schedule_label = QtWidgets.QLabel()
        self.schedule_label.setObjectName("LockSchedule")
        self.schedule_label.setWordWrap(True)
        info_layout.addWidget(self.schedule_label)

        self.lock_hint_label = QtWidgets.QLabel(
            "Sai mật khẩu sẽ bị khóa thử lại 60 giây."
        )
        self.lock_hint_label.setObjectName("LockHint")
        self.lock_hint_label.setWordWrap(True)
        info_layout.addWidget(self.lock_hint_label)

        shell_layout.addWidget(info_card)

        if self.interactive:
            form = QtWidgets.QFrame()
            form.setObjectName("LockForm")
            form_layout = QtWidgets.QVBoxLayout(form)
            form_layout.setContentsMargins(18, 18, 18, 18)
            form_layout.setSpacing(10)

            form_title = QtWidgets.QLabel("Nhập mật khẩu để tắt chế độ nghiêm khắc")
            form_title.setObjectName("LockFormTitle")
            form_title.setWordWrap(True)
            form_title.setSizePolicy(
                QtWidgets.QSizePolicy.Policy.Preferred,
                QtWidgets.QSizePolicy.Policy.Maximum,
            )
            form_title.setMinimumHeight(form_title.fontMetrics().lineSpacing() * 2 + 6)
            form_layout.addWidget(form_title)

            self.password_edit = QtWidgets.QLineEdit()
            self.password_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
            self.password_edit.setPlaceholderText("Mật khẩu nghiêm khắc")
            self.password_edit.setObjectName("LockInput")
            self.password_edit.setMinimumHeight(52)
            self.password_edit.setSizePolicy(
                QtWidgets.QSizePolicy.Policy.Expanding,
                QtWidgets.QSizePolicy.Policy.Fixed,
            )
            self.password_edit.returnPressed.connect(self._submit_password)
            form_layout.addWidget(self.password_edit)

            self.feedback_label = QtWidgets.QLabel("")
            self.feedback_label.setObjectName("LockFeedback")
            self.feedback_label.setProperty("error", "false")
            self.feedback_label.setWordWrap(True)
            self.feedback_label.setMinimumHeight(self.feedback_label.fontMetrics().lineSpacing() + 6)
            self.feedback_label.setSizePolicy(
                QtWidgets.QSizePolicy.Policy.Preferred,
                QtWidgets.QSizePolicy.Policy.Maximum,
            )
            form_layout.addWidget(self.feedback_label)

            submit_button = QtWidgets.QPushButton("Tắt chế độ nghiêm khắc")
            submit_button.clicked.connect(self._submit_password)
            submit_button.setObjectName("LockPrimaryButton")
            submit_button.setMinimumHeight(48)
            submit_button.setSizePolicy(
                QtWidgets.QSizePolicy.Policy.Expanding,
                QtWidgets.QSizePolicy.Policy.Fixed,
            )
            self.submit_button = submit_button
            form_layout.addWidget(submit_button)

            shell_layout.addWidget(form)

        container_layout.addWidget(shell, 0, QtCore.Qt.AlignmentFlag.AlignHCenter)
        container_layout.addStretch()

    def refresh_copy(
        self,
        *,
        schedule_text: str,
        message_text: str,
        hint_text: str,
        form_title: str | None = None,
        reset_form: bool = False,
    ) -> None:
        self.schedule_label.setText(schedule_text)
        self.message_label.setText(message_text)
        self.lock_hint_label.setText(hint_text)
        if self.interactive and form_title and hasattr(self, "submit_button"):
            parent_layout = self.submit_button.parentWidget().layout()
            title_widget = parent_layout.itemAt(0).widget() if parent_layout else None
            if isinstance(title_widget, QtWidgets.QLabel):
                title_widget.setText(form_title)
        if reset_form and self.interactive and hasattr(self, "feedback_label"):
            self.feedback_label.setText("")
            self.password_edit.clear()
            self.password_edit.setEnabled(True)
            self.submit_button.setEnabled(True)
            self.password_edit.setFocus()

    def show_feedback(self, message: str, *, error: bool) -> None:
        if not self.interactive or not hasattr(self, "feedback_label"):
            return
        self.feedback_label.setText(message)
        self.feedback_label.setProperty("error", "true" if error else "false")
        self.feedback_label.style().unpolish(self.feedback_label)
        self.feedback_label.style().polish(self.feedback_label)
        if error:
            self.password_edit.clear()
            self.penalty_seconds = 60
            self.password_edit.setEnabled(False)
            self.submit_button.setEnabled(False)
            self.penalty_timer.start(1000)

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        event.ignore()

    def keyPressEvent(self, event: QtGui.QKeyEvent) -> None:
        if (
            event.key() == QtCore.Qt.Key.Key_F4
            and event.modifiers() & QtCore.Qt.KeyboardModifier.AltModifier
        ):
            event.ignore()
            return
        if event.key() == QtCore.Qt.Key.Key_Escape:
            event.ignore()
            return
        super().keyPressEvent(event)

    def _tick_penalty(self) -> None:
        self.penalty_seconds -= 1
        if self.penalty_seconds <= 0:
            self.penalty_timer.stop()
            self.password_edit.setEnabled(True)
            self.submit_button.setEnabled(True)
            self.feedback_label.setText("")
            self.password_edit.setFocus()
        else:
            self.feedback_label.setText(
                f"Chờ {self.penalty_seconds}s trước khi thử lại"
            )

    def _submit_password(self) -> None:
        if not self.interactive:
            return
        self.password_submitted.emit(self.password_edit.text())


class StrictLockManager(QtCore.QObject):
    unlock_attempted = QtCore.Signal(str)

    def __init__(self) -> None:
        super().__init__()
        self._windows: list[StrictLockWindow] = []

    def show(
        self,
        *,
        schedule_text: str,
        message_text: str,
        hint_text: str,
        form_title: str | None = None,
    ) -> None:
        self._ensure_windows()
        primary = QtGui.QGuiApplication.primaryScreen()
        for window, screen in zip(self._windows, QtGui.QGuiApplication.screens()):
            window.setGeometry(screen.geometry())
            window.refresh_copy(
                schedule_text=schedule_text,
                message_text=message_text,
                hint_text=hint_text,
                form_title=form_title,
                reset_form=not window.isVisible(),
            )
            window.showFullScreen()
            window.raise_()
            if screen == primary:
                window.activateWindow()

    def hide(self) -> None:
        for window in self._windows:
            window.hide()

    def show_feedback(self, message: str, *, error: bool) -> None:
        for window in self._windows:
            if window.interactive:
                window.show_feedback(message, error=error)

    def _ensure_windows(self) -> None:
        screens = QtGui.QGuiApplication.screens()
        if len(self._windows) == len(screens):
            return

        for window in self._windows:
            window.hide()
            window.deleteLater()
        self._windows.clear()

        primary = QtGui.QGuiApplication.primaryScreen()
        for screen in screens:
            window = StrictLockWindow(interactive=screen == primary)
            if screen == primary:
                window.password_submitted.connect(self.unlock_attempted.emit)
            self._windows.append(window)
