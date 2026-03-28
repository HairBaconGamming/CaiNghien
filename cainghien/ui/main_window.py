from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path

from PySide6 import QtCore, QtGui, QtWidgets

from .. import __version__
from ..models import (
    AppConfig,
    DaySchedule,
    StudyDaySchedule,
    StudyProfile,
    WEEKDAY_KEYS,
    WEEKDAY_LABELS,
    dedupe_domains,
    dedupe_processes,
    dedupe_text_values,
)
from ..services.enforcement import EnforcementController, EnforcementStatus
from ..services.security import (
    generate_recovery_code,
    hash_password,
    normalize_recovery_code,
    validate_password,
)
from ..services.uninstall_flow import find_uninstaller, launch_uninstaller, write_uninstall_approval
from ..services.updater import UpdateInfo, UpdateManager
from ..services.windows_guard import (
    WindowsServiceManager,
    WindowsSessionController,
    WindowsStartupManager,
)
from .uninstall_dialog import RecoveryCodeDialog, UninstallApprovalDialog


class SidePanelFrame(QtWidgets.QFrame):
    def sizeHint(self) -> QtCore.QSize:
        hint = super().sizeHint()
        hint.setWidth(max(hint.width(), 348))
        return hint

    def minimumSizeHint(self) -> QtCore.QSize:
        hint = super().minimumSizeHint()
        hint.setWidth(max(hint.width(), 320))
        return hint


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
        self._study_day_editors: dict[str, tuple[QtWidgets.QCheckBox, QtWidgets.QTimeEdit, QtWidgets.QTimeEdit, QtWidgets.QComboBox]] = {}
        self._stats_labels: dict[str, QtWidgets.QLabel] = {}
        self._side_panel: QtWidgets.QFrame | None = None
        self._workspace_scroll: QtWidgets.QWidget | None = None
        self._metrics_grid: QtWidgets.QGridLayout | None = None
        self._metric_cards: list[QtWidgets.QFrame] = []
        self._sidebar_compact = False
        self._study_profiles_cache: list[StudyProfile] = []
        self._study_profile_loading = False
        self._study_profile_editing_id: str | None = None
        self._hold_abort_timer: QtCore.QTimer | None = None
        self._hold_abort_remaining = 0
        self._build_ui()
        self._build_tray()
        self._connect_signals()
        self._load_config(controller.config)
        QtCore.QTimer.singleShot(3500, self.check_for_updates_silent)

    def _build_ui(self) -> None:
        self.setWindowTitle("CaiNghiện Focus Guard")
        self.resize(1500, 1040)
        self.setMinimumSize(1240, 820)
        central = QtWidgets.QWidget()
        central.setObjectName("AppShell")
        self.setCentralWidget(central)
        shell = QtWidgets.QHBoxLayout(central)
        shell.setContentsMargins(22, 22, 22, 22)
        shell.setSpacing(18)
        self._side_panel = self._create_side_panel()
        self._workspace_scroll = self._create_workspace()
        splitter = QtWidgets.QSplitter(QtCore.Qt.Orientation.Horizontal)
        splitter.setChildrenCollapsible(False)
        splitter.setHandleWidth(10)
        splitter.addWidget(self._side_panel)
        splitter.addWidget(self._workspace_scroll)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setSizes([348, 1100])
        shell.addWidget(splitter, 1)

    def _create_side_panel(self) -> QtWidgets.QFrame:
        panel = SidePanelFrame()
        panel.setObjectName("SidePanel")
        panel.setMinimumWidth(312)
        panel.setMaximumWidth(380)
        panel.setBaseSize(340, 0)
        panel.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Expanding,
        )
        panel.installEventFilter(self)
        layout = QtWidgets.QVBoxLayout(panel)
        layout.setContentsMargins(26, 28, 26, 26)
        layout.setSpacing(18)

        for text, name in (
            ("KỶ LUẬT SỐ", "PanelEyebrow"),
            ("CaiNghiện", "PanelTitle"),
        ):
            label = QtWidgets.QLabel(text)
            label.setObjectName(name)
            layout.addWidget(label)

        subtitle = QtWidgets.QLabel(
            "Trong giờ cấm, app sẽ ưu tiên chặn, cảnh báo, trì hoãn đổi cấu hình và khóa nghiêm khắc khi cần."
        )
        subtitle.setWordWrap(True)
        subtitle.setObjectName("PanelSubtitle")
        layout.addWidget(subtitle)

        self.overview_badge = self._make_badge("Tạm dừng", "secondary")
        layout.addWidget(self.overview_badge, 0, QtCore.Qt.AlignmentFlag.AlignLeft)

        self.side_summary_label = QtWidgets.QLabel("Bảo vệ đang tắt.")
        self.side_summary_label.setWordWrap(True)
        self.side_summary_label.setObjectName("PanelSummary")
        layout.addWidget(self.side_summary_label)

        metrics = QtWidgets.QGridLayout()
        metrics.setHorizontalSpacing(10)
        metrics.setVerticalSpacing(10)
        self._metrics_grid = metrics
        status_card, self.status_value = self._mini_card("Trạng thái")
        mode_card, self.mode_value = self._mini_card("Chế độ")
        window_card, self.window_value = self._mini_card("Hôm nay")
        service_card, self.service_value = self._mini_card("Dịch vụ")
        self._metric_cards = [status_card, mode_card, window_card, service_card]
        self._arrange_sidebar_metrics(compact=False)
        layout.addLayout(metrics)

        divider = QtWidgets.QFrame()
        divider.setFrameShape(QtWidgets.QFrame.Shape.HLine)
        divider.setObjectName("SideDivider")
        layout.addWidget(divider)

        mode_caption = QtWidgets.QLabel("CHẾ ĐỘ BẢO VỆ")
        mode_caption.setObjectName("PanelSection")
        layout.addWidget(mode_caption)
        self.normal_mode_button = QtWidgets.QToolButton()
        self.normal_mode_button.setText("Bình thường\nChặn web xã hội trong khung giờ.")
        self.normal_mode_button.setCheckable(True)
        self.normal_mode_button.setObjectName("ModeButton")
        self.normal_mode_button.setMinimumHeight(102)
        self.normal_mode_button.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Fixed,
        )
        layout.addWidget(self.normal_mode_button)

        self.strict_mode_button = QtWidgets.QToolButton()
        self.strict_mode_button.setText("Nghiêm khắc\nKhóa máy tính và chỉ mở bằng mật khẩu.")
        self.strict_mode_button.setCheckable(True)
        self.strict_mode_button.setObjectName("ModeButton")
        self.strict_mode_button.setMinimumHeight(102)
        self.strict_mode_button.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Fixed,
        )
        layout.addWidget(self.strict_mode_button)

        self.mode_group = QtWidgets.QButtonGroup(self)
        self.mode_group.setExclusive(True)
        self.mode_group.addButton(self.normal_mode_button)
        self.mode_group.addButton(self.strict_mode_button)

        action_caption = QtWidgets.QLabel("HÀNH ĐỘNG")
        action_caption.setObjectName("PanelSection")
        layout.addWidget(action_caption)

        self.toggle_button = QtWidgets.QPushButton("Bật bảo vệ")
        self.toggle_button.setObjectName("PrimaryButton")
        layout.addWidget(self.toggle_button)

        self.save_button = QtWidgets.QPushButton("Lưu thiết lập")
        self.save_button.setObjectName("SecondaryButton")
        layout.addWidget(self.save_button)

        self.service_button = QtWidgets.QPushButton("Cài / Mở dịch vụ")
        self.service_button.setObjectName("SecondaryButton")
        layout.addWidget(self.service_button)

        self.admin_button = QtWidgets.QPushButton("Mở lại với quyền Admin")
        self.admin_button.setObjectName("GhostButton")
        layout.addWidget(self.admin_button)

        note = QtWidgets.QFrame()
        note.setObjectName("SideNote")
        note_layout = QtWidgets.QVBoxLayout(note)
        note_layout.setContentsMargins(16, 16, 16, 16)
        note_layout.setSpacing(8)
        note_title = QtWidgets.QLabel("Gemini được giữ lại")
        note_title.setObjectName("SideNoteTitle")
        note_body = QtWidgets.QLabel(
            "Danh sách cho phép mặc định chỉ giữ gemini.google.com. Các thay đổi sát giờ khóa sẽ bị trì hoãn."
        )
        note_body.setWordWrap(True)
        note_body.setObjectName("SideNoteBody")
        note_layout.addWidget(note_title)
        note_layout.addWidget(note_body)
        layout.addWidget(note)
        layout.addStretch()
        return panel

    def _create_workspace(self) -> QtWidgets.QWidget:
        content = QtWidgets.QWidget()
        content.setObjectName("Workspace")
        content.setMinimumWidth(900)
        content.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Expanding,
        )
        layout = QtWidgets.QVBoxLayout(content)
        layout.setContentsMargins(6, 2, 6, 2)
        layout.setSpacing(18)

        layout.addWidget(self._create_focus_banner())
        tabs = QtWidgets.QTabWidget()
        tabs.setObjectName("WorkspaceTabs")
        tabs.setDocumentMode(True)
        tabs.setUsesScrollButtons(False)
        tabs.setElideMode(QtCore.Qt.TextElideMode.ElideRight)
        tabs.setTabPosition(QtWidgets.QTabWidget.TabPosition.North)
        tabs.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Expanding,
        )
        tabs.tabBar().setObjectName("WorkspaceTabBar")

        tabs.addTab(self._create_overview_tab(), "Tổng quan")
        tabs.addTab(self._create_study_tab(), "Học tập")
        tabs.addTab(self._create_schedule_tab(), "Lịch")
        tabs.addTab(self._create_sites_tab(), "Trang web")
        tabs.addTab(self._create_strict_tab(), "Nghiêm khắc")
        tabs.addTab(self._create_system_tab(), "Hệ thống")
        tabs.addTab(self._create_log_tab(), "Nhật ký")

        layout.addWidget(tabs, 1)
        return content

    def _create_tab_page(self) -> tuple[QtWidgets.QWidget, QtWidgets.QVBoxLayout]:
        page = QtWidgets.QWidget()
        page.setObjectName("WorkspaceTabPage")
        layout = QtWidgets.QVBoxLayout(page)
        layout.setContentsMargins(0, 4, 0, 0)
        layout.setSpacing(18)
        return page, layout

    def _create_overview_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        row = QtWidgets.QGridLayout()
        row.setHorizontalSpacing(18)
        row.setVerticalSpacing(18)
        row.addWidget(self._create_guardrail_card(), 0, 0)
        row.addWidget(self._create_stats_card(), 0, 1)
        row.addWidget(self._create_study_overview_card(), 1, 0)
        row.addWidget(self._create_study_report_card(), 1, 1)
        row.setColumnStretch(0, 1)
        row.setColumnStretch(1, 1)
        layout.addLayout(row)
        layout.addStretch()
        return page

    def _create_study_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        grid = QtWidgets.QGridLayout()
        grid.setHorizontalSpacing(18)
        grid.setVerticalSpacing(18)
        grid.addWidget(self._create_study_session_card(), 0, 0)
        grid.addWidget(self._create_study_profile_card(), 0, 1)
        grid.setColumnStretch(0, 1)
        grid.setColumnStretch(1, 1)
        layout.addLayout(grid)
        layout.addStretch()
        return page

    def _create_schedule_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        row = QtWidgets.QGridLayout()
        row.setHorizontalSpacing(18)
        row.setVerticalSpacing(18)
        row.addWidget(self._create_schedule_card(), 0, 0)
        row.addWidget(self._create_study_schedule_card(), 0, 1)
        row.setColumnStretch(0, 1)
        row.setColumnStretch(1, 1)
        layout.addLayout(row)
        layout.addStretch()
        return page

    def _create_sites_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        layout.addWidget(self._create_sites_card(), 1)
        return page

    def _create_strict_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        layout.addWidget(self._create_strict_card())
        layout.addStretch()
        return page

    def _create_system_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        layout.addWidget(self._create_system_card())
        layout.addStretch()
        return page

    def _create_log_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        layout.addWidget(self._create_log_card(), 1)
        return page

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

        eyebrow = QtWidgets.QLabel("KHUNG TẬP TRUNG")
        eyebrow.setObjectName("FocusEyebrow")
        left.addWidget(eyebrow)

        title = QtWidgets.QLabel("Trong giờ cấm sẽ không còn đường vòng để dùng máy tính.")
        title.setObjectName("FocusTitle")
        title.setWordWrap(True)
        left.addWidget(title)

        self.summary_label = QtWidgets.QLabel(
            "Lịch theo ngày, cảnh báo sớm, trì hoãn thay đổi và giám sát dịch vụ đang được đồng bộ."
        )
        self.summary_label.setObjectName("FocusBody")
        self.summary_label.setWordWrap(True)
        left.addWidget(self.summary_label)

        tags = QtWidgets.QHBoxLayout()
        self.banner_mode_tag = self._make_badge("Bình thường", "warm")
        self.banner_service_tag = self._make_badge("Dịch vụ", "secondary")
        self.banner_safe_tag = self._make_badge("An toàn", "success")
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

        caption = QtWidgets.QLabel("Khung giờ hôm nay")
        caption.setObjectName("FocusTimeCaption")
        right_layout.addWidget(caption)

        self.schedule_big_label = QtWidgets.QLabel("17:00 -> 20:00")
        self.schedule_big_label.setObjectName("FocusTime")
        self.schedule_big_label.setWordWrap(True)
        right_layout.addWidget(self.schedule_big_label)

        self.schedule_preview_label = QtWidgets.QLabel("Không có lịch tiếp theo.")
        self.schedule_preview_label.setObjectName("FocusTimeBody")
        self.schedule_preview_label.setWordWrap(True)
        right_layout.addWidget(self.schedule_preview_label)

        layout.addWidget(right, 0, QtCore.Qt.AlignmentFlag.AlignTop)
        return frame

    def _create_schedule_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Lịch theo từng ngày",
            "Mỗi ngày có thể bật hoặc tắt riêng. Nếu giờ bắt đầu bằng giờ kết thúc, app sẽ hiểu là khóa cả ngày đó.",
        )

        header = QtWidgets.QGridLayout()
        header.setHorizontalSpacing(10)
        header.addWidget(self._section_label("Ngày"), 0, 0)
        header.addWidget(self._section_label("Bật/Tắt"), 0, 1)
        header.addWidget(self._section_label("Bắt đầu"), 0, 2)
        header.addWidget(self._section_label("Kết thúc"), 0, 3)
        layout.addLayout(header)

        schedule_grid = QtWidgets.QGridLayout()
        schedule_grid.setHorizontalSpacing(10)
        schedule_grid.setVerticalSpacing(10)
        for row, key in enumerate(WEEKDAY_KEYS):
            day_label = QtWidgets.QLabel(WEEKDAY_LABELS[key])
            day_label.setObjectName("InsetTitle")
            checkbox = QtWidgets.QCheckBox("Bật")
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
        self.warning_minutes_spin = self._spin_box(1, 120, " phút")
        self.last_minute_guard_spin = self._spin_box(0, 180, " phút")
        settings_row.addWidget(self._labeled_widget("Cảnh báo trước giờ khóa", self.warning_minutes_spin), 0, 0)
        settings_row.addWidget(self._labeled_widget("Chống sửa phút chót", self.last_minute_guard_spin), 0, 1)
        layout.addLayout(settings_row)

        self.change_delay_checkbox = QtWidgets.QCheckBox(
            "Trì hoãn thay đổi cấu hình khi đang trong hoặc sát giờ khóa"
        )
        self.change_delay_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.change_delay_checkbox)
        return frame

    def _create_sites_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Danh sách trang web",
            "Mỗi domain một dòng. Danh sách chặn để khóa, danh sách cho phép để giữ lại những điểm vào thật sự cần.",
        )
        badges = QtWidgets.QHBoxLayout()
        badges.addWidget(self._make_badge("Danh sách chặn", "danger"))
        badges.addWidget(self._make_badge("Danh sách cho phép", "soft"))
        badges.addStretch()
        layout.addLayout(badges)

        editors = QtWidgets.QHBoxLayout()
        blocked_column = QtWidgets.QVBoxLayout()
        blocked_column.addWidget(self._section_label("Web bị chặn"))
        self.blocked_edit = QtWidgets.QPlainTextEdit()
        self.blocked_edit.setObjectName("CodeLikeEdit")
        self.blocked_edit.setMinimumHeight(430)
        blocked_column.addWidget(self.blocked_edit)

        allowed_column = QtWidgets.QVBoxLayout()
        allowed_column.addWidget(self._section_label("Web được phép"))
        self.allowed_edit = QtWidgets.QPlainTextEdit()
        self.allowed_edit.setObjectName("CodeLikeEdit")
        self.allowed_edit.setMinimumHeight(430)
        allowed_column.addWidget(self.allowed_edit)

        editors.addLayout(blocked_column, 1)
        editors.addLayout(allowed_column, 1)
        layout.addLayout(editors)
        return frame

    def _create_strict_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Chế độ nghiêm khắc và khóa thủ công",
            "Chế độ nghiêm khắc sẽ khóa máy trong khung giờ cấm. Đếm ngược khóa thủ công cho phép đặt khóa ngay cả khi chưa đến lịch.",
        )
        self.strict_note_label = QtWidgets.QLabel(
            "Cần đặt mật khẩu trước khi dùng chế độ nghiêm khắc hoặc khóa thủ công."
        )
        self.strict_note_label.setWordWrap(True)
        self.strict_note_label.setObjectName("MutedLabel")
        layout.addWidget(self.strict_note_label)

        self.password_edit = QtWidgets.QLineEdit()
        self.password_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
        self.password_edit.setPlaceholderText("Mật khẩu mới")
        self.password_edit.setObjectName("SoftInput")
        layout.addWidget(self.password_edit)

        self.password_confirm_edit = QtWidgets.QLineEdit()
        self.password_confirm_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
        self.password_confirm_edit.setPlaceholderText("Nhập lại mật khẩu")
        self.password_confirm_edit.setObjectName("SoftInput")
        layout.addWidget(self.password_confirm_edit)

        manual_row = QtWidgets.QGridLayout()
        manual_row.setHorizontalSpacing(12)
        self.manual_countdown_spin = self._spin_box(1, 120, " phút")
        self.manual_duration_spin = self._spin_box(5, 480, " phút")
        manual_row.addWidget(self._labeled_widget("Khóa sau", self.manual_countdown_spin), 0, 0)
        manual_row.addWidget(self._labeled_widget("Tự mở sau", self.manual_duration_spin), 0, 1)
        layout.addLayout(manual_row)

        actions = QtWidgets.QHBoxLayout()
        self.manual_lock_button = QtWidgets.QPushButton("Bật đếm ngược khóa")
        self.manual_lock_button.setObjectName("PrimaryButton")
        actions.addWidget(self.manual_lock_button)
        self.cancel_manual_lock_button = QtWidgets.QPushButton("Hủy khóa thủ công")
        self.cancel_manual_lock_button.setObjectName("SecondaryButton")
        actions.addWidget(self.cancel_manual_lock_button)
        layout.addLayout(actions)

        self.manual_lock_label = QtWidgets.QLabel("Không có khóa thủ công nào đang chờ.")
        self.manual_lock_label.setObjectName("MutedLabel")
        self.manual_lock_label.setWordWrap(True)
        layout.addWidget(self.manual_lock_label)

        recovery_box = QtWidgets.QFrame()
        recovery_box.setObjectName("InsetCard")
        recovery_layout = QtWidgets.QVBoxLayout(recovery_box)
        recovery_layout.setContentsMargins(16, 16, 16, 16)
        recovery_layout.setSpacing(10)
        recovery_layout.addWidget(self._section_label("Khôi phục và quên mật khẩu"))
        self.recovery_status_label = QtWidgets.QLabel("Chưa tạo mã khôi phục.")
        self.recovery_status_label.setObjectName("MutedLabel")
        self.recovery_status_label.setWordWrap(True)
        recovery_layout.addWidget(self.recovery_status_label)
        recovery_actions = QtWidgets.QHBoxLayout()
        self.recovery_key_button = QtWidgets.QPushButton("Tạo / xoay mã khôi phục")
        self.recovery_key_button.setObjectName("SecondaryButton")
        recovery_actions.addWidget(self.recovery_key_button)
        self.forgot_password_button = QtWidgets.QPushButton("Quên mật khẩu")
        self.forgot_password_button.setObjectName("SecondaryButton")
        recovery_actions.addWidget(self.forgot_password_button)
        recovery_layout.addLayout(recovery_actions)
        layout.addWidget(recovery_box)
        return frame

    def _create_system_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Hệ thống và dịch vụ",
            "Khởi động cùng Windows để cơ chế bảo vệ có mặt sớm. Dịch vụ nền của Windows sẽ giữ tín hiệu sống, file hosts và cấu hình chờ áp dụng ở tầng nền.",
        )
        self.start_with_windows_checkbox = QtWidgets.QCheckBox("Khởi động cùng Windows và vào nền")
        self.start_with_windows_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.start_with_windows_checkbox)

        self.service_enabled_checkbox = QtWidgets.QCheckBox("Bật giám sát dịch vụ")
        self.service_enabled_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.service_enabled_checkbox)

        service_box = QtWidgets.QFrame()
        service_box.setObjectName("InsetCard")
        service_layout = QtWidgets.QVBoxLayout(service_box)
        service_layout.setContentsMargins(16, 16, 16, 16)
        service_layout.setSpacing(8)
        service_layout.addWidget(self._section_label("Trạng thái hệ thống"))

        self.admin_hint_label = QtWidgets.QLabel("Đang kiểm tra quyền Admin.")
        self.admin_hint_label.setObjectName("MutedLabel")
        self.admin_hint_label.setWordWrap(True)
        service_layout.addWidget(self.admin_hint_label)

        self.service_hint_label = QtWidgets.QLabel("Đang kiểm tra dịch vụ.")
        self.service_hint_label.setObjectName("MutedLabel")
        self.service_hint_label.setWordWrap(True)
        service_layout.addWidget(self.service_hint_label)
        layout.addWidget(service_box)

        self.auto_check_updates_checkbox = QtWidgets.QCheckBox("Tự động kiểm tra cập nhật")
        self.auto_check_updates_checkbox.setObjectName("SoftCheck")
        layout.addWidget(self.auto_check_updates_checkbox)

        update_actions = QtWidgets.QHBoxLayout()
        self.check_update_button = QtWidgets.QPushButton("Kiểm tra cập nhật")
        self.check_update_button.setObjectName("SecondaryButton")
        update_actions.addWidget(self.check_update_button)
        self.cleanup_versions_button = QtWidgets.QPushButton("Dọn bản cũ")
        self.cleanup_versions_button.setObjectName("SecondaryButton")
        update_actions.addWidget(self.cleanup_versions_button)
        layout.addLayout(update_actions)

        self.update_hint_label = QtWidgets.QLabel("Phiên bản hiện tại: " + __version__)
        self.update_hint_label.setObjectName("MutedLabel")
        self.update_hint_label.setWordWrap(True)
        layout.addWidget(self.update_hint_label)

        self.uninstall_button = QtWidgets.QPushButton("Gỡ cài đặt chuyên nghiệp")
        self.uninstall_button.setObjectName("DangerButton")
        layout.addWidget(self.uninstall_button)
        return frame

    def _create_guardrail_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Chế độ an toàn và trì hoãn",
            "Phần này giúp nhìn rõ cấu hình chờ áp dụng, cảnh báo dịch vụ và lý do khi app phát hiện enforcement không còn đầy đủ.",
        )
        self.pending_change_label = QtWidgets.QLabel("Không có thay đổi trì hoãn.")
        self.pending_change_label.setObjectName("MutedLabel")
        self.pending_change_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Cấu hình chờ áp dụng", self.pending_change_label))

        self.next_window_label = QtWidgets.QLabel("Không có lịch tiếp theo.")
        self.next_window_label.setObjectName("MutedLabel")
        self.next_window_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Khung giờ tiếp theo", self.next_window_label))

        self.safe_mode_label = QtWidgets.QLabel("Không có cảnh báo an toàn.")
        self.safe_mode_label.setObjectName("MutedLabel")
        self.safe_mode_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Chế độ an toàn", self.safe_mode_label))
        return frame

    def _create_study_overview_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Tổng quan học tập",
            "Theo dõi phiên học hiện tại, profile đang dùng và phiên kế tiếp mà không phải chuyển tab.",
        )
        self.study_overview_status = QtWidgets.QLabel("Chưa có phiên học đang chạy.")
        self.study_overview_status.setObjectName("MutedLabel")
        self.study_overview_status.setWordWrap(True)
        layout.addWidget(self._labeled_value("Trạng thái phiên học", self.study_overview_status))

        self.study_overview_profile = QtWidgets.QLabel("Phiên học sâu")
        self.study_overview_profile.setObjectName("MutedLabel")
        self.study_overview_profile.setWordWrap(True)
        layout.addWidget(self._labeled_value("Profile hiện tại", self.study_overview_profile))

        self.study_overview_next = QtWidgets.QLabel("Không có phiên học theo lịch.")
        self.study_overview_next.setObjectName("MutedLabel")
        self.study_overview_next.setWordWrap(True)
        layout.addWidget(self._labeled_value("Phiên học tiếp theo", self.study_overview_next))

        self.study_overview_warning = QtWidgets.QLabel("Chưa có cảnh báo gần đây.")
        self.study_overview_warning.setObjectName("MutedLabel")
        self.study_overview_warning.setWordWrap(True)
        layout.addWidget(self._labeled_value("Cảnh báo gần nhất", self.study_overview_warning))
        return frame

    def _create_study_report_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Báo cáo học tập",
            "Báo cáo 7 ngày gom streak, thời lượng học sâu và các nguồn xao nhãng bị siết mạnh nhất.",
        )
        grid = QtWidgets.QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(12)
        items = [
            ("study_sessions_completed", "Phiên hoàn thành"),
            ("study_sessions_aborted", "Phiên dừng sớm"),
            ("study_minutes", "Phút học sâu"),
            ("average_study_minutes", "TB mỗi phiên"),
            ("study_site_blocks", "Web bị siết"),
            ("study_app_blocks", "App bị chặn"),
            ("current_streak", "Streak hiện tại"),
            ("best_streak", "Streak tốt nhất"),
        ]
        for index, (key, label) in enumerate(items):
            card, value = self._mini_card(label)
            self._stats_labels[key] = value
            grid.addWidget(card, index // 2, index % 2)
        layout.addLayout(grid)

        self.study_profile_distribution_label = QtWidgets.QLabel("Chưa có phân bổ theo profile.")
        self.study_profile_distribution_label.setObjectName("MutedLabel")
        self.study_profile_distribution_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Phân bổ theo profile", self.study_profile_distribution_label))

        self.study_distraction_label = QtWidgets.QLabel("Chưa ghi nhận nguồn xao nhãng nào.")
        self.study_distraction_label.setObjectName("MutedLabel")
        self.study_distraction_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Nguồn xao nhãng nổi bật", self.study_distraction_label))
        return frame

    def _create_study_session_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Phiên học sâu",
            "Bắt đầu thủ công bất cứ lúc nào, theo dõi đồng hồ đếm ngược và chỉ cho phép tài nguyên học tập đã cấu hình.",
        )
        selector_row = QtWidgets.QGridLayout()
        selector_row.setHorizontalSpacing(12)
        selector_row.setVerticalSpacing(12)
        self.study_manual_profile_combo = QtWidgets.QComboBox()
        self.study_manual_profile_combo.setObjectName("SoftInput")
        self.study_duration_spin = self._spin_box(15, 240, " phút")
        self.study_duration_spin.setValue(50)
        selector_row.addWidget(self._labeled_widget("Profile học", self.study_manual_profile_combo), 0, 0)
        selector_row.addWidget(self._labeled_widget("Thời lượng", self.study_duration_spin), 0, 1)
        layout.addLayout(selector_row)

        actions = QtWidgets.QHBoxLayout()
        self.start_study_button = QtWidgets.QPushButton("Bắt đầu phiên học")
        self.start_study_button.setObjectName("PrimaryButton")
        actions.addWidget(self.start_study_button)
        self.abort_study_button = QtWidgets.QPushButton("Giữ 3 giây để dừng sớm")
        self.abort_study_button.setObjectName("SecondaryButton")
        actions.addWidget(self.abort_study_button)
        layout.addLayout(actions)

        self.study_active_label = QtWidgets.QLabel("Chưa có phiên học đang chạy.")
        self.study_active_label.setObjectName("MutedLabel")
        self.study_active_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Phiên hiện tại", self.study_active_label))

        self.study_countdown_label = QtWidgets.QLabel("Sẵn sàng bắt đầu thủ công.")
        self.study_countdown_label.setObjectName("MutedLabel")
        self.study_countdown_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Đồng hồ đếm ngược", self.study_countdown_label))

        resources_box = QtWidgets.QFrame()
        resources_box.setObjectName("InsetCard")
        resources_layout = QtWidgets.QVBoxLayout(resources_box)
        resources_layout.setContentsMargins(16, 16, 16, 16)
        resources_layout.setSpacing(10)
        resources_layout.addWidget(self._section_label("Tài nguyên học nhanh"))
        self.study_resources_flow = QtWidgets.QVBoxLayout()
        self.study_resources_flow.setSpacing(8)
        resources_layout.addLayout(self.study_resources_flow)
        layout.addWidget(resources_box)
        return frame

    def _create_study_profile_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Cấu hình profile học",
            "Mỗi profile có tài nguyên học, app được dùng và danh sách web hoặc app xao nhãng cần siết trong phiên học.",
        )
        header = QtWidgets.QHBoxLayout()
        self.study_profile_combo = QtWidgets.QComboBox()
        self.study_profile_combo.setObjectName("SoftInput")
        header.addWidget(self.study_profile_combo, 1)
        self.add_study_profile_button = QtWidgets.QPushButton("Thêm profile")
        self.add_study_profile_button.setObjectName("SecondaryButton")
        header.addWidget(self.add_study_profile_button)
        self.remove_study_profile_button = QtWidgets.QPushButton("Xóa profile")
        self.remove_study_profile_button.setObjectName("SecondaryButton")
        header.addWidget(self.remove_study_profile_button)
        layout.addLayout(header)

        self.study_profile_name_edit = QtWidgets.QLineEdit()
        self.study_profile_name_edit.setPlaceholderText("Tên profile học")
        self.study_profile_name_edit.setObjectName("SoftInput")
        layout.addWidget(self.study_profile_name_edit)

        self.study_profile_duration_spin = self._spin_box(15, 240, " phút")
        layout.addWidget(self._labeled_widget("Thời lượng mặc định", self.study_profile_duration_spin))

        editors = QtWidgets.QGridLayout()
        editors.setHorizontalSpacing(12)
        editors.setVerticalSpacing(12)
        self.study_domains_edit = QtWidgets.QPlainTextEdit()
        self.study_domains_edit.setObjectName("CodeLikeEdit")
        self.study_domains_edit.setMinimumHeight(120)
        editors.addWidget(self._labeled_widget("Website học được giữ lại", self.study_domains_edit), 0, 0)
        self.study_urls_edit = QtWidgets.QPlainTextEdit()
        self.study_urls_edit.setObjectName("CodeLikeEdit")
        self.study_urls_edit.setMinimumHeight(120)
        editors.addWidget(self._labeled_widget("Link học mở nhanh", self.study_urls_edit), 0, 1)
        self.study_allowed_apps_edit = QtWidgets.QPlainTextEdit()
        self.study_allowed_apps_edit.setObjectName("CodeLikeEdit")
        self.study_allowed_apps_edit.setMinimumHeight(120)
        editors.addWidget(self._labeled_widget("App học được mở nhanh", self.study_allowed_apps_edit), 1, 0)
        self.study_blocked_apps_edit = QtWidgets.QPlainTextEdit()
        self.study_blocked_apps_edit.setObjectName("CodeLikeEdit")
        self.study_blocked_apps_edit.setMinimumHeight(120)
        editors.addWidget(self._labeled_widget("Process xao nhãng cần chặn", self.study_blocked_apps_edit), 1, 1)
        self.study_extra_domains_edit = QtWidgets.QPlainTextEdit()
        self.study_extra_domains_edit.setObjectName("CodeLikeEdit")
        self.study_extra_domains_edit.setMinimumHeight(120)
        editors.addWidget(self._labeled_widget("Domain xao nhãng bổ sung", self.study_extra_domains_edit), 2, 0, 1, 2)
        layout.addLayout(editors)
        return frame

    def _create_study_schedule_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Lịch học theo từng ngày",
            "Mỗi ngày có thể bật hoặc tắt riêng và gắn với một profile học. Lịch này tách khỏi lịch bảo vệ để bạn không bị trộn khái niệm.",
        )
        header = QtWidgets.QGridLayout()
        header.setHorizontalSpacing(10)
        header.addWidget(self._section_label("Ngày"), 0, 0)
        header.addWidget(self._section_label("Bật/Tắt"), 0, 1)
        header.addWidget(self._section_label("Bắt đầu"), 0, 2)
        header.addWidget(self._section_label("Kết thúc"), 0, 3)
        header.addWidget(self._section_label("Profile"), 0, 4)
        layout.addLayout(header)

        grid = QtWidgets.QGridLayout()
        grid.setHorizontalSpacing(10)
        grid.setVerticalSpacing(10)
        for row, key in enumerate(WEEKDAY_KEYS):
            day_label = QtWidgets.QLabel(WEEKDAY_LABELS[key])
            day_label.setObjectName("InsetTitle")
            checkbox = QtWidgets.QCheckBox("Bật")
            checkbox.setObjectName("SoftCheck")
            start_edit = self._create_time_edit()
            end_edit = self._create_time_edit()
            profile_combo = QtWidgets.QComboBox()
            profile_combo.setObjectName("SoftInput")
            self._study_day_editors[key] = (checkbox, start_edit, end_edit, profile_combo)
            grid.addWidget(day_label, row, 0)
            grid.addWidget(checkbox, row, 1)
            grid.addWidget(start_edit, row, 2)
            grid.addWidget(end_edit, row, 3)
            grid.addWidget(profile_combo, row, 4)
        layout.addLayout(grid)

        self.study_next_label = QtWidgets.QLabel("Không có phiên học theo lịch.")
        self.study_next_label.setObjectName("MutedLabel")
        self.study_next_label.setWordWrap(True)
        layout.addWidget(self._labeled_value("Phiên học kế tiếp", self.study_next_label))
        return frame

    def _create_stats_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Thống kê 7 ngày",
            "Thống kê được tính từ trạng thái chạy và nhật ký chống phá.",
        )
        grid = QtWidgets.QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(12)
        items = [
            ("blocked_minutes", "Phút bị chặn"),
            ("schedule_sessions", "Buổi theo lịch"),
            ("strict_sessions", "Buổi nghiêm khắc"),
            ("warnings_sent", "Cảnh báo"),
            ("failed_unlocks", "Nhập sai"),
            ("tamper_events", "Dấu hiệu phá"),
            ("pending_changes", "Lần trì hoãn"),
        ]
        for index, (key, label) in enumerate(items):
            card, value = self._mini_card(label)
            self._stats_labels[key] = value
            grid.addWidget(card, index // 2, index % 2)
        layout.addLayout(grid)
        return frame

    def _create_log_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Nhật ký chống phá",
            "Mọi cảnh báo, cấu hình chờ áp dụng, mở dịch vụ hay nhập sai mật khẩu đều được ghi vào đây.",
        )
        self.log_filter_combo = QtWidgets.QComboBox()
        self.log_filter_combo.setObjectName("SoftInput")
        self.log_filter_combo.addItems(["Tất cả", "Học tập", "Cảnh báo", "Chống phá", "Nghiêm khắc"])
        layout.addWidget(self._labeled_widget("Bộ lọc nhật ký", self.log_filter_combo))
        self.log_output = QtWidgets.QPlainTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setObjectName("LogOutput")
        self.log_output.setMinimumHeight(500)
        layout.addWidget(self.log_output)
        return frame

    def _build_tray(self) -> None:
        icon = self.style().standardIcon(QtWidgets.QStyle.StandardPixmap.SP_ComputerIcon)
        self.tray_icon = QtWidgets.QSystemTrayIcon(icon, self)
        self.setWindowIcon(icon)
        menu = QtWidgets.QMenu(self)
        menu.addAction("Mở cửa sổ").triggered.connect(self._restore_from_tray)
        menu.addAction("Bật / Tắt bảo vệ").triggered.connect(self.toggle_protection)
        menu.addAction("Thoát").triggered.connect(self._quit_from_tray)
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
        self.recovery_key_button.clicked.connect(self.rotate_recovery_key)
        self.forgot_password_button.clicked.connect(self.start_password_recovery)
        self.start_study_button.clicked.connect(self.start_study_session)
        self.abort_study_button.pressed.connect(self._begin_abort_hold)
        self.abort_study_button.released.connect(self._cancel_abort_hold)
        self.add_study_profile_button.clicked.connect(self.add_study_profile)
        self.remove_study_profile_button.clicked.connect(self.remove_study_profile)
        self.study_profile_combo.currentIndexChanged.connect(self._on_study_profile_selection_changed)
        self.study_manual_profile_combo.currentIndexChanged.connect(self._sync_manual_duration_from_profile)
        self.study_manual_profile_combo.currentIndexChanged.connect(
            self._refresh_study_manual_profile_preview
        )
        self.log_filter_combo.currentIndexChanged.connect(self._refresh_log_view)
        self.check_update_button.clicked.connect(self.check_for_updates_manual)
        self.cleanup_versions_button.clicked.connect(self.cleanup_cached_updates)
        self.uninstall_button.clicked.connect(self.start_professional_uninstall)

        self.update_manager.check_completed.connect(self._on_update_check_completed)
        self.update_manager.download_completed.connect(self._on_update_download_completed)
        self.update_manager.cleanup_completed.connect(self._on_update_cleanup_completed)

        for checkbox, start_edit, end_edit in self._day_editors.values():
            checkbox.toggled.connect(self._refresh_schedule_preview)
            start_edit.timeChanged.connect(self._refresh_schedule_preview)
            end_edit.timeChanged.connect(self._refresh_schedule_preview)

        for checkbox, start_edit, end_edit, _profile_combo in self._study_day_editors.values():
            checkbox.toggled.connect(self._refresh_schedule_preview)
            start_edit.timeChanged.connect(self._refresh_schedule_preview)
            end_edit.timeChanged.connect(self._refresh_schedule_preview)

        self._hold_abort_timer = QtCore.QTimer(self)
        self._hold_abort_timer.setInterval(1000)
        self._hold_abort_timer.timeout.connect(self._tick_abort_hold)

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
        self._study_profiles_cache = [
            StudyProfile.from_dict(profile.to_dict(), fallback_id=profile.id)
            for profile in config.study_profiles
        ] or [StudyProfile(id="study-default", name="Phiên học sâu")]
        self._refresh_study_profile_selectors()
        for key, schedule in config.study_schedule.items():
            checkbox, start_edit, end_edit, profile_combo = self._study_day_editors[key]
            checkbox.setChecked(schedule.enabled)
            start_edit.setTime(QtCore.QTime.fromString(schedule.start, "HH:mm"))
            end_edit.setTime(QtCore.QTime.fromString(schedule.end, "HH:mm"))
            self._set_combo_to_profile(profile_combo, schedule.profile_id)
        self._load_selected_study_profile()
        self._refresh_study_manual_profile_preview()
        self.strict_note_label.setText(
            "Mật khẩu đã được thiết lập."
            if config.has_password
            else "Cần đặt mật khẩu trước khi dùng chế độ nghiêm khắc hoặc khóa thủ công."
        )
        recovery_state = "Đã tạo mã khôi phục." if config.has_recovery_key else "Chưa tạo mã khôi phục."
        if self.controller.state.recovery_request is not None:
            recovery_state += " " + self.controller.emergency_recovery_status_text()
        self.recovery_status_label.setText(recovery_state)
        self._refresh_schedule_preview()
        self._refresh_log_view()

    def _apply_status(self, status: EnforcementStatus) -> None:
        self._last_status = status
        self.toggle_button.setText("Tắt bảo vệ" if status.protection_enabled else "Bật bảo vệ")
        self.overview_badge.setText(
            "Chế độ an toàn"
            if status.safe_mode
            else "Đang chặn"
            if status.schedule_active
            else "Đã bật"
            if status.protection_enabled
            else "Tạm dừng"
        )
        self._set_badge_variant(
            self.overview_badge,
            "danger" if status.safe_mode else "danger" if status.lock_active else "warm" if status.protection_enabled else "secondary",
        )
        self.side_summary_label.setText(status.summary)
        self.summary_label.setText(status.summary)
        self.status_value.setText(
            "Đang khóa"
            if status.lock_active
            else "Đang chặn"
            if status.schedule_active
            else "Chờ lịch"
            if status.protection_enabled
            else "Tạm dừng"
        )
        self.mode_value.setText("Nghiêm khắc" if status.mode == "strict" else "Bình thường")
        self.window_value.setText(status.today_schedule_label)
        self.service_value.setText("Sẵn sàng" if status.service_alive else "Cần kiểm tra")
        self.banner_mode_tag.setText("Nghiêm khắc" if status.mode == "strict" else "Bình thường")
        self._set_badge_variant(self.banner_mode_tag, "danger" if status.mode == "strict" else "warm")
        self.banner_service_tag.setText("Dịch vụ ổn" if status.service_alive else "Dịch vụ yếu")
        self._set_badge_variant(self.banner_service_tag, "success" if status.service_alive else "secondary")
        self.banner_safe_tag.setText("Chế độ an toàn" if status.safe_mode else "Ổn định")
        self._set_badge_variant(self.banner_safe_tag, "danger" if status.safe_mode else "success")

        self.schedule_big_label.setText(status.today_schedule_label)
        self.schedule_preview_label.setText(f"Tiếp theo: {status.next_window_text}")
        self.manual_lock_label.setText(status.manual_countdown_text)
        self.pending_change_label.setText(status.pending_change_text)
        self.next_window_label.setText(status.next_window_text)
        self.safe_mode_label.setText(status.safe_mode_reason or "Không có cảnh báo an toàn.")
        self.study_active_label.setText(status.study_summary)
        self.study_countdown_label.setText(status.study_remaining_text)
        self.study_overview_status.setText(status.study_summary)
        manual_profile = self._current_manual_study_profile()
        self.study_overview_profile.setText(
            status.study_profile_name
            if status.study_active
            else manual_profile.name if manual_profile is not None else status.study_profile_name
        )
        self.study_overview_next.setText(status.next_study_text)
        self.study_overview_warning.setText(self._latest_warning_text())
        self.study_next_label.setText(status.next_study_text)
        recovery_status = (
            "Đã tạo mã khôi phục." if self.controller.config.has_recovery_key else "Chưa tạo mã khôi phục."
        )
        if self.controller.state.recovery_request is not None:
            recovery_status += " " + self.controller.emergency_recovery_status_text()
        self.recovery_status_label.setText(recovery_status)
        self.admin_hint_label.setText(
            "Đang chạy với quyền Admin."
            if status.admin
            else "Đang chạy quyền thường. Không được phép sửa hosts trực tiếp."
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
            "study_sessions_completed": str(stats.study_sessions_completed),
            "study_sessions_aborted": str(stats.study_sessions_aborted),
            "study_minutes": str(stats.study_minutes),
            "average_study_minutes": str(stats.average_study_minutes),
            "study_site_blocks": str(stats.study_site_blocks),
            "study_app_blocks": str(stats.study_app_blocks),
            "current_streak": str(stats.current_streak),
            "best_streak": str(stats.best_streak),
        }
        for key, value in mapping.items():
            label = self._stats_labels.get(key)
            if label is not None:
                label.setText(value)
        self.study_profile_distribution_label.setText(self._format_distribution(stats.profile_distribution))
        self.study_distraction_label.setText(self._format_distractions(stats.top_blocked_domains, stats.top_blocked_apps))
        if status.study_active:
            self._refresh_study_resource_buttons(status.study_resources, status.study_allowed_apps)
        else:
            self._refresh_study_manual_profile_preview()

    def _append_log(self, message: str) -> None:
        self._refresh_log_view()

    def _show_attention(self, title: str, message: str) -> None:
        self.tray_icon.showMessage(title, message, self.windowIcon(), 6000)

    def _refresh_schedule_preview(self) -> None:
        today_key = WEEKDAY_KEYS[datetime.now().weekday()]
        checkbox, start_edit, end_edit = self._day_editors[today_key]
        if checkbox.isChecked():
            label = f"{start_edit.time().toString('HH:mm')} -> {end_edit.time().toString('HH:mm')}"
        else:
            label = "Tắt"
        self.schedule_big_label.setText(label)
        self.schedule_preview_label.setText(
            "Gemini được giữ lại trong danh sách cho phép. Các thay đổi sát giờ khóa có thể bị trì hoãn."
        )
        if self._last_status:
            self.window_value.setText(label)

        study_checkbox, study_start, study_end, _ = self._study_day_editors[today_key]
        study_label = (
            f"{study_start.time().toString('HH:mm')} -> {study_end.time().toString('HH:mm')}"
            if study_checkbox.isChecked()
            else "Tắt"
        )
        if hasattr(self, "study_next_label") and not self._last_status:
            self.study_next_label.setText(f"Hôm nay: {study_label}")

    def _current_study_profile_id(self) -> str:
        data = self.study_profile_combo.currentData()
        if isinstance(data, str) and data:
            return data
        if self._study_profiles_cache:
            return self._study_profiles_cache[0].id
        return "study-default"

    def _current_manual_study_profile(self) -> StudyProfile | None:
        if not self._study_profiles_cache:
            return None
        profile_id = self.study_manual_profile_combo.currentData()
        if isinstance(profile_id, str) and profile_id:
            return next(
                (item for item in self._study_profiles_cache if item.id == profile_id),
                self._study_profiles_cache[0],
            )
        return self._study_profiles_cache[0]

    def _collect_text_lines(self, edit: QtWidgets.QPlainTextEdit) -> list[str]:
        return [line.strip() for line in edit.toPlainText().splitlines() if line.strip()]

    def _populate_profile_combo(self, combo: QtWidgets.QComboBox, selected_id: str | None = None) -> None:
        current = selected_id or combo.currentData()
        combo.blockSignals(True)
        combo.clear()
        for profile in self._study_profiles_cache:
            combo.addItem(profile.name, profile.id)
        if current:
            index = combo.findData(current)
            if index >= 0:
                combo.setCurrentIndex(index)
        combo.blockSignals(False)

    def _set_combo_to_profile(self, combo: QtWidgets.QComboBox, profile_id: str) -> None:
        index = combo.findData(profile_id)
        if index >= 0:
            combo.setCurrentIndex(index)

    def _refresh_study_profile_selectors(self) -> None:
        current_editor_id = (
            self._study_profile_editing_id
            or self._current_study_profile_id()
            or self._study_profiles_cache[0].id
        )
        manual_id = self.study_manual_profile_combo.currentData()
        if not isinstance(manual_id, str) or not manual_id:
            manual_id = current_editor_id
        self._populate_profile_combo(self.study_profile_combo, current_editor_id)
        self._populate_profile_combo(self.study_manual_profile_combo, manual_id)
        for _, _, _, profile_combo in self._study_day_editors.values():
            previous = profile_combo.currentData()
            self._populate_profile_combo(profile_combo, previous or current_editor_id)
        self._sync_manual_duration_from_profile()

    def _save_selected_study_profile_into_cache(self, profile_id: str | None = None) -> None:
        if self._study_profile_loading or not self._study_profiles_cache:
            return
        current_id = profile_id or self._study_profile_editing_id or self._current_study_profile_id()
        for index, profile in enumerate(self._study_profiles_cache):
            if profile.id != current_id:
                continue
            self._study_profiles_cache[index] = StudyProfile(
                id=profile.id,
                name=self.study_profile_name_edit.text().strip() or profile.name,
                default_duration_minutes=self.study_profile_duration_spin.value(),
                study_domains=dedupe_domains(self._collect_text_lines(self.study_domains_edit)),
                resource_urls=dedupe_text_values(self._collect_text_lines(self.study_urls_edit)),
                allowed_apps=dedupe_text_values(self._collect_text_lines(self.study_allowed_apps_edit)),
                blocked_processes=dedupe_processes(self._collect_text_lines(self.study_blocked_apps_edit)),
                extra_blocked_domains=dedupe_domains(self._collect_text_lines(self.study_extra_domains_edit)),
            )
            break
        self._refresh_study_profile_selectors()

    def _load_selected_study_profile(self, profile_id: str | None = None) -> None:
        if not self._study_profiles_cache:
            self._study_profiles_cache = [StudyProfile(id="study-default", name="Phiên học sâu")]
        current_id = profile_id or self._current_study_profile_id()
        profile = next(
            (item for item in self._study_profiles_cache if item.id == current_id),
            self._study_profiles_cache[0],
        )
        self._study_profile_loading = True
        self._set_combo_to_profile(self.study_profile_combo, profile.id)
        self.study_profile_name_edit.setText(profile.name)
        self.study_profile_duration_spin.setValue(profile.default_duration_minutes)
        self.study_domains_edit.setPlainText("\n".join(profile.study_domains))
        self.study_urls_edit.setPlainText("\n".join(profile.resource_urls))
        self.study_allowed_apps_edit.setPlainText("\n".join(profile.allowed_apps))
        self.study_blocked_apps_edit.setPlainText("\n".join(profile.blocked_processes))
        self.study_extra_domains_edit.setPlainText("\n".join(profile.extra_blocked_domains))
        self._study_profile_loading = False
        self._study_profile_editing_id = profile.id
        self._sync_manual_duration_from_profile()

    def _on_study_profile_selection_changed(self) -> None:
        if self._study_profile_loading:
            return
        previous_id = self._study_profile_editing_id
        new_id = self._current_study_profile_id()
        if previous_id:
            self._save_selected_study_profile_into_cache(previous_id)
        self._load_selected_study_profile(new_id)

    def _sync_manual_duration_from_profile(self) -> None:
        profile = self._current_manual_study_profile()
        if profile is None:
            return
        self.study_duration_spin.setValue(profile.default_duration_minutes)

    def _refresh_study_manual_profile_preview(self) -> None:
        profile = self._current_manual_study_profile()
        if profile is None:
            self._refresh_study_resource_buttons([], [])
            return
        self._refresh_study_resource_buttons(profile.resource_urls, profile.allowed_apps)

    def _next_study_profile_id(self) -> str:
        existing = {profile.id for profile in self._study_profiles_cache}
        index = 1
        while True:
            candidate = f"study-{index}"
            if candidate not in existing:
                return candidate
            index += 1

    def add_study_profile(self) -> None:
        self._save_selected_study_profile_into_cache()
        profile_id = self._next_study_profile_id()
        profile = StudyProfile(id=profile_id, name=f"Phiên học {len(self._study_profiles_cache) + 1}")
        self._study_profiles_cache.append(profile)
        self._study_profile_editing_id = profile_id
        self._refresh_study_profile_selectors()
        self._set_combo_to_profile(self.study_profile_combo, profile_id)
        self._set_combo_to_profile(self.study_manual_profile_combo, profile_id)
        self._load_selected_study_profile(profile_id)
        self._refresh_study_manual_profile_preview()

    def remove_study_profile(self) -> None:
        if len(self._study_profiles_cache) <= 1:
            self._show_warning("Không thể xóa", "App cần giữ ít nhất một profile học.")
            return
        current_id = self._study_profile_editing_id or self._current_study_profile_id()
        self._study_profiles_cache = [item for item in self._study_profiles_cache if item.id != current_id]
        fallback_id = self._study_profiles_cache[0].id
        self._study_profile_editing_id = fallback_id
        self._refresh_study_profile_selectors()
        for _, _, _, profile_combo in self._study_day_editors.values():
            if profile_combo.currentData() == current_id or profile_combo.currentIndex() < 0:
                self._set_combo_to_profile(profile_combo, fallback_id)
        self._set_combo_to_profile(self.study_profile_combo, fallback_id)
        self._set_combo_to_profile(self.study_manual_profile_combo, fallback_id)
        self._load_selected_study_profile(fallback_id)
        self._refresh_study_manual_profile_preview()

    def _build_study_profiles_from_ui(self) -> list[StudyProfile]:
        self._save_selected_study_profile_into_cache()
        return [
            StudyProfile.from_dict(profile.to_dict(), fallback_id=profile.id)
            for profile in self._study_profiles_cache
        ]

    def _refresh_study_resource_buttons(self, resources: list[str], allowed_apps: list[str]) -> None:
        self._clear_layout(self.study_resources_flow)
        if not resources and not allowed_apps:
            placeholder = QtWidgets.QLabel("Chưa cấu hình tài nguyên học nhanh cho profile này.")
            placeholder.setObjectName("MutedLabel")
            placeholder.setWordWrap(True)
            self.study_resources_flow.addWidget(placeholder)
            return

        for url in resources[:4]:
            button = QtWidgets.QPushButton(url)
            button.setObjectName("SecondaryButton")
            button.clicked.connect(lambda _checked=False, target=url: self._launch_study_resource(target))
            self.study_resources_flow.addWidget(button)

        for app_path in allowed_apps[:3]:
            button = QtWidgets.QPushButton(Path(app_path).name or app_path)
            button.setObjectName("SecondaryButton")
            button.clicked.connect(lambda _checked=False, target=app_path: self._launch_study_app(target))
            self.study_resources_flow.addWidget(button)

    def _clear_layout(self, layout: QtWidgets.QLayout) -> None:
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            child_layout = item.layout()
            if widget is not None:
                widget.deleteLater()
            elif child_layout is not None:
                self._clear_layout(child_layout)

    def _launch_study_resource(self, target: str) -> None:
        QtGui.QDesktopServices.openUrl(QtCore.QUrl(target))

    def _launch_study_app(self, target: str) -> None:
        try:
            subprocess.Popen([target])
        except OSError as exc:
            self._show_warning("Không mở được app học", str(exc))

    def start_study_session(self) -> None:
        profile_id = self.study_manual_profile_combo.currentData()
        if not isinstance(profile_id, str):
            self._show_warning("Chưa có profile", "Hãy tạo hoặc chọn một profile học trước.")
            return
        success, message = self.controller.start_study_session(
            profile_id,
            duration_minutes=self.study_duration_spin.value(),
        )
        if not success:
            self._show_warning("Không bắt đầu được phiên học", message)

    def _begin_abort_hold(self) -> None:
        if self.controller.state.study_session is None:
            return
        self._hold_abort_remaining = 3
        self.abort_study_button.setText("Giữ thêm 3 giây...")
        if self._hold_abort_timer is not None:
            self._hold_abort_timer.start()

    def _tick_abort_hold(self) -> None:
        self._hold_abort_remaining -= 1
        if self._hold_abort_remaining <= 0:
            if self._hold_abort_timer is not None:
                self._hold_abort_timer.stop()
            self.abort_study_button.setText("Giữ 3 giây để dừng sớm")
            self._confirm_abort_study_session()
            return
        self.abort_study_button.setText(f"Giữ thêm {self._hold_abort_remaining} giây...")

    def _cancel_abort_hold(self) -> None:
        if self._hold_abort_timer is not None:
            self._hold_abort_timer.stop()
        self.abort_study_button.setText("Giữ 3 giây để dừng sớm")

    def _confirm_abort_study_session(self) -> None:
        reason, ok = QtWidgets.QInputDialog.getText(
            self,
            "Dừng sớm phiên học",
            "Lý do dừng sớm:",
        )
        if not ok:
            return
        success, message = self.controller.abort_study_session(reason)
        if not success:
            self._show_warning("Không dừng được phiên học", message)

    def _refresh_log_view(self) -> None:
        if not hasattr(self, "log_output"):
            return
        selected = self.log_filter_combo.currentText() if hasattr(self, "log_filter_combo") else "Tất cả"
        lines: list[str] = []
        for record in self.controller.store.recent_events(limit=250):
            if not self._event_matches_filter(record, selected):
                continue
            stamp = str(record.get("at", "")).replace("T", " ")
            message = str(record.get("message", "")).strip()
            level = str(record.get("level", "info")).upper()
            lines.append(f"[{stamp}] [{level}] {message}")
        self.log_output.setPlainText("\n".join(lines) if lines else "Chưa có sự kiện phù hợp.")
        self.log_output.verticalScrollBar().setValue(self.log_output.verticalScrollBar().maximum())

    def _event_matches_filter(self, record: dict, selected: str) -> bool:
        if selected == "Tất cả":
            return True
        kind = str(record.get("kind", ""))
        if selected == "Học tập":
            return kind.startswith("study_")
        if selected == "Nghiêm khắc":
            return "strict" in kind or "lock" in kind or "unlock" in kind
        if selected == "Cảnh báo":
            return str(record.get("level", "")) == "warning" or "warning" in kind
        if selected == "Chống phá":
            return any(token in kind for token in ("tamper", "safe_mode", "integrity", "heartbeat"))
        return True

    def _format_distribution(self, distribution: dict[str, int]) -> str:
        if not distribution:
            return "Chưa có phân bổ theo profile."
        return " • ".join(f"{name}: {count}" for name, count in distribution.items())

    def _format_distractions(self, domains: list[str], apps: list[str]) -> str:
        parts: list[str] = []
        if domains:
            parts.append("Web: " + ", ".join(domains))
        if apps:
            parts.append("App: " + ", ".join(apps))
        return " | ".join(parts) if parts else "Chưa ghi nhận nguồn xao nhãng nào."

    def _latest_warning_text(self) -> str:
        for record in reversed(self.controller.store.recent_events(limit=80)):
            kind = str(record.get("kind", ""))
            level = str(record.get("level", ""))
            if level == "warning" or "warning" in kind or kind.startswith("study_conflict"):
                stamp = str(record.get("at", "")).replace("T", " ")
                message = str(record.get("message", "")).strip()
                return f"{stamp} - {message}" if stamp and message else message or "Có cảnh báo gần đây."
        return "Chưa có cảnh báo gần đây."

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
        config.study_profiles = self._build_study_profiles_from_ui()
        config.study_schedule = {}
        for key, (checkbox, start_edit, end_edit, profile_combo) in self._study_day_editors.items():
            profile_id = profile_combo.currentData()
            if not isinstance(profile_id, str) or not profile_id:
                profile_id = config.study_profiles[0].id
            config.study_schedule[key] = StudyDaySchedule(
                enabled=checkbox.isChecked(),
                start=start_edit.time().toString("HH:mm"),
                end=end_edit.time().toString("HH:mm"),
                profile_id=profile_id,
            )
        return config

    def _apply_password_inputs(
        self,
        candidate: AppConfig,
        current: AppConfig,
    ) -> tuple[AppConfig, str | None, str | None]:
        new_password = self.password_edit.text().strip()
        confirm_password = self.password_confirm_edit.text().strip()
        if new_password or confirm_password:
            if new_password != confirm_password:
                return candidate, None, "Hai trường mật khẩu không trùng nhau."
            validation_error = validate_password(new_password)
            if validation_error:
                return candidate, None, validation_error
            recovery_code = generate_recovery_code()
            candidate.strict_password = hash_password(new_password)
            candidate.recovery_key = hash_password(
                normalize_recovery_code(recovery_code)
            )
            candidate.recovery_key_created_at = datetime.now().isoformat(timespec="seconds")
            return candidate, recovery_code, None

        candidate.strict_password = current.strict_password
        candidate.recovery_key = current.recovery_key
        candidate.recovery_key_created_at = current.recovery_key_created_at
        return candidate, None, None

    def _show_recovery_code(self, code: str, *, reason: str) -> None:
        dialog = RecoveryCodeDialog(code, reason=reason, parent=self)
        dialog.exec()

    def _prompt_new_password_pair(self, title: str) -> tuple[str | None, str | None]:
        password, ok = QtWidgets.QInputDialog.getText(
            self,
            title,
            "Nhập mật khẩu mới:",
            QtWidgets.QLineEdit.EchoMode.Password,
        )
        if not ok:
            return None, None
        confirm, ok = QtWidgets.QInputDialog.getText(
            self,
            title,
            "Nhập lại mật khẩu mới:",
            QtWidgets.QLineEdit.EchoMode.Password,
        )
        if not ok:
            return None, None
        return password, confirm

    def save_config(self) -> None:
        current = self.controller.config
        candidate = self._collect_config_from_ui()
        maybe_error = self._validate_candidate(candidate)
        if maybe_error:
            self._show_warning("Chưa lưu được", maybe_error)
            return

        if self.controller.requires_strict_access_password():
            if not self._require_strict_password(
                "Nhập mật khẩu để cập nhật thiết lập khi chế độ nghiêm khắc đang hoạt động."
            ):
                return

        candidate, recovery_code, password_error = self._apply_password_inputs(candidate, current)
        if password_error:
            self._show_warning("Mật khẩu chưa hợp lệ", password_error)
            return

        if candidate.mode == "strict" and not candidate.has_password:
            self._show_warning("Cần mật khẩu", "Hãy đặt mật khẩu trước khi bật chế độ nghiêm khắc.")
            return

        try:
            self.startup_manager.set_enabled(candidate.start_with_windows)
        except OSError as exc:
            self._show_warning("Không cập nhật được khởi động cùng Windows", str(exc))
            return

        ok, message, queued = self.controller.update_config(candidate)
        if not ok:
            self._show_warning("Không lưu được", message)
            return
        self.password_edit.clear()
        self.password_confirm_edit.clear()
        self.save_button.setText("Đã trì hoãn" if queued else "Đã lưu thành công!")
        self.save_button.setStyleSheet(
            "background: rgba(129, 199, 132, 0.2); color: #81c784; border-color: #81c784;"
        )
        QtCore.QTimer.singleShot(2200, self._reset_save_button)
        if recovery_code:
            self._show_recovery_code(recovery_code, reason="Bạn vừa đổi mật khẩu nghiêm khắc.")

    def _reset_save_button(self) -> None:
        self.save_button.setText("Lưu thiết lập")
        self.save_button.setStyleSheet("")

    def toggle_protection(self) -> None:
        current = self.controller.config
        if current.protection_enabled or self.controller.state.manual_lock is not None:
            password = None
            if current.has_password and (
                current.mode == "strict" or self.controller.state.manual_lock is not None
            ):
                password = self._prompt_password("Nhập mật khẩu để tắt bảo vệ.")
                if password is None:
                    return
            success, message = self.controller.disable_protection(password)
            if not success:
                self._show_warning("Không tắt được bảo vệ", message)
            return

        candidate = self._collect_config_from_ui()
        maybe_error = self._validate_candidate(candidate)
        if maybe_error:
            self._show_warning("Chưa bật được bảo vệ", maybe_error)
            return

        candidate, recovery_code, password_error = self._apply_password_inputs(candidate, current)
        if password_error:
            self._show_warning("Mật khẩu chưa hợp lệ", password_error)
            return

        if candidate.mode == "strict" and not candidate.has_password:
            self._show_warning("Cần mật khẩu", "Hãy đặt mật khẩu trước khi bật chế độ nghiêm khắc.")
            return

        try:
            self.startup_manager.set_enabled(candidate.start_with_windows)
        except OSError as exc:
            self._show_warning("Không cập nhật được khởi động cùng Windows", str(exc))
            return

        candidate.protection_enabled = True
        ok, message, queued = self.controller.update_config(candidate)
        if not ok:
            self._show_warning("Không bật được bảo vệ", message)
            return
        if queued:
            self._show_warning("Đã trì hoãn", message)
        self.password_edit.clear()
        self.password_confirm_edit.clear()
        if recovery_code:
            self._show_recovery_code(recovery_code, reason="Bạn vừa đặt mật khẩu nghiêm khắc mới.")

    def start_manual_lock(self) -> None:
        success, message = self.controller.start_manual_lock(self.manual_countdown_spin.value())
        if not success:
            self._show_warning("Không bật được khóa thủ công", message)

    def cancel_manual_lock(self) -> None:
        password = self._prompt_password("Nhập mật khẩu để hủy khóa thủ công.")
        if password is None:
            return
        success, message = self.controller.cancel_manual_lock(password)
        if not success:
            self._show_warning("Không hủy được", message)

    def rotate_recovery_key(self) -> None:
        current = self.controller.config
        if not current.has_password:
            self._show_warning("Chưa có mật khẩu", "Hãy đặt mật khẩu nghiêm khắc trước khi tạo mã khôi phục.")
            return
        if not self._require_strict_password("Nhập mật khẩu hiện tại để tạo mã khôi phục mới."):
            return
        recovery_code = generate_recovery_code()
        ok, message = self.controller.save_secret_material(
            recovery_key=hash_password(normalize_recovery_code(recovery_code)),
            recovery_key_created_at=datetime.now().isoformat(timespec="seconds"),
            log_message="Đã tạo hoặc xoay mã khôi phục mới.",
        )
        if not ok:
            self._show_warning("Không tạo được", message)
            return
        self._show_recovery_code(recovery_code, reason="Bạn vừa tạo mã khôi phục mới.")

    def start_password_recovery(self) -> None:
        options = QtWidgets.QMessageBox(self)
        options.setWindowTitle("Quên mật khẩu nghiêm khắc")
        options.setText("Chọn cách khôi phục an toàn.")
        options.setInformativeText(self.controller.emergency_recovery_status_text())
        recovery_button = options.addButton("Dùng mã khôi phục", QtWidgets.QMessageBox.ButtonRole.AcceptRole)
        emergency_button = options.addButton(
            "Dùng khôi phục khẩn cấp" if self.controller.emergency_recovery_due() else "Bật khôi phục 7 ngày",
            QtWidgets.QMessageBox.ButtonRole.ActionRole,
        )
        cancel_button = options.addButton(QtWidgets.QMessageBox.StandardButton.Cancel)
        options.exec()

        clicked = options.clickedButton()
        if clicked == cancel_button:
            return

        if clicked == recovery_button:
            recovery_code, ok = QtWidgets.QInputDialog.getText(
                self,
                "Mã khôi phục",
                "Nhập mã khôi phục:",
            )
            if not ok or not recovery_code.strip():
                return
            new_password, confirm_password = self._prompt_new_password_pair("Đặt lại mật khẩu nghiêm khắc")
            if new_password is None or confirm_password is None:
                return
            if new_password != confirm_password:
                self._show_warning("Mật khẩu chưa khớp", "Hai trường mật khẩu không trùng nhau.")
                return
            success, message, new_recovery_code = self.controller.reset_password_with_recovery(
                new_password=new_password,
                recovery_code=recovery_code,
            )
            if not success:
                self._show_warning("Không đặt lại được", message)
                return
            if new_recovery_code:
                self._show_recovery_code(
                    new_recovery_code,
                    reason="Bạn vừa đặt lại mật khẩu nghiêm khắc bằng mã khôi phục.",
                )
            return

        if self.controller.emergency_recovery_due():
            new_password, confirm_password = self._prompt_new_password_pair("Khôi phục khẩn cấp")
            if new_password is None or confirm_password is None:
                return
            if new_password != confirm_password:
                self._show_warning("Mật khẩu chưa khớp", "Hai trường mật khẩu không trùng nhau.")
                return
            success, message, new_recovery_code = self.controller.reset_password_with_recovery(
                new_password=new_password,
                use_emergency_recovery=True,
            )
            if not success:
                self._show_warning("Không đặt lại được", message)
                return
            if new_recovery_code:
                self._show_recovery_code(
                    new_recovery_code,
                    reason="Bạn vừa đặt lại mật khẩu bằng khôi phục khẩn cấp.",
                )
            return

        _, message = self.controller.start_emergency_recovery()
        QtWidgets.QMessageBox.information(self, "Khôi phục khẩn cấp", message)

    def start_professional_uninstall(self) -> None:
        require_auth = self.controller.requires_uninstall_auth()
        dialog = UninstallApprovalDialog(
            require_auth=require_auth,
            emergency_status=self.controller.emergency_recovery_status_text(),
            emergency_due=self.controller.emergency_recovery_due(),
            parent=self,
        )
        if dialog.exec() != QtWidgets.QDialog.DialogCode.Accepted:
            return

        result = dialog.result_data
        if result.start_emergency_recovery:
            _, message = self.controller.start_emergency_recovery()
            QtWidgets.QMessageBox.information(self, "Khôi phục khẩn cấp", message)
            return

        if require_auth:
            if result.password:
                if not self.controller.verify_strict_password(result.password):
                    self._show_warning("Không thể gỡ cài đặt", "Mật khẩu nghiêm khắc không đúng.")
                    return
            elif result.recovery_code:
                if not self.controller.verify_recovery_code(result.recovery_code):
                    self._show_warning("Không thể gỡ cài đặt", "Mã khôi phục không đúng.")
                    return
            elif result.use_emergency_recovery:
                if not self.controller.emergency_recovery_due():
                    self._show_warning("Không thể gỡ cài đặt", self.controller.emergency_recovery_status_text())
                    return
            else:
                self._show_warning("Chưa xác thực", "Cần xác thực trước khi gỡ cài đặt.")
                return

        write_uninstall_approval(self.controller.store, purge_data=result.purge_data)
        uninstaller_path = find_uninstaller()
        if uninstaller_path is None:
            self._show_warning("Không tìm thấy uninstaller", "Không tìm thấy bộ gỡ cài đặt của Windows trong thư mục cài app.")
            return
        launched, message = launch_uninstaller(uninstaller_path)
        if not launched:
            self._show_warning("Không mở được uninstaller", message)
            return
        self.controller.shutdown()
        QtWidgets.QApplication.quit()

    def ensure_service_running(self) -> None:
        ok, message = self.service_manager.ensure_running()
        if not ok:
            self._show_warning("Không thể cài hoặc mở dịch vụ", message)
            return
        self._append_log("Dịch vụ đã được cài hoặc khởi động.")
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
            self.update_hint_label.setText(f"Cập nhật: lỗi kiểm tra ({error})")
            if not silent:
                self._show_warning("Không kiểm tra được cập nhật", error)
            return
        if update is None:
            self.update_hint_label.setText(f"Phiên bản hiện tại: {__version__} - đã mới nhất")
            if not silent:
                QtWidgets.QMessageBox.information(
                    self,
                    "Cập nhật",
                    "Bạn đang dùng phiên bản mới nhất.",
                )
            return

        update_info = update if isinstance(update, UpdateInfo) else None
        if update_info is None:
            return
        self.update_hint_label.setText(
            f"Có bản mới {update_info.version} ({update_info.published_at})"
        )
        notes = "\n".join(f"- {item}" for item in update_info.notes) or "- Bản cập nhật mới."
        answer = QtWidgets.QMessageBox.question(
            self,
            "Có bản cập nhật mới",
            (
                f"Phát hiện phiên bản {update_info.version}.\n\n"
                f"Thay đổi:\n{notes}\n\n"
                "Bạn có muốn tải installer và cập nhật không?"
            ),
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No,
            QtWidgets.QMessageBox.StandardButton.Yes,
        )
        if answer == QtWidgets.QMessageBox.StandardButton.Yes:
            self.update_hint_label.setText(f"Đang tải bản {update_info.version}...")
            self.update_manager.download_update(update_info)

    def _on_update_download_completed(self, installer_path: str, update: object, error: str) -> None:
        update_info = update if isinstance(update, UpdateInfo) else None
        if error:
            self.update_hint_label.setText(f"Cập nhật thất bại: {error}")
            self._show_warning("Tải cập nhật thất bại", error)
            return
        if not installer_path or update_info is None:
            return
        self.update_hint_label.setText(f"Đã tải xong bản {update_info.version}")
        launch = QtWidgets.QMessageBox.question(
            self,
            "Sẵn sàng cập nhật",
            (
                f"Đã tải xong installer {update_info.version}.\n"
                "Bạn có muốn mở installer ngay bây giờ không?"
            ),
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No,
            QtWidgets.QMessageBox.StandardButton.Yes,
        )
        if launch != QtWidgets.QMessageBox.StandardButton.Yes:
            return
        try:
            subprocess.Popen([installer_path])
        except OSError as exc:
            self._show_warning("Không mở được installer", str(exc))
            return
        self.controller.shutdown()
        QtWidgets.QApplication.quit()

    def _on_update_cleanup_completed(self, message: str) -> None:
        self.update_hint_label.setText(message)

    def relaunch_as_admin(self) -> None:
        if WindowsSessionController.relaunch_as_admin():
            QtWidgets.QApplication.quit()
            return
        self._show_warning("Không mở lại được", "Windows từ chối yêu cầu mở app với quyền Admin.")

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        if self._ignore_close_to_tray:
            super().closeEvent(event)
            return
        event.ignore()
        self.hide()
        if self.controller.requires_strict_access_password():
            self.controller.set_ui_access_override(False)
        self.tray_icon.showMessage(
            "CaiNghiện Focus Guard",
            "Ứng dụng vẫn đang chạy nền để tiếp tục enforcement.",
            self.windowIcon(),
            2500,
        )

    def showEvent(self, event: QtGui.QShowEvent) -> None:
        super().showEvent(event)
        self._sync_sidebar_layout()

    def eventFilter(self, watched: QtCore.QObject, event: QtCore.QEvent) -> bool:
        if watched is self._side_panel and event.type() == QtCore.QEvent.Type.Resize:
            self._sync_sidebar_layout()
        return super().eventFilter(watched, event)

    def _restore_from_tray(self) -> None:
        if not self.request_strict_access("Nhập mật khẩu để mở cửa sổ trong khung giờ nghiêm khắc."):
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
                "Nhập mật khẩu để thoát app khi chế độ nghiêm khắc hoặc khóa thủ công đang bật."
            )
            if password is None or not self.controller.verify_strict_password(password):
                self._show_warning("Không thể thoát", "Mật khẩu không đúng.")
                return
        self._ignore_close_to_tray = True
        self.controller.shutdown()
        QtWidgets.QApplication.quit()

    def _validate_candidate(self, candidate: AppConfig) -> str | None:
        if not candidate.blocked_domains:
            return "Danh sách web bị chặn đang rỗng."
        if all(not schedule.enabled for schedule in candidate.weekly_schedule.values()):
            return "Hãy bật ít nhất một ngày trong lịch tự động."
        if not candidate.study_profiles:
            return "Cần có ít nhất một profile học."
        profile_ids: set[str] = set()
        for profile in candidate.study_profiles:
            if not profile.id.strip():
                return "Mỗi profile học cần có mã nội bộ hợp lệ."
            if not profile.name.strip():
                return "Tên profile học không được để trống."
            if profile.id in profile_ids:
                return "Danh sách profile học đang bị trùng mã."
            profile_ids.add(profile.id)
        for key, schedule in candidate.study_schedule.items():
            if schedule.enabled and schedule.profile_id not in profile_ids:
                day_name = WEEKDAY_LABELS.get(key, key)
                return f"Lịch học của {day_name} đang trỏ tới một profile không còn tồn tại."
        return None

    def _prompt_password(self, message: str) -> str | None:
        text, ok = QtWidgets.QInputDialog.getText(
            self,
            "Xác nhận mật khẩu",
            message,
            QtWidgets.QLineEdit.EchoMode.Password,
        )
        return text if ok else None

    def _require_strict_password(self, message: str) -> bool:
        password = self._prompt_password(message)
        if password is None:
            return False
        if not self.controller.verify_strict_password(password):
            self._show_warning("Mật khẩu không đúng", "Vui lòng thử lại mật khẩu của chế độ nghiêm khắc.")
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
                "Mật khẩu không đúng",
                "Cần đúng mật khẩu nghiêm khắc mới mở được cửa sổ trong khung giờ này.",
            )

    def _extract_domains(self, edit: QtWidgets.QPlainTextEdit) -> list[str]:
        return dedupe_domains([line.strip() for line in edit.toPlainText().splitlines()])

    def _show_warning(self, title: str, message: str) -> None:
        QtWidgets.QMessageBox.warning(self, title, message)

    def _card(self, title: str, subtitle: str) -> tuple[QtWidgets.QFrame, QtWidgets.QVBoxLayout]:
        frame = QtWidgets.QFrame()
        frame.setObjectName("Card")
        frame.setMinimumWidth(340)
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(14)
        heading = QtWidgets.QLabel(title)
        heading.setObjectName("CardTitle")
        heading.setWordWrap(True)
        heading.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Minimum,
        )
        layout.addWidget(heading)
        caption = QtWidgets.QLabel(subtitle)
        caption.setWordWrap(True)
        caption.setObjectName("CardSubtitle")
        caption.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Minimum,
        )
        layout.addWidget(caption)
        return frame, layout

    def _mini_card(self, title: str) -> tuple[QtWidgets.QFrame, QtWidgets.QLabel]:
        frame = QtWidgets.QFrame()
        frame.setObjectName("MiniCard")
        frame.setMinimumHeight(96)
        frame.setMinimumWidth(0)
        frame.setSizePolicy(QtWidgets.QSizePolicy.Policy.Expanding, QtWidgets.QSizePolicy.Policy.Fixed)
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(4)
        caption = QtWidgets.QLabel(title)
        caption.setObjectName("MiniCaption")
        caption.setWordWrap(True)
        layout.addWidget(caption)
        value = QtWidgets.QLabel("--")
        value.setObjectName("MiniValue")
        value.setWordWrap(True)
        layout.addWidget(value)
        return frame, value

    def _arrange_sidebar_metrics(self, *, compact: bool) -> None:
        if self._metrics_grid is None or not self._metric_cards:
            return
        while self._metrics_grid.count():
            self._metrics_grid.takeAt(0)
        for index, card in enumerate(self._metric_cards):
            if compact:
                self._metrics_grid.addWidget(card, index, 0)
            else:
                self._metrics_grid.addWidget(card, index // 2, index % 2)
        self._metrics_grid.setColumnStretch(0, 1)
        self._metrics_grid.setColumnStretch(1, 1 if not compact else 0)

    def _sync_sidebar_layout(self) -> None:
        if self._side_panel is None:
            return
        compact = self._side_panel.width() < 336
        if compact == self._sidebar_compact:
            return
        self._sidebar_compact = compact
        self._arrange_sidebar_metrics(compact=compact)

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
