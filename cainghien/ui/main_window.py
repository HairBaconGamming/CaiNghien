from __future__ import annotations

import subprocess
from datetime import datetime

from PySide6 import QtCore, QtGui, QtWidgets

from .. import __version__
from ..models import AppConfig, DaySchedule, WEEKDAY_KEYS, WEEKDAY_LABELS, dedupe_domains
from ..services.enforcement import EnforcementController, EnforcementStatus
from ..services.security import hash_password, validate_password
from ..services.updater import UpdateInfo, UpdateManager
from ..services.windows_guard import (
    WindowsServiceManager,
    WindowsSessionController,
    WindowsStartupManager,
)


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self, controller: EnforcementController) -> None:
        super().__init__()
        self.controller = controller
        self.startup_manager = WindowsStartupManager()
        self.service_manager = WindowsServiceManager()
        self.update_manager = UpdateManager(controller.store)
        self._ignore_close_to_tray = False
        self._last_status: EnforcementStatus | None = None
        self._day_editors: dict[str, tuple[QtWidgets.QCheckBox, QtWidgets.QTimeEdit, QtWidgets.QTimeEdit]] = {}
        self._stats_labels: dict[str, QtWidgets.QLabel] = {}
        self._build_ui()
        self._build_tray()
        self._connect_signals()
        self._load_config(controller.config)
        QtCore.QTimer.singleShot(3500, self.check_for_updates_silent)

    def _build_ui(self) -> None:
        self.setWindowTitle("CaiNghien Focus Guard")
        self.resize(1500, 1040)
        self.setMinimumSize(1240, 820)
        central = QtWidgets.QWidget()
        central.setObjectName("AppShell")
        self.setCentralWidget(central)
        shell = QtWidgets.QHBoxLayout(central)
        shell.setContentsMargins(22, 22, 22, 22)
        shell.setSpacing(18)
        shell.addWidget(self._create_side_panel(), 0)
        shell.addWidget(self._create_workspace(), 1)

    def _create_side_panel(self) -> QtWidgets.QFrame:
        panel = QtWidgets.QFrame()
        panel.setObjectName("SidePanel")
        panel.setMinimumWidth(280)
        panel.setMaximumWidth(380)
        layout = QtWidgets.QVBoxLayout(panel)
        layout.setContentsMargins(26, 28, 26, 26)
        layout.setSpacing(18)

        for text, name in (
            ("DIGITAL DISCIPLINE", "PanelEyebrow"),
            ("CaiNghien", "PanelTitle"),
        ):
            label = QtWidgets.QLabel(text)
            label.setObjectName(name)
            layout.addWidget(label)

        subtitle = QtWidgets.QLabel(
            "Trong gio cam, app se uu tien chan, canh bao, tri hoan doi cau hinh va khoa nghiem khac khi can."
        )
        subtitle.setWordWrap(True)
        subtitle.setObjectName("PanelSubtitle")
        layout.addWidget(subtitle)

        self.overview_badge = self._make_badge("Idle", "secondary")
        layout.addWidget(self.overview_badge, 0, QtCore.Qt.AlignmentFlag.AlignLeft)

        self.side_summary_label = QtWidgets.QLabel("Bao ve dang tat.")
        self.side_summary_label.setWordWrap(True)
        self.side_summary_label.setObjectName("PanelSummary")
        layout.addWidget(self.side_summary_label)

        metrics = QtWidgets.QGridLayout()
        metrics.setHorizontalSpacing(10)
        metrics.setVerticalSpacing(10)
        status_card, self.status_value = self._mini_card("Trang thai")
        mode_card, self.mode_value = self._mini_card("Che do")
        window_card, self.window_value = self._mini_card("Hom nay")
        service_card, self.service_value = self._mini_card("Service")
        metrics.addWidget(status_card, 0, 0)
        metrics.addWidget(mode_card, 0, 1)
        metrics.addWidget(window_card, 1, 0)
        metrics.addWidget(service_card, 1, 1)
        layout.addLayout(metrics)

        divider = QtWidgets.QFrame()
        divider.setFrameShape(QtWidgets.QFrame.Shape.HLine)
        divider.setObjectName("SideDivider")
        layout.addWidget(divider)

        mode_caption = QtWidgets.QLabel("CHE DO BAO VE")
        mode_caption.setObjectName("PanelSection")
        layout.addWidget(mode_caption)
        self.normal_mode_button = QtWidgets.QToolButton()
        self.normal_mode_button.setText("Binh thuong\nChan web xa hoi trong khung gio.")
        self.normal_mode_button.setCheckable(True)
        self.normal_mode_button.setObjectName("ModeButton")
        self.normal_mode_button.setMinimumHeight(102)
        layout.addWidget(self.normal_mode_button)

        self.strict_mode_button = QtWidgets.QToolButton()
        self.strict_mode_button.setText("Nghiem khac\nKhoa may tinh va chi mo bang mat khau.")
        self.strict_mode_button.setCheckable(True)
        self.strict_mode_button.setObjectName("ModeButton")
        self.strict_mode_button.setMinimumHeight(102)
        layout.addWidget(self.strict_mode_button)

        self.mode_group = QtWidgets.QButtonGroup(self)
        self.mode_group.setExclusive(True)
        self.mode_group.addButton(self.normal_mode_button)
        self.mode_group.addButton(self.strict_mode_button)

        action_caption = QtWidgets.QLabel("HANH DONG")
        action_caption.setObjectName("PanelSection")
        layout.addWidget(action_caption)

        self.toggle_button = QtWidgets.QPushButton("Bat bao ve")
        self.toggle_button.setObjectName("PrimaryButton")
        layout.addWidget(self.toggle_button)

        self.save_button = QtWidgets.QPushButton("Luu thiet lap")
        self.save_button.setObjectName("SecondaryButton")
        layout.addWidget(self.save_button)

        self.service_button = QtWidgets.QPushButton("Cai / Mo Service")
        self.service_button.setObjectName("SecondaryButton")
        layout.addWidget(self.service_button)

        self.admin_button = QtWidgets.QPushButton("Mo lai voi quyen Admin")
        self.admin_button.setObjectName("GhostButton")
        layout.addWidget(self.admin_button)

        note = QtWidgets.QFrame()
        note.setObjectName("SideNote")
        note_layout = QtWidgets.QVBoxLayout(note)
        note_layout.setContentsMargins(16, 16, 16, 16)
        note_layout.setSpacing(8)
        note_title = QtWidgets.QLabel("Gemini duoc giu lai")
        note_title.setObjectName("SideNoteTitle")
        note_body = QtWidgets.QLabel(
            "Allow-list mac dinh chi giu gemini.google.com. Cac thay doi sat gio khoa se bi tri hoan."
        )
        note_body.setWordWrap(True)
        note_body.setObjectName("SideNoteBody")
        note_layout.addWidget(note_title)
        note_layout.addWidget(note_body)
        layout.addWidget(note)
        layout.addStretch()
        return panel

    def _create_workspace(self) -> QtWidgets.QScrollArea:
        scroll = QtWidgets.QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
        scroll.setObjectName("WorkspaceScroll")
        content = QtWidgets.QWidget()
        content.setObjectName("Workspace")
        content.setMinimumWidth(860)
        scroll.setWidget(content)
        layout = QtWidgets.QVBoxLayout(content)
        layout.setContentsMargins(6, 2, 6, 2)
        layout.setSpacing(18)

        layout.addWidget(self._create_focus_banner())

        top_row = QtWidgets.QGridLayout()
        top_row.setHorizontalSpacing(18)
        top_row.setVerticalSpacing(18)
        top_row.addWidget(self._create_schedule_card(), 0, 0)
        top_row.addWidget(self._create_sites_card(), 0, 1)
        top_row.setColumnStretch(0, 6)
        top_row.setColumnStretch(1, 7)
        layout.addLayout(top_row)

        middle_row = QtWidgets.QGridLayout()
        middle_row.setHorizontalSpacing(18)
        middle_row.setVerticalSpacing(18)
        middle_row.addWidget(self._create_strict_card(), 0, 0)
        middle_row.addWidget(self._create_system_card(), 0, 1)
        middle_row.addWidget(self._create_guardrail_card(), 1, 0)
        middle_row.addWidget(self._create_stats_card(), 1, 1)
        middle_row.setColumnStretch(0, 1)
        middle_row.setColumnStretch(1, 1)
        layout.addLayout(middle_row)

        layout.addWidget(self._create_log_card())
        layout.addStretch()
        return scroll

    def _create_focus_banner(self) -> QtWidgets.QFrame:
        frame = QtWidgets.QFrame()
        frame.setObjectName("FocusBanner")
        layout = QtWidgets.QHBoxLayout(frame)
        layout.setContentsMargins(28, 26, 28, 26)
        layout.setSpacing(24)

        left = QtWidgets.QVBoxLayout()
        left_container = QtWidgets.QWidget()
        left_container.setLayout(left)
        left_container.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Minimum,
        )

        eyebrow = QtWidgets.QLabel("FOCUS WINDOW")
        eyebrow.setObjectName("FocusEyebrow")
        left.addWidget(eyebrow)

        title = QtWidgets.QLabel("Trong gio cam se khong con duong vong de dung may tinh.")
        title.setObjectName("FocusTitle")
        title.setWordWrap(True)
        left.addWidget(title)

        self.summary_label = QtWidgets.QLabel(
            "Lich theo ngay, canh bao som, tri hoan thay doi va service watchdog dang duoc dong bo."
        )
        self.summary_label.setObjectName("FocusBody")
        self.summary_label.setWordWrap(True)
        left.addWidget(self.summary_label)

        tags = QtWidgets.QHBoxLayout()
        self.banner_mode_tag = self._make_badge("Normal", "warm")
        self.banner_service_tag = self._make_badge("Service", "secondary")
        self.banner_safe_tag = self._make_badge("Safe", "success")
        for widget in (self.banner_mode_tag, self.banner_service_tag, self.banner_safe_tag):
            tags.addWidget(widget)
        tags.addStretch()
        left.addLayout(tags)
        layout.addWidget(left_container, 1)

        right = QtWidgets.QFrame()
        right.setObjectName("FocusTimeCard")
        right.setMinimumWidth(280)
        right.setMaximumWidth(340)
        right_layout = QtWidgets.QVBoxLayout(right)
        right_layout.setContentsMargins(22, 20, 22, 20)
        right_layout.setSpacing(6)

        caption = QtWidgets.QLabel("Khung gio hom nay")
        caption.setObjectName("FocusTimeCaption")
        right_layout.addWidget(caption)

        self.schedule_big_label = QtWidgets.QLabel("17:00 -> 20:00")
        self.schedule_big_label.setObjectName("FocusTime")
        self.schedule_big_label.setWordWrap(True)
        right_layout.addWidget(self.schedule_big_label)

        self.schedule_preview_label = QtWidgets.QLabel("Khong co lich tiep theo.")
        self.schedule_preview_label.setObjectName("FocusTimeBody")
        self.schedule_preview_label.setWordWrap(True)
        right_layout.addWidget(self.schedule_preview_label)

        layout.addWidget(right, 0, QtCore.Qt.AlignmentFlag.AlignTop)
        return frame

    def _create_schedule_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Lich theo tung ngay",
            "Moi ngay co the bat/tat rieng. Neu gio bat dau = gio ket thuc, app se hieu la khoa ca ngay do.",
        )

        header = QtWidgets.QGridLayout()
        header.setHorizontalSpacing(10)
        header.addWidget(self._section_label("Ngay"), 0, 0)
        header.addWidget(self._section_label("Bat/Tat"), 0, 1)
        header.addWidget(self._section_label("Bat dau"), 0, 2)
        header.addWidget(self._section_label("Ket thuc"), 0, 3)
        layout.addLayout(header)

        schedule_grid = QtWidgets.QGridLayout()
        schedule_grid.setHorizontalSpacing(10)
        schedule_grid.setVerticalSpacing(10)
        for row, key in enumerate(WEEKDAY_KEYS):
            day_label = QtWidgets.QLabel(WEEKDAY_LABELS[key])
            day_label.setObjectName("InsetTitle")
            checkbox = QtWidgets.QCheckBox("Bat")
            checkbox.setObjectName("SoftCheck")
            start_edit = self._create_time_edit()
            end_edit = self._create_time_edit()
            self._day_editors[key] = (checkbox, start_edit, end_edit)
            schedule_grid.addWidget(day_label, row, 0)
            schedule_grid.addWidget(checkbox, row, 1)
            schedule_grid.addWidget(start_edit, row, 2)
            schedule_grid.addWidget(end_edit, row, 3)
        layout.addLayout(schedule_grid)

        settings_row = QtWidgets.QGridLayout()
        settings_row.setHorizontalSpacing(12)
        settings_row.setVerticalSpacing(12)
        self.warning_minutes_spin = self._spin_box(1, 120, " phut")
        self.last_minute_guard_spin = self._spin_box(0, 180, " phut")
        settings_row.addWidget(self._labeled_widget("Canh bao truoc gio khoa", self.warning_minutes_spin), 0, 0)
        settings_row.addWidget(self._labeled_widget("Chong sua phut chot", self.last_minute_guard_spin), 0, 1)
        layout.addLayout(settings_row)

        self.change_delay_checkbox = QtWidgets.QCheckBox(
            "Tri hoan thay doi cau hinh khi dang trong hoac sat gio khoa"
        )
        self.change_delay_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.change_delay_checkbox)
        return frame

    def _create_sites_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Danh sach website",
            "Moi domain mot dong. Block-list de chan, allow-list de giu lai nhung diem vao that su can.",
        )
        badges = QtWidgets.QHBoxLayout()
        badges.addWidget(self._make_badge("Blocked list", "danger"))
        badges.addWidget(self._make_badge("Allow list", "soft"))
        badges.addStretch()
        layout.addLayout(badges)

        editors = QtWidgets.QHBoxLayout()
        blocked_column = QtWidgets.QVBoxLayout()
        blocked_column.addWidget(self._section_label("Web bi chan"))
        self.blocked_edit = QtWidgets.QPlainTextEdit()
        self.blocked_edit.setObjectName("CodeLikeEdit")
        blocked_column.addWidget(self.blocked_edit)

        allowed_column = QtWidgets.QVBoxLayout()
        allowed_column.addWidget(self._section_label("Web duoc phep"))
        self.allowed_edit = QtWidgets.QPlainTextEdit()
        self.allowed_edit.setObjectName("CodeLikeEdit")
        allowed_column.addWidget(self.allowed_edit)

        editors.addLayout(blocked_column, 1)
        editors.addLayout(allowed_column, 1)
        layout.addLayout(editors)
        return frame

    def _create_strict_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Che do nghiem khac va manual lock",
            "Strict mode se khoa may trong khung gio cam. Manual lock countdown cho phep dat khoa ngay ca khi chua den lich.",
        )
        self.strict_note_label = QtWidgets.QLabel(
            "Can dat mat khau truoc khi su dung strict mode hoac manual lock."
        )
        self.strict_note_label.setWordWrap(True)
        self.strict_note_label.setObjectName("MutedLabel")
        layout.addWidget(self.strict_note_label)

        self.password_edit = QtWidgets.QLineEdit()
        self.password_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
        self.password_edit.setPlaceholderText("Mat khau moi")
        self.password_edit.setObjectName("SoftInput")
        layout.addWidget(self.password_edit)

        self.password_confirm_edit = QtWidgets.QLineEdit()
        self.password_confirm_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
        self.password_confirm_edit.setPlaceholderText("Nhap lai mat khau")
        self.password_confirm_edit.setObjectName("SoftInput")
        layout.addWidget(self.password_confirm_edit)

        manual_row = QtWidgets.QGridLayout()
        manual_row.setHorizontalSpacing(12)
        self.manual_countdown_spin = self._spin_box(1, 120, " phut")
        self.manual_duration_spin = self._spin_box(5, 480, " phut")
        manual_row.addWidget(self._labeled_widget("Khoa sau", self.manual_countdown_spin), 0, 0)
        manual_row.addWidget(self._labeled_widget("Tu mo sau", self.manual_duration_spin), 0, 1)
        layout.addLayout(manual_row)

        actions = QtWidgets.QHBoxLayout()
        self.manual_lock_button = QtWidgets.QPushButton("Bat manual lock countdown")
        self.manual_lock_button.setObjectName("PrimaryButton")
        actions.addWidget(self.manual_lock_button)
        self.cancel_manual_lock_button = QtWidgets.QPushButton("Huy manual lock")
        self.cancel_manual_lock_button.setObjectName("SecondaryButton")
        actions.addWidget(self.cancel_manual_lock_button)
        layout.addLayout(actions)

        self.manual_lock_label = QtWidgets.QLabel("Khong co manual lock dang cho.")
        self.manual_lock_label.setObjectName("MutedLabel")
        self.manual_lock_label.setWordWrap(True)
        layout.addWidget(self.manual_lock_label)
        return frame

    def _create_system_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "He thong va service",
            "Khoi dong cung Windows de enforcement co mat som. Windows service se giu heartbeat, hosts va pending change o tang nen.",
        )
        self.start_with_windows_checkbox = QtWidgets.QCheckBox("Khoi dong cung Windows + vao background")
        self.start_with_windows_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.start_with_windows_checkbox)

        self.service_enabled_checkbox = QtWidgets.QCheckBox("Bat service watchdog")
        self.service_enabled_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.service_enabled_checkbox)

        service_box = QtWidgets.QFrame()
        service_box.setObjectName("InsetCard")
        service_layout = QtWidgets.QVBoxLayout(service_box)
        service_layout.setContentsMargins(16, 16, 16, 16)
        service_layout.setSpacing(8)
        service_layout.addWidget(self._section_label("Trang thai he thong"))

        self.admin_hint_label = QtWidgets.QLabel("Dang kiem tra quyen Admin.")
        self.admin_hint_label.setObjectName("MutedLabel")
        self.admin_hint_label.setWordWrap(True)
        service_layout.addWidget(self.admin_hint_label)

        self.service_hint_label = QtWidgets.QLabel("Dang kiem tra service.")
        self.service_hint_label.setObjectName("MutedLabel")
        self.service_hint_label.setWordWrap(True)
        service_layout.addWidget(self.service_hint_label)
        layout.addWidget(service_box)

        self.auto_check_updates_checkbox = QtWidgets.QCheckBox("Tu dong kiem tra cap nhat")
        self.auto_check_updates_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.auto_check_updates_checkbox)

        update_actions = QtWidgets.QHBoxLayout()
        self.check_update_button = QtWidgets.QPushButton("Kiem tra cap nhat")
        self.check_update_button.setObjectName("SecondaryButton")
        update_actions.addWidget(self.check_update_button)
        self.cleanup_versions_button = QtWidgets.QPushButton("Don ban cu")
        self.cleanup_versions_button.setObjectName("SecondaryButton")
        update_actions.addWidget(self.cleanup_versions_button)
        layout.addLayout(update_actions)

        self.update_hint_label = QtWidgets.QLabel("Phien ban hien tai: " + __version__)
        self.update_hint_label.setObjectName("MutedLabel")
        self.update_hint_label.setWordWrap(True)
        layout.addWidget(self.update_hint_label)
        return frame

    def _create_guardrail_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Safe mode va tri hoan",
            "Phan nay giup nhin ro pending change, canh bao service va ly do khi app phat hien enforcement khong con day du.",
        )
        self.pending_change_label = QtWidgets.QLabel("Khong co thay doi tri hoan.")
        self.pending_change_label.setObjectName("MutedLabel")
        self.pending_change_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Pending config", self.pending_change_label))

        self.next_window_label = QtWidgets.QLabel("Khong co lich tiep theo.")
        self.next_window_label.setObjectName("MutedLabel")
        self.next_window_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Khung gio tiep theo", self.next_window_label))

        self.safe_mode_label = QtWidgets.QLabel("Khong co canh bao an toan.")
        self.safe_mode_label.setObjectName("MutedLabel")
        self.safe_mode_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Safe mode", self.safe_mode_label))
        return frame

    def _create_stats_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Thong ke 7 ngay",
            "Thong ke duoc tinh tu runtime state va nhat ky chong pha.",
        )
        grid = QtWidgets.QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(12)
        items = [
            ("blocked_minutes", "Phut bi chan"),
            ("schedule_sessions", "Buoi lich"),
            ("strict_sessions", "Buoi strict"),
            ("warnings_sent", "Canh bao"),
            ("failed_unlocks", "Nhap sai"),
            ("tamper_events", "Tamper"),
            ("pending_changes", "Tri hoan"),
        ]
        for index, (key, label) in enumerate(items):
            card, value = self._mini_card(label)
            self._stats_labels[key] = value
            grid.addWidget(card, index // 2, index % 2)
        layout.addLayout(grid)
        return frame

    def _create_log_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Nhat ky chong pha",
            "Moi canh bao, pending change, mo service hay nhap sai mat khau deu duoc ghi vao day.",
        )
        self.log_output = QtWidgets.QPlainTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setObjectName("LogOutput")
        layout.addWidget(self.log_output)
        return frame

    def _build_tray(self) -> None:
        icon = self.style().standardIcon(QtWidgets.QStyle.StandardPixmap.SP_ComputerIcon)
        self.tray_icon = QtWidgets.QSystemTrayIcon(icon, self)
        self.setWindowIcon(icon)
        menu = QtWidgets.QMenu(self)
        menu.addAction("Mo cua so").triggered.connect(self._restore_from_tray)
        menu.addAction("Bat / Tat bao ve").triggered.connect(self.toggle_protection)
        menu.addAction("Thoat").triggered.connect(self._quit_from_tray)
        self.tray_icon.setContextMenu(menu)
        self.tray_icon.activated.connect(self._handle_tray_activated)
        self.tray_icon.show()

    def _connect_signals(self) -> None:
        self.controller.status_changed.connect(self._apply_status)
        self.controller.log_message.connect(self._append_log)
        self.controller.config_changed.connect(self._load_config)
        self.controller.attention_requested.connect(self._show_attention)

        self.save_button.clicked.connect(self.save_config)
        self.toggle_button.clicked.connect(self.toggle_protection)
        self.admin_button.clicked.connect(self.relaunch_as_admin)
        self.service_button.clicked.connect(self.ensure_service_running)
        self.manual_lock_button.clicked.connect(self.start_manual_lock)
        self.cancel_manual_lock_button.clicked.connect(self.cancel_manual_lock)
        self.check_update_button.clicked.connect(self.check_for_updates_manual)
        self.cleanup_versions_button.clicked.connect(self.cleanup_cached_updates)

        self.update_manager.check_completed.connect(self._on_update_check_completed)
        self.update_manager.download_completed.connect(self._on_update_download_completed)
        self.update_manager.cleanup_completed.connect(self._on_update_cleanup_completed)

        for checkbox, start_edit, end_edit in self._day_editors.values():
            checkbox.toggled.connect(self._refresh_schedule_preview)
            start_edit.timeChanged.connect(self._refresh_schedule_preview)
            end_edit.timeChanged.connect(self._refresh_schedule_preview)

    def _load_config(self, config: AppConfig) -> None:
        self.normal_mode_button.setChecked(config.mode == "normal")
        self.strict_mode_button.setChecked(config.mode == "strict")
        for key, schedule in config.weekly_schedule.items():
            checkbox, start_edit, end_edit = self._day_editors[key]
            checkbox.setChecked(schedule.enabled)
            start_edit.setTime(QtCore.QTime.fromString(schedule.start, "HH:mm"))
            end_edit.setTime(QtCore.QTime.fromString(schedule.end, "HH:mm"))
        self.blocked_edit.setPlainText("\n".join(config.blocked_domains))
        self.allowed_edit.setPlainText("\n".join(config.allowed_domains))
        self.password_edit.clear()
        self.password_confirm_edit.clear()
        self.start_with_windows_checkbox.setChecked(
            config.start_with_windows or self.startup_manager.is_enabled()
        )
        self.service_enabled_checkbox.setChecked(config.service_enabled)
        self.warning_minutes_spin.setValue(config.warning_minutes)
        self.last_minute_guard_spin.setValue(config.last_minute_guard_minutes)
        self.change_delay_checkbox.setChecked(config.change_delay_enabled)
        self.manual_duration_spin.setValue(config.manual_lock_duration_minutes)
        self.auto_check_updates_checkbox.setChecked(config.auto_check_updates)
        self.strict_note_label.setText(
            "Mat khau da duoc thiet lap."
            if config.has_password
            else "Can dat mat khau truoc khi su dung strict mode hoac manual lock."
        )
        self._refresh_schedule_preview()

    def _apply_status(self, status: EnforcementStatus) -> None:
        self._last_status = status
        self.toggle_button.setText("Tat bao ve" if status.protection_enabled else "Bat bao ve")
        self.overview_badge.setText(
            "Safe mode" if status.safe_mode else "Live" if status.schedule_active else "Armed" if status.protection_enabled else "Idle"
        )
        self._set_badge_variant(
            self.overview_badge,
            "danger" if status.safe_mode else "danger" if status.lock_active else "warm" if status.protection_enabled else "secondary",
        )
        self.side_summary_label.setText(status.summary)
        self.summary_label.setText(status.summary)
        self.status_value.setText(
            "Dang khoa" if status.lock_active else "Dang chan" if status.schedule_active else "Cho lich" if status.protection_enabled else "Tam dung"
        )
        self.mode_value.setText("Nghiem khac" if status.mode == "strict" else "Binh thuong")
        self.window_value.setText(status.today_schedule_label)
        self.service_value.setText("Song" if status.service_alive else "Can xem")
        self.banner_mode_tag.setText("Strict" if status.mode == "strict" else "Normal")
        self._set_badge_variant(self.banner_mode_tag, "danger" if status.mode == "strict" else "warm")
        self.banner_service_tag.setText("Service OK" if status.service_alive else "Service yeu")
        self._set_badge_variant(self.banner_service_tag, "success" if status.service_alive else "secondary")
        self.banner_safe_tag.setText("Safe mode" if status.safe_mode else "Healthy")
        self._set_badge_variant(self.banner_safe_tag, "danger" if status.safe_mode else "success")

        self.schedule_big_label.setText(status.today_schedule_label)
        self.schedule_preview_label.setText(f"Tiep theo: {status.next_window_text}")
        self.manual_lock_label.setText(status.manual_countdown_text)
        self.pending_change_label.setText(status.pending_change_text)
        self.next_window_label.setText(status.next_window_text)
        self.safe_mode_label.setText(status.safe_mode_reason or "Khong co canh bao an toan.")
        self.admin_hint_label.setText(
            "Dang chay voi quyen Admin." if status.admin else "Dang chay quyen thuong. Khong duoc phep sua hosts truc tiep."
        )
        service_running, service_text = self.service_manager.query_status()
        self.service_hint_label.setText(service_text)
        self._set_badge_variant(
            self.banner_service_tag,
            "success" if status.service_alive or service_running else "secondary",
        )

        stats = status.weekly_stats
        mapping = {
            "blocked_minutes": str(stats.blocked_minutes),
            "schedule_sessions": str(stats.schedule_sessions),
            "strict_sessions": str(stats.strict_sessions),
            "warnings_sent": str(stats.warnings_sent),
            "failed_unlocks": str(stats.failed_unlocks),
            "tamper_events": str(stats.tamper_events),
            "pending_changes": str(stats.pending_changes),
        }
        for key, value in mapping.items():
            label = self._stats_labels.get(key)
            if label is not None:
                label.setText(value)

    def _append_log(self, message: str) -> None:
        self.log_output.appendPlainText(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        self.log_output.verticalScrollBar().setValue(self.log_output.verticalScrollBar().maximum())

    def _show_attention(self, title: str, message: str) -> None:
        self.tray_icon.showMessage(title, message, self.windowIcon(), 6000)

    def _refresh_schedule_preview(self) -> None:
        today_key = WEEKDAY_KEYS[datetime.now().weekday()]
        checkbox, start_edit, end_edit = self._day_editors[today_key]
        if checkbox.isChecked():
            label = f"{start_edit.time().toString('HH:mm')} -> {end_edit.time().toString('HH:mm')}"
        else:
            label = "Tat"
        self.schedule_big_label.setText(label)
        self.schedule_preview_label.setText(
            "Gemini duoc giu lai trong allow-list. Cac thay doi sat gio khoa co the bi tri hoan."
        )
        if self._last_status:
            self.window_value.setText(label)

    def _collect_config_from_ui(self) -> AppConfig:
        config = AppConfig.from_dict(self.controller.config.to_dict())
        config.mode = "strict" if self.strict_mode_button.isChecked() else "normal"
        config.weekly_schedule = {}
        for key, (checkbox, start_edit, end_edit) in self._day_editors.items():
            config.weekly_schedule[key] = DaySchedule(
                enabled=checkbox.isChecked(),
                start=start_edit.time().toString("HH:mm"),
                end=end_edit.time().toString("HH:mm"),
            )
        config.blocked_domains = self._extract_domains(self.blocked_edit)
        config.allowed_domains = self._extract_domains(self.allowed_edit)
        if "gemini.google.com" not in config.allowed_domains:
            config.allowed_domains.append("gemini.google.com")
        config.allowed_domains = dedupe_domains(config.allowed_domains)
        config.start_with_windows = self.start_with_windows_checkbox.isChecked()
        config.service_enabled = self.service_enabled_checkbox.isChecked()
        config.warning_minutes = self.warning_minutes_spin.value()
        config.last_minute_guard_minutes = self.last_minute_guard_spin.value()
        config.change_delay_enabled = self.change_delay_checkbox.isChecked()
        config.manual_lock_duration_minutes = self.manual_duration_spin.value()
        config.auto_check_updates = self.auto_check_updates_checkbox.isChecked()
        return config

    def save_config(self) -> None:
        current = self.controller.config
        candidate = self._collect_config_from_ui()
        maybe_error = self._validate_candidate(candidate)
        if maybe_error:
            self._show_warning("Chua luu duoc", maybe_error)
            return

        if self.controller.requires_strict_access_password():
            if not self._require_strict_password(
                "Nhap mat khau de cap nhat thiet lap khi strict dang hoat dong."
            ):
                return

        new_password = self.password_edit.text().strip()
        confirm_password = self.password_confirm_edit.text().strip()
        if new_password or confirm_password:
            if new_password != confirm_password:
                self._show_warning("Mat khau chua khop", "Hai truong mat khau khong trung nhau.")
                return
            validation_error = validate_password(new_password)
            if validation_error:
                self._show_warning("Mat khau chua hop le", validation_error)
                return
            candidate.strict_password = hash_password(new_password)
        else:
            candidate.strict_password = current.strict_password

        if candidate.mode == "strict" and not candidate.has_password:
            self._show_warning("Can mat khau", "Hay dat mat khau truoc khi bat strict mode.")
            return

        try:
            self.startup_manager.set_enabled(candidate.start_with_windows)
        except OSError as exc:
            self._show_warning("Khong cap nhat startup", str(exc))
            return

        ok, message, queued = self.controller.update_config(candidate)
        if not ok:
            self._show_warning("Khong luu duoc", message)
            return
        self.password_edit.clear()
        self.password_confirm_edit.clear()
        self.save_button.setText("Da tri hoan" if queued else "Da luu thanh cong!")
        self.save_button.setStyleSheet(
            "background: rgba(129, 199, 132, 0.2); color: #81c784; border-color: #81c784;"
        )
        QtCore.QTimer.singleShot(2200, self._reset_save_button)

    def _reset_save_button(self) -> None:
        self.save_button.setText("Luu thiet lap")
        self.save_button.setStyleSheet("")

    def toggle_protection(self) -> None:
        current = self.controller.config
        if current.protection_enabled or self.controller.state.manual_lock is not None:
            password = None
            if current.has_password and (
                current.mode == "strict" or self.controller.state.manual_lock is not None
            ):
                password = self._prompt_password("Nhap mat khau de tat bao ve.")
                if password is None:
                    return
            success, message = self.controller.disable_protection(password)
            if not success:
                self._show_warning("Khong tat duoc bao ve", message)
            return

        candidate = self._collect_config_from_ui()
        maybe_error = self._validate_candidate(candidate)
        if maybe_error:
            self._show_warning("Chua bat duoc bao ve", maybe_error)
            return

        new_password = self.password_edit.text().strip()
        confirm_password = self.password_confirm_edit.text().strip()
        if new_password or confirm_password:
            if new_password != confirm_password:
                self._show_warning("Mat khau chua khop", "Hai truong mat khau khong trung nhau.")
                return
            validation_error = validate_password(new_password)
            if validation_error:
                self._show_warning("Mat khau chua hop le", validation_error)
                return
            candidate.strict_password = hash_password(new_password)
        else:
            candidate.strict_password = current.strict_password

        if candidate.mode == "strict" and not candidate.has_password:
            self._show_warning("Can mat khau", "Hay dat mat khau truoc khi bat strict mode.")
            return

        try:
            self.startup_manager.set_enabled(candidate.start_with_windows)
        except OSError as exc:
            self._show_warning("Khong cap nhat startup", str(exc))
            return

        candidate.protection_enabled = True
        ok, message, queued = self.controller.update_config(candidate)
        if not ok:
            self._show_warning("Khong bat duoc bao ve", message)
            return
        if queued:
            self._show_warning("Da tri hoan", message)
        self.password_edit.clear()
        self.password_confirm_edit.clear()

    def start_manual_lock(self) -> None:
        success, message = self.controller.start_manual_lock(self.manual_countdown_spin.value())
        if not success:
            self._show_warning("Khong bat duoc manual lock", message)

    def cancel_manual_lock(self) -> None:
        password = self._prompt_password("Nhap mat khau de huy manual lock.")
        if password is None:
            return
        success, message = self.controller.cancel_manual_lock(password)
        if not success:
            self._show_warning("Khong huy duoc", message)

    def ensure_service_running(self) -> None:
        ok, message = self.service_manager.ensure_running()
        if not ok:
            self._show_warning("Khong the cai / mo service", message)
            return
        self._append_log("Service da duoc cai hoac khoi dong.")
        self.controller.evaluate(force=True)

    def check_for_updates_silent(self) -> None:
        if not self.auto_check_updates_checkbox.isChecked():
            return
        self.update_manager.check_for_updates(
            __version__,
            self.controller.config.update_manifest_url,
            silent=True,
        )

    def check_for_updates_manual(self) -> None:
        self.update_manager.check_for_updates(
            __version__,
            self.controller.config.update_manifest_url,
            silent=False,
        )

    def cleanup_cached_updates(self) -> None:
        message = self.update_manager.cleanup_cached_versions()
        self._append_log(message)

    def _on_update_check_completed(self, update: object, error: str, silent: bool) -> None:
        if error:
            self.update_hint_label.setText(f"Cap nhat: loi kiem tra ({error})")
            if not silent:
                self._show_warning("Khong kiem tra duoc cap nhat", error)
            return
        if update is None:
            self.update_hint_label.setText(f"Phien ban hien tai: {__version__} - da moi nhat")
            if not silent:
                QtWidgets.QMessageBox.information(
                    self,
                    "Cap nhat",
                    "Ban dang dung phien ban moi nhat.",
                )
            return

        update_info = update if isinstance(update, UpdateInfo) else None
        if update_info is None:
            return
        self.update_hint_label.setText(
            f"Co ban moi {update_info.version} ({update_info.published_at})"
        )
        notes = "\n".join(f"- {item}" for item in update_info.notes) or "- Ban cap nhat moi."
        answer = QtWidgets.QMessageBox.question(
            self,
            "Co ban cap nhat moi",
            (
                f"Phat hien phien ban {update_info.version}.\n\n"
                f"Thay doi:\n{notes}\n\n"
                "Ban co muon tai installer va cap nhat khong?"
            ),
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No,
            QtWidgets.QMessageBox.StandardButton.Yes,
        )
        if answer == QtWidgets.QMessageBox.StandardButton.Yes:
            self.update_hint_label.setText(f"Dang tai ban {update_info.version}...")
            self.update_manager.download_update(update_info)

    def _on_update_download_completed(self, installer_path: str, update: object, error: str) -> None:
        update_info = update if isinstance(update, UpdateInfo) else None
        if error:
            self.update_hint_label.setText(f"Cap nhat that bai: {error}")
            self._show_warning("Tai cap nhat that bai", error)
            return
        if not installer_path or update_info is None:
            return
        self.update_hint_label.setText(f"Da tai xong ban {update_info.version}")
        launch = QtWidgets.QMessageBox.question(
            self,
            "San sang cap nhat",
            (
                f"Da tai xong installer {update_info.version}.\n"
                "Ban co muon mo installer ngay bay gio khong?"
            ),
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No,
            QtWidgets.QMessageBox.StandardButton.Yes,
        )
        if launch != QtWidgets.QMessageBox.StandardButton.Yes:
            return
        try:
            subprocess.Popen([installer_path])
        except OSError as exc:
            self._show_warning("Khong mo duoc installer", str(exc))
            return
        self.controller.shutdown()
        QtWidgets.QApplication.quit()

    def _on_update_cleanup_completed(self, message: str) -> None:
        self.update_hint_label.setText(message)

    def relaunch_as_admin(self) -> None:
        if WindowsSessionController.relaunch_as_admin():
            QtWidgets.QApplication.quit()
            return
        self._show_warning("Khong mo lai duoc", "Windows tu choi yeu cau mo app voi quyen Admin.")

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        if self._ignore_close_to_tray:
            super().closeEvent(event)
            return
        event.ignore()
        self.hide()
        if self.controller.requires_strict_access_password():
            self.controller.set_ui_access_override(False)
        self.tray_icon.showMessage(
            "CaiNghien Focus Guard",
            "Ung dung van dang chay nen de tiep tuc enforcement.",
            self.windowIcon(),
            2500,
        )

    def _restore_from_tray(self) -> None:
        if not self.request_strict_access("Nhap mat khau de mo cua so trong khung gio nghiem khac."):
            return
        self.showNormal()
        self.raise_()
        self.activateWindow()

    def _handle_tray_activated(self, reason: QtWidgets.QSystemTrayIcon.ActivationReason) -> None:
        if reason in (
            QtWidgets.QSystemTrayIcon.ActivationReason.Trigger,
            QtWidgets.QSystemTrayIcon.ActivationReason.DoubleClick,
        ):
            self._restore_from_tray()

    def _quit_from_tray(self) -> None:
        current = self.controller.config
        if current.has_password and (
            self.controller.requires_strict_access_password()
            or self.controller.state.manual_lock is not None
        ):
            password = self._prompt_password(
                "Nhap mat khau de thoat app khi strict/manual lock dang bat."
            )
            if password is None or not self.controller.verify_strict_password(password):
                self._show_warning("Khong the thoat", "Mat khau khong dung.")
                return
        self._ignore_close_to_tray = True
        self.controller.shutdown()
        QtWidgets.QApplication.quit()

    def _validate_candidate(self, candidate: AppConfig) -> str | None:
        if not candidate.blocked_domains:
            return "Danh sach web bi chan dang rong."
        if all(not schedule.enabled for schedule in candidate.weekly_schedule.values()):
            return "Hay bat it nhat mot ngay trong lich tu dong."
        return None

    def _prompt_password(self, message: str) -> str | None:
        text, ok = QtWidgets.QInputDialog.getText(
            self,
            "Xac nhan mat khau",
            message,
            QtWidgets.QLineEdit.EchoMode.Password,
        )
        return text if ok else None

    def _require_strict_password(self, message: str) -> bool:
        password = self._prompt_password(message)
        if password is None:
            return False
        if not self.controller.verify_strict_password(password):
            self._show_warning("Mat khau khong dung", "Vui long thu lai mat khau cua che do nghiem khac.")
            return False
        return True

    def request_strict_access(self, message: str, *, reevaluate: bool = True) -> bool:
        if not self.controller.requires_strict_access_password():
            return True
        while True:
            password = self._prompt_password(message)
            if password is None:
                return False
            if self.controller.verify_strict_password(password):
                self.controller.set_ui_access_override(True, reevaluate=reevaluate)
                return True
            self._show_warning(
                "Mat khau khong dung",
                "Can dung mat khau nghiem khac moi mo duoc cua so trong khung gio nay.",
            )

    def _extract_domains(self, edit: QtWidgets.QPlainTextEdit) -> list[str]:
        return dedupe_domains([line.strip() for line in edit.toPlainText().splitlines()])

    def _show_warning(self, title: str, message: str) -> None:
        QtWidgets.QMessageBox.warning(self, title, message)

    def _card(self, title: str, subtitle: str) -> tuple[QtWidgets.QFrame, QtWidgets.QVBoxLayout]:
        frame = QtWidgets.QFrame()
        frame.setObjectName("Card")
        frame.setMinimumWidth(320)
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(14)
        heading = QtWidgets.QLabel(title)
        heading.setObjectName("CardTitle")
        heading.setWordWrap(True)
        layout.addWidget(heading)
        caption = QtWidgets.QLabel(subtitle)
        caption.setWordWrap(True)
        caption.setObjectName("CardSubtitle")
        layout.addWidget(caption)
        return frame, layout

    def _mini_card(self, title: str) -> tuple[QtWidgets.QFrame, QtWidgets.QLabel]:
        frame = QtWidgets.QFrame()
        frame.setObjectName("MiniCard")
        frame.setMinimumHeight(86)
        frame.setSizePolicy(QtWidgets.QSizePolicy.Policy.Expanding, QtWidgets.QSizePolicy.Policy.Fixed)
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(4)
        caption = QtWidgets.QLabel(title)
        caption.setObjectName("MiniCaption")
        layout.addWidget(caption)
        value = QtWidgets.QLabel("--")
        value.setObjectName("MiniValue")
        value.setWordWrap(True)
        layout.addWidget(value)
        return frame, value

    def _make_badge(self, text: str, variant: str) -> QtWidgets.QLabel:
        badge = QtWidgets.QLabel(text)
        badge.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        badge.setProperty("badgeVariant", variant)
        badge.setObjectName("Badge")
        return badge

    def _set_badge_variant(self, widget: QtWidgets.QLabel, variant: str) -> None:
        widget.setProperty("badgeVariant", variant)
        widget.style().unpolish(widget)
        widget.style().polish(widget)

    def _section_label(self, text: str) -> QtWidgets.QLabel:
        label = QtWidgets.QLabel(text)
        label.setObjectName("SectionCaption")
        return label

    def _create_time_edit(self) -> QtWidgets.QTimeEdit:
        edit = QtWidgets.QTimeEdit()
        edit.setDisplayFormat("HH:mm")
        edit.setObjectName("SoftInput")
        edit.setMinimumWidth(112)
        return edit

    def _spin_box(self, minimum: int, maximum: int, suffix: str) -> QtWidgets.QSpinBox:
        box = QtWidgets.QSpinBox()
        box.setRange(minimum, maximum)
        box.setSuffix(suffix)
        box.setObjectName("SoftInput")
        box.setMinimumHeight(44)
        return box

    def _labeled_widget(self, title: str, widget: QtWidgets.QWidget) -> QtWidgets.QFrame:
        shell = QtWidgets.QFrame()
        shell.setObjectName("InsetCard")
        layout = QtWidgets.QVBoxLayout(shell)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(8)
        layout.addWidget(self._section_label(title))
        layout.addWidget(widget)
        return shell

    def _labeled_value(self, title: str, value: QtWidgets.QLabel) -> QtWidgets.QFrame:
        shell = QtWidgets.QFrame()
        shell.setObjectName("InsetCard")
        layout = QtWidgets.QVBoxLayout(shell)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(8)
        layout.addWidget(self._section_label(title))
        layout.addWidget(value)
        return shell
