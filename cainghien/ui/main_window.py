from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

from PySide6 import QtCore, QtGui, QtWidgets

from .. import __version__
from ..models import (
    AppConfig,
    DaySchedule,
    WEEKDAY_KEYS,
    WEEKDAY_LABELS,
    dedupe_domains,
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
        self._ignore_close_to_tray = False
        self._last_status: EnforcementStatus | None = None
        self._day_editors: dict[str, tuple[QtWidgets.QCheckBox, QtWidgets.QTimeEdit, QtWidgets.QTimeEdit]] = {}
        self._stats_labels: dict[str, QtWidgets.QLabel] = {}
        self._side_panel: QtWidgets.QFrame | None = None
        self._side_panel_scroll: QtWidgets.QScrollArea | None = None
        self._workspace_scroll: QtWidgets.QWidget | None = None
        self._metrics_grid: QtWidgets.QGridLayout | None = None
        self._metric_cards: list[QtWidgets.QFrame] = []
        self._sidebar_compact = False
        self._build_ui()
        self._build_tray()
        self._connect_signals()
        self._load_config(controller.config)

    def _build_ui(self) -> None:
        self.setWindowTitle("CaiNghiện Focus Guard")
        self.resize(1100, 760)
        self.setMinimumSize(960, 680)
        central = QtWidgets.QWidget()
        central.setObjectName("AppShell")
        self.setCentralWidget(central)

        self.stacked_widget = QtWidgets.QStackedWidget(central)
        shell = QtWidgets.QHBoxLayout(central)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.addWidget(self.stacked_widget)

        self._build_focus_view()
        self._build_settings_view()
        
        self.stacked_widget.setCurrentIndex(0)

    def _build_focus_view(self) -> None:
        page = QtWidgets.QWidget()
        page.setObjectName("FocusPage")
        layout = QtWidgets.QVBoxLayout(page)
        layout.setContentsMargins(32, 32, 32, 32)
        
        top_bar = QtWidgets.QHBoxLayout()
        top_bar.addStretch()
        self.open_settings_button = QtWidgets.QToolButton()
        self.open_settings_button.setText("⚙️ Cài Đặt")
        self.open_settings_button.setObjectName("GhostButton")
        self.open_settings_button.setCursor(QtGui.QCursor(QtCore.Qt.CursorShape.PointingHandCursor))
        top_bar.addWidget(self.open_settings_button)
        layout.addLayout(top_bar)
        
        layout.addStretch()
        
        center_layout = QtWidgets.QVBoxLayout()
        center_layout.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        
        self.focus_status_label = QtWidgets.QLabel("ĐANG BẢO VỆ")
        self.focus_status_label.setObjectName("GiantStatus")
        self.focus_status_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        center_layout.addWidget(self.focus_status_label)
        
        self.focus_substatus_label = QtWidgets.QLabel("Bảo vệ toàn diện")
        self.focus_substatus_label.setObjectName("GiantSubstatus")
        self.focus_substatus_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        center_layout.addWidget(self.focus_substatus_label)
        
        layout.addLayout(center_layout)
        layout.addSpacing(60)
        
        self.main_focus_toggle_button = QtWidgets.QPushButton("Tắt bảo vệ")
        self.main_focus_toggle_button.setObjectName("GiantButton")
        self.main_focus_toggle_button.setCursor(QtGui.QCursor(QtCore.Qt.CursorShape.PointingHandCursor))
        
        btn_layout = QtWidgets.QHBoxLayout()
        btn_layout.addStretch()
        btn_layout.addWidget(self.main_focus_toggle_button)
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        layout.addStretch()
        self.stacked_widget.addWidget(page)

    def _build_settings_view(self) -> None:
        page = QtWidgets.QWidget()
        page.setObjectName("SettingsPage")
        
        layout = QtWidgets.QVBoxLayout(page)
        layout.setContentsMargins(22, 12, 22, 22)
        layout.setSpacing(12)
        
        back_row = QtWidgets.QHBoxLayout()
        self.close_settings_button = QtWidgets.QToolButton()
        self.close_settings_button.setText("← Quay lại")
        self.close_settings_button.setObjectName("GhostButton")
        self.close_settings_button.setCursor(QtGui.QCursor(QtCore.Qt.CursorShape.PointingHandCursor))
        back_row.addWidget(self.close_settings_button)
        back_row.addStretch()
        layout.addLayout(back_row)
        
        self._side_panel = self._create_side_panel()
        self._side_panel_scroll = self._wrap_side_panel(self._side_panel)
        self._workspace_scroll = self._create_workspace()
        
        splitter = QtWidgets.QSplitter(QtCore.Qt.Orientation.Horizontal)
        splitter.setChildrenCollapsible(False)
        splitter.setHandleWidth(10)
        splitter.addWidget(self._side_panel_scroll)
        splitter.addWidget(self._workspace_scroll)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setSizes([320, 780])
        
        layout.addWidget(splitter, 1)
        self.stacked_widget.addWidget(page)

    def _wrap_side_panel(self, panel: QtWidgets.QFrame) -> QtWidgets.QScrollArea:
        scroll = QtWidgets.QScrollArea()
        scroll.setObjectName("SidePanelScroll")
        scroll.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setVerticalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll.setMinimumWidth(320)
        scroll.setMaximumWidth(400)
        scroll.setWidget(panel)
        return scroll

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
        self.normal_mode_button.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Minimum,
        )
        layout.addWidget(self.normal_mode_button)

        self.strict_mode_button = QtWidgets.QToolButton()
        self.strict_mode_button.setText("Nghiêm khắc\nKhóa máy tính và chỉ mở bằng mật khẩu.")
        self.strict_mode_button.setCheckable(True)
        self.strict_mode_button.setObjectName("ModeButton")
        self.strict_mode_button.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Minimum,
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

        self.service_button = QtWidgets.QPushButton("Cài / Mở / Sửa dịch vụ")
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
        content.setMinimumWidth(600)
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
        tabs.setUsesScrollButtons(True)
        tabs.setElideMode(QtCore.Qt.TextElideMode.ElideRight)
        tabs.setTabPosition(QtWidgets.QTabWidget.TabPosition.North)
        tabs.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Expanding,
        )
        tabs.tabBar().setObjectName("WorkspaceTabBar")

        tabs.addTab(self._wrap_tab_page(self._create_overview_tab()), "Tổng quan")
        tabs.addTab(self._wrap_tab_page(self._create_schedule_tab()), "Lịch")
        tabs.addTab(self._wrap_tab_page(self._create_sites_tab()), "Trang web")
        tabs.addTab(self._wrap_tab_page(self._create_strict_tab()), "Nghiêm khắc")
        tabs.addTab(self._wrap_tab_page(self._create_settings_help_tab()), "Cài đặt & Trợ giúp")

        layout.addWidget(tabs, 1)
        return content

    def _create_tab_page(self) -> tuple[QtWidgets.QWidget, QtWidgets.QVBoxLayout]:
        page = QtWidgets.QWidget()
        page.setObjectName("WorkspaceTabPage")
        layout = QtWidgets.QVBoxLayout(page)
        layout.setContentsMargins(0, 4, 0, 0)
        layout.setSpacing(18)
        return page, layout

    def _wrap_tab_page(self, page: QtWidgets.QWidget) -> QtWidgets.QScrollArea:
        scroll = QtWidgets.QScrollArea()
        scroll.setObjectName("WorkspaceScroll")
        scroll.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll.setVerticalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll.setWidget(page)
        return scroll

    def _create_overview_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        row = QtWidgets.QGridLayout()
        row.setHorizontalSpacing(18)
        row.setVerticalSpacing(18)
        row.addWidget(self._create_guardrail_card(), 0, 0)
        row.addWidget(self._create_stats_card(), 0, 1)
        row.setColumnStretch(0, 1)
        row.setColumnStretch(1, 1)
        layout.addLayout(row)
        layout.addStretch()
        return page

    def _create_schedule_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        layout.addWidget(self._create_schedule_card())
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

    def _create_settings_help_tab(self) -> QtWidgets.QWidget:
        page, layout = self._create_tab_page()
        layout.addWidget(self._create_system_card())
        layout.addWidget(self._create_docs_card())
        layout.addStretch()
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

    def _create_docs_card(self) -> QtWidgets.QFrame:
        frame, layout = self._card(
            "Tài liệu ngay trong app",
            "Không cần mở trình duyệt để nhớ cách dùng. Phần này gom những thao tác cốt lõi và lưu ý an toàn quan trọng nhất.",
        )
        self.documentation_browser = QtWidgets.QTextBrowser()
        self.documentation_browser.setObjectName("HelpBrowser")
        self.documentation_browser.setOpenExternalLinks(True)
        self.documentation_browser.setMinimumHeight(420)
        self.documentation_browser.setHtml(self._documentation_html())
        layout.addWidget(self.documentation_browser)
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
        self.recovery_key_button.clicked.connect(self.rotate_recovery_key)
        self.forgot_password_button.clicked.connect(self.start_password_recovery)
        self.uninstall_button.clicked.connect(self.start_professional_uninstall)

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
        self._sync_service_store_if_possible()
        self.start_with_windows_checkbox.setChecked(
            config.start_with_windows or self.startup_manager.is_enabled()
        )
        self.service_enabled_checkbox.setChecked(config.service_enabled)
        self.warning_minutes_spin.setValue(config.warning_minutes)
        self.last_minute_guard_spin.setValue(config.last_minute_guard_minutes)
        self.change_delay_checkbox.setChecked(config.change_delay_enabled)
        self.strict_note_label.setText(
            "Mật khẩu đã được thiết lập."
            if config.has_password
            else "Cần đặt mật khẩu trước khi dùng chế độ nghiêm khắc."
        )
        recovery_state = "Đã tạo mã khôi phục." if config.has_recovery_key else "Chưa tạo mã khôi phục."
        if self.controller.state.recovery_request is not None:
            recovery_state += " " + self.controller.emergency_recovery_status_text()
        self.recovery_status_label.setText(recovery_state)
        self._refresh_schedule_preview()
        self._apply_strict_config_lock(self.controller.strict_configuration_locked())

    def _apply_status(self, status: EnforcementStatus) -> None:
        self._last_status = status
        self._apply_strict_config_lock(self.controller.strict_configuration_locked())
        self.toggle_button.setText("Tắt bảo vệ" if status.protection_enabled else "Bật bảo vệ")

        if status.protection_enabled:
            if status.schedule_active:
                self.focus_status_label.setText("ĐANG TRONG GIỜ CẤM")
                self.focus_status_label.setStyleSheet("color: #991B1B;")
                self.focus_substatus_label.setText(status.today_schedule_label)
                self.main_focus_toggle_button.setText("Đang bảo vệ (Không thể tắt)")
            else:
                self.focus_status_label.setText("ĐANG BẢO VỆ")
                self.focus_status_label.setStyleSheet("color: #111827;")
                self.focus_substatus_label.setText(f"Tiếp theo: {status.next_window_text}")
                self.main_focus_toggle_button.setText("Tắt bảo vệ")
        else:
            self.focus_status_label.setText("BẢO VỆ ĐANG TẮT")
            self.focus_status_label.setStyleSheet("color: #4B5563;")
            self.focus_substatus_label.setText("Tự do lướt web. Nhấn để bật bảo vệ.")
            self.main_focus_toggle_button.setText("Bật bảo vệ")

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
        self.pending_change_label.setText(status.pending_change_text)
        self.next_window_label.setText(status.next_window_text)
        self.safe_mode_label.setText(status.safe_mode_reason or "Không có cảnh báo an toàn.")
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
        }
        for key, value in mapping.items():
            label = self._stats_labels.get(key)
            if label is not None:
                label.setText(value)


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

    def _collect_text_lines(self, edit: QtWidgets.QPlainTextEdit) -> list[str]:
        return [line.strip() for line in edit.toPlainText().splitlines() if line.strip()]

    def _clear_layout(self, layout: QtWidgets.QLayout) -> None:
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            child_layout = item.layout()
            if widget is not None:
                widget.deleteLater()
            elif child_layout is not None:
                self._clear_layout(child_layout)

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
        self._sync_service_store_if_possible()
        if recovery_code:
            self._show_recovery_code(recovery_code, reason="Bạn vừa đổi mật khẩu nghiêm khắc.")

    def _reset_save_button(self) -> None:
        self.save_button.setText("Lưu thiết lập")
        self.save_button.setStyleSheet("")
        if self.controller.strict_configuration_locked():
            self.save_button.setEnabled(False)

    def _apply_strict_config_lock(self, locked: bool) -> None:
        widgets: list[QtWidgets.QWidget] = [
            self.normal_mode_button,
            self.strict_mode_button,
            self.save_button,
        ]
        for checkbox, start_edit, end_edit in self._day_editors.values():
            widgets.extend([checkbox, start_edit, end_edit])
        for widget in widgets:
            widget.setEnabled(not locked)
        self.save_button.setToolTip(
            "Đang trong khung giờ nghiêm khắc nên chưa thể sửa lịch hoặc lưu cấu hình."
            if locked
            else ""
        )

    def _sync_service_store_if_possible(self) -> None:
        service = self.service_manager.query_configuration()
        if service.get("installed") != "CÃ³":
            return
        if not WindowsSessionController.is_admin():
            self._append_log(
                "Dá»‹ch vá»¥ Ä‘ang dÃ¹ng service-data Ä‘Ã£ sync trÆ°á»›c Ä‘Ã³. "
                "Muá»‘n Ã¡p cáº¥u hÃ¬nh má»›i cho service, hÃ£y má»Ÿ láº¡i app báº±ng Admin."
            )
            return
        ok, message = self.service_manager.sync_service_store(self.controller.store)
        if ok:
            self._append_log(f"ÄÃ£ Ä‘á»“ng bá»™ service-data: {message}")
            self._show_warning("KhÃ´ng Ä‘á»“ng bá»™ Ä‘Æ°á»£c service-data", message)

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
        ok, message = self.service_manager.ensure_running(store=self.controller.store)
        if not ok:
            self.refresh_helper_panel()
            if "Admin" in message:
                answer = QtWidgets.QMessageBox.question(
                    self,
                    "Cần quyền Admin",
                    message + "\n\nBạn có muốn mở lại app với quyền Admin ngay bây giờ không?",
                    QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No,
                    QtWidgets.QMessageBox.StandardButton.Yes,
                )
                if answer == QtWidgets.QMessageBox.StandardButton.Yes:
                    self.relaunch_as_admin()
                    return
            self._show_warning("Không thể cài hoặc mở dịch vụ", message)
            return
        self._append_log("Dá»‹ch vá»¥ Ä‘Ã£ Ä‘Æ°á»£c cÃ i hoáº·c khá»Ÿi Ä‘á»™ng, vÃ  service-data Ä‘Ã£ Ä‘Æ°á»£c Ä‘á»“ng bá»™ an toÃ n.")
        self.controller.evaluate(force=True)
        self.refresh_helper_panel()
        return
        if not self.controller.store.shared_mode:
            try:
                shared_root = self.controller.store.activate_shared_root()
                self._append_log(f"Đã chuyển dữ liệu sang kho dùng chung cho service: {shared_root}")
            except OSError as exc:
                self._show_warning(
                    "Dịch vụ đã chạy nhưng chưa đồng bộ dữ liệu",
                    f"{message}\n\nKhông thể chuyển kho dữ liệu dùng chung: {exc}",
                )
                self.refresh_helper_panel()
                return
        self._append_log("Dịch vụ đã được cài hoặc khởi động.")
        self.controller.evaluate(force=True)
        self.refresh_helper_panel()

    def open_data_folder(self) -> None:
        target = self.controller.store.root_dir
        QtGui.QDesktopServices.openUrl(QtCore.QUrl.fromLocalFile(str(target)))

    def open_readme_file(self) -> None:
        readme_path = self._readme_path()
        if readme_path is None or not readme_path.exists():
            self._show_warning("Không tìm thấy README", "Không tìm thấy file hướng dẫn đi kèm app.")
            return
        QtGui.QDesktopServices.openUrl(QtCore.QUrl.fromLocalFile(str(readme_path)))

    def _readme_path(self) -> Path | None:
        if getattr(sys, "frozen", False):
            candidate = Path(sys.executable).resolve().parent / "README.txt"
            return candidate if candidate.exists() else None
        return Path(__file__).resolve().parents[2] / "README.md"

    def _documentation_html(self) -> str:
        return """
        <h2>CaiNghiện Focus Guard</h2>
        <p><b>Bình thường</b>: chặn website xao nhãng theo lịch và giữ lại các điểm vào học tập thật sự cần thiết.</p>
        <p><b>Nghiêm khắc</b>: có thể khóa máy và mọi thao tác tắt bảo vệ hoặc thoát app đều cần đúng mật khẩu.</p>
        <p><b>Học tập</b>: dùng profile học để siết web, chặn process xao nhãng, mở nhanh tài nguyên học và ghi streak 7 ngày.</p>
        <h3>Khi nào cần quyền Admin?</h3>
        <ul>
          <li>Cài hoặc sửa dịch vụ nền Windows.</li>
          <li>Ghi trực tiếp file hosts để chặn web chắc hơn.</li>
          <li>Dọn dẹp khẩn cấp ở mức sâu nếu hệ thống bị lỗi.</li>
        </ul>
        <h3>Khôi phục và dọn dẹp</h3>
        <ul>
          <li>Nếu quên mật khẩu, ưu tiên dùng recovery key hoặc chờ emergency recovery tới hạn.</li>
          <li>Dọn dẹp khẩn cấp chỉ dùng khi file mật khẩu, state hoặc service bị lỗi nghiêm trọng.</li>
          <li>App sẽ sao lưu mọi thứ trước khi reset để tránh mất dấu vết.</li>
        </ul>
        <h3>Mẹo vận hành an toàn</h3>
        <ul>
          <li>Bật startup cùng Windows để enforcement có mặt sớm.</li>
          <li>Dùng tab Trợ giúp khi service không chạy, app không mở lại bằng Admin, hoặc dữ liệu có dấu hiệu hỏng.</li>
          <li>Khi strict mode đang bật, thoát app sẽ yêu cầu mật khẩu.</li>
        </ul>
        """

    def _critical_integrity_issue(self, snapshot: dict[str, dict[str, str]]) -> str | None:
        for key in ("config", "state"):
            if snapshot[key]["status"] == "invalid":
                return f"Phát hiện {key}.json đang lỗi hoặc không đọc được. Có thể cần dọn dẹp khẩn cấp."
        if self.controller.config.mode == "strict" and self.controller.config.protection_enabled and not self.controller.config.has_password:
            return "Strict mode đang bật nhưng không còn dữ liệu mật khẩu hợp lệ."
        if self.controller.state.last_integrity_issue:
            return f"Hệ thống đang báo lỗi an toàn: {self.controller.state.last_integrity_issue}."
        return None

    def relaunch_as_admin(self) -> None:
        if WindowsSessionController.relaunch_as_admin():
            QtWidgets.QApplication.quit()
            return
        self._show_warning("Không mở lại được", "Windows từ chối yêu cầu mở app với quyền Admin.")

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        if self._ignore_close_to_tray:
            super().closeEvent(event)
            return
        if self.controller.requires_exit_password():
            dialog = QtWidgets.QMessageBox(self)
            dialog.setIcon(QtWidgets.QMessageBox.Icon.Question)
            dialog.setWindowTitle("Strict mode đang bật")
            dialog.setText("Chế độ nghiêm khắc hoặc khóa thủ công đang hoạt động.")
            dialog.setInformativeText(
                "Bạn có thể ẩn app xuống khay, hoặc nhập mật khẩu để thoát hẳn ứng dụng."
            )
            hide_button = dialog.addButton("Ẩn xuống khay", QtWidgets.QMessageBox.ButtonRole.AcceptRole)
            exit_button = dialog.addButton("Thoát có mật khẩu", QtWidgets.QMessageBox.ButtonRole.ActionRole)
            dialog.addButton(QtWidgets.QMessageBox.StandardButton.Cancel)
            dialog.exec()

            if dialog.clickedButton() is exit_button:
                password = self._prompt_password(
                    "Nhập mật khẩu để thoát app khi chế độ nghiêm khắc hoặc khóa thủ công đang bật."
                )
                if password is None or not self.controller.verify_strict_password(password):
                    self._show_warning("Không thể thoát", "Mật khẩu không đúng.")
                    event.ignore()
                    return
                self._ignore_close_to_tray = True
                self.controller.shutdown()
                QtWidgets.QApplication.quit()
                event.accept()
                return

            if dialog.clickedButton() is not hide_button:
                event.ignore()
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
        if self.controller.requires_exit_password():
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
        if (
            self.controller.strict_configuration_locked()
            and candidate.to_dict() != self.controller.config.to_dict()
        ):
            return (
                "Đang trong khung giờ nghiêm khắc nên không thể đổi lịch hoặc cấu hình. "
                "Hãy tắt bảo vệ bằng mật khẩu trước."
            )
        if not candidate.blocked_domains:
            return "Danh sách web bị chặn đang rỗng."
        if all(not schedule.enabled for schedule in candidate.weekly_schedule.values()):
            return "Hãy bật ít nhất một ngày trong lịch tự động."
        if candidate.creates_continuous_strict_lock():
            return (
                "Không cho phép lịch nghiêm khắc khóa 24/7. "
                "Hãy chừa ít nhất một khoảng hở, hoặc dùng khóa thủ công có thời hạn."
            )
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
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(12)
        heading = QtWidgets.QLabel(title)
        heading.setObjectName("CardTitle")
        heading.setWordWrap(True)
        heading.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.MinimumExpanding,
        )
        layout.addWidget(heading)
        caption = QtWidgets.QLabel(subtitle)
        caption.setWordWrap(True)
        caption.setObjectName("CardSubtitle")
        caption.setSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.MinimumExpanding,
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
