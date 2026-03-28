from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from PySide6 import QtCore

from ..config import ConfigStore
from ..models import (
    AppConfig,
    ManualLockState,
    PasswordRecord,
    RecoveryRequest,
    RuntimeState,
    StudyProfile,
    StudySessionState,
    WeeklyStats,
)
from ..ui.lock_overlay import StrictLockManager
from .hosts_blocker import HostsBlocker
from .process_guard import SystemGuard
from .runtime_rules import (
    ProtectionWindow,
    StudyWindow,
    blocked_domains_for_config,
    delay_target_for_change,
    is_service_stale,
    pending_change_due,
    resolve_active_study_occurrence,
    resolve_active_window,
    resolve_next_study_occurrence,
    resolve_next_window,
    resolve_pending_manual_countdown,
    sanitize_runtime_state,
    should_warn_before_lock,
    should_warn_before_study,
    study_window_from_session,
)
from .security import (
    generate_recovery_code,
    hash_password,
    normalize_recovery_code,
    validate_password,
    verify_password,
)
from .windows_guard import WindowsSessionController


@dataclass(slots=True)
class EnforcementStatus:
    now_text: str
    protection_enabled: bool
    schedule_active: bool
    hosts_active: bool
    lock_active: bool
    admin: bool
    mode: str
    summary: str
    current_window_label: str
    next_window_text: str
    pending_change_text: str
    manual_countdown_text: str
    safe_mode: bool
    safe_mode_reason: str
    service_alive: bool
    weekly_stats: WeeklyStats
    today_schedule_label: str
    study_active: bool
    study_profile_name: str
    study_label: str
    study_remaining_text: str
    next_study_text: str
    study_summary: str
    study_resources: list[str]
    study_allowed_apps: list[str]


class EnforcementController(QtCore.QObject):
    status_changed = QtCore.Signal(object)
    config_changed = QtCore.Signal(object)
    log_message = QtCore.Signal(str)
    attention_requested = QtCore.Signal(str, str)

    def __init__(self, store: ConfigStore) -> None:
        super().__init__()
        self._store = store
        self._config = store.load()
        self._state = store.load_state()
        self._hosts = HostsBlocker()
        self._lock_manager = StrictLockManager()
        self._lock_manager.unlock_attempted.connect(self._handle_unlock_attempt)

        self._timer = QtCore.QTimer(self)
        self._timer.setInterval(5_000)
        self._timer.timeout.connect(self.evaluate)

        self._hosts_applied = False
        self._last_block_signature = ""
        self._last_window_key: str | None = None
        self._last_lock_active = False
        self._last_lock_moment: datetime | None = None
        self._last_safe_mode_reason: str | None = None
        self._ui_access_override = False
        self._last_process_log_minute: str | None = None
        self._last_process_log_names: set[str] = set()

    @property
    def config(self) -> AppConfig:
        return self._config

    @property
    def store(self) -> ConfigStore:
        return self._store

    @property
    def state(self) -> RuntimeState:
        return self._state

    def verify_strict_password(self, password: str) -> bool:
        return verify_password(password, self._config.strict_password)

    def verify_recovery_code(self, recovery_code: str) -> bool:
        self._config = self._store.load()
        normalized = normalize_recovery_code(recovery_code)
        if not normalized:
            return False
        return verify_password(normalized, self._config.recovery_key)

    def requires_uninstall_auth(self) -> bool:
        self._config = self._store.load()
        self._state = self._store.load_state()
        return bool(
            self._config.has_password
            and (
                self._state.manual_lock is not None
                or (self._config.mode == "strict" and self._config.protection_enabled)
            )
        )

    def emergency_recovery_due(self, when: datetime | None = None) -> bool:
        now = when or datetime.now()
        self._state = self._store.load_state()
        request = self._state.recovery_request
        if request is None or request.purpose != "account_recovery":
            return False
        available_at = request.available_dt
        return bool(available_at and now >= available_at)

    def emergency_recovery_status_text(self, when: datetime | None = None) -> str:
        now = when or datetime.now()
        self._state = self._store.load_state()
        request = self._state.recovery_request
        if request is None or request.purpose != "account_recovery":
            return "Chưa có khôi phục khẩn cấp nào."
        available_at = request.available_dt
        if available_at is None:
            return "Khôi phục khẩn cấp đang lỗi và cần tạo lại."
        if now >= available_at:
            return (
                "Khôi phục khẩn cấp đã tới hạn. Bạn có thể dùng nó để đặt lại mật khẩu "
                "hoặc gỡ cài đặt."
            )
        return f"Khôi phục khẩn cấp sẽ sẵn sàng lúc {available_at.strftime('%d/%m/%Y %H:%M')}."

    def start_emergency_recovery(self, *, days: int = 7) -> tuple[bool, str]:
        now = datetime.now()
        self._state = self._store.load_state()
        request = self._state.recovery_request
        if request and request.purpose == "account_recovery":
            available_at = request.available_dt
            if available_at is not None and now < available_at:
                return True, f"Khôi phục khẩn cấp đã được bật và sẽ sẵn sàng lúc {available_at.strftime('%d/%m/%Y %H:%M')}."
            if available_at is not None and now >= available_at:
                return True, "Khôi phục khẩn cấp đã tới hạn và sẵn sàng để sử dụng."

        available_at = now + timedelta(days=max(1, days))
        self._state.recovery_request = RecoveryRequest(
            purpose="account_recovery",
            requested_at=now.isoformat(timespec="seconds"),
            available_at=available_at.isoformat(timespec="seconds"),
        )
        self._save_state()
        self._log_event(
            self._state,
            "emergency_recovery_started",
            f"Đã bật thời gian chờ khôi phục khẩn cấp. Có thể dùng sau {available_at.strftime('%d/%m/%Y %H:%M')}.",
            level="warning",
            counter_field="tamper_events",
            now=now,
        )
        return True, f"Khôi phục khẩn cấp sẽ sẵn sàng lúc {available_at.strftime('%d/%m/%Y %H:%M')}."

    def reset_password_with_recovery(
        self,
        *,
        new_password: str,
        recovery_code: str | None = None,
        use_emergency_recovery: bool = False,
    ) -> tuple[bool, str, str | None]:
        self._config = self._store.load()
        self._state = self._store.load_state()
        validation_error = validate_password(new_password)
        if validation_error:
            return False, validation_error, None

        if recovery_code:
            if not self.verify_recovery_code(recovery_code):
                self._log_event(
                    self._state,
                    "recovery_code_failed",
                    "Nhập sai mã khôi phục khi cố gắng đặt lại mật khẩu.",
                    level="warning",
                    counter_field="failed_unlocks",
                )
                return False, "Mã khôi phục không đúng.", None
        elif use_emergency_recovery:
            if not self.emergency_recovery_due():
                return False, self.emergency_recovery_status_text(), None
        else:
            return False, "Cần mã khôi phục hoặc khôi phục khẩn cấp để đặt lại mật khẩu.", None

        recovery_code_display = generate_recovery_code()
        updated = AppConfig.from_dict(self._config.to_dict())
        updated.strict_password = hash_password(new_password)
        updated.recovery_key = hash_password(normalize_recovery_code(recovery_code_display))
        updated.recovery_key_created_at = datetime.now().isoformat(timespec="seconds")
        self._config = updated
        self._store.save(updated)
        self._state = self._store.load_state()
        self._state.recovery_request = None
        self._save_state()
        self.config_changed.emit(updated)
        self._log_event(
            self._state,
            "password_reset_recovered",
            "Đã đặt lại mật khẩu nghiêm khắc bằng cơ chế khôi phục.",
        )
        self.evaluate(force=True)
        return True, "Đã đặt lại mật khẩu nghiêm khắc thành công.", recovery_code_display

    def save_secret_material(
        self,
        *,
        strict_password: PasswordRecord | None | object = None,
        recovery_key: PasswordRecord | None | object = None,
        recovery_key_created_at: str | None | object = None,
        clear_recovery_request: bool = False,
        log_message: str = "Đã cập nhật dữ liệu bí mật.",
    ) -> tuple[bool, str]:
        now = datetime.now()
        marker = object()
        strict_value = strict_password if strict_password is not None else marker
        recovery_value = recovery_key if recovery_key is not None else marker
        recovery_created_value = recovery_key_created_at if recovery_key_created_at is not None else marker

        updated = AppConfig.from_dict(self._store.load().to_dict())
        if strict_value is not marker:
            updated.strict_password = strict_value  # type: ignore[assignment]
        if recovery_value is not marker:
            updated.recovery_key = recovery_value  # type: ignore[assignment]
        if recovery_created_value is not marker:
            updated.recovery_key_created_at = recovery_created_value  # type: ignore[assignment]

        self._config = updated
        self._store.save(updated)
        self._state = self._store.load_state()
        if clear_recovery_request:
            self._state.recovery_request = None
            self._save_state()
        self.config_changed.emit(updated)
        self._log_event(self._state, "secret_material_saved", log_message, now=now)
        self.evaluate(force=True)
        return True, log_message

    def requires_strict_access_password(self, when: datetime | None = None) -> bool:
        now = when or datetime.now()
        active_window = resolve_active_window(self._config, self._state, now)
        return bool(active_window and active_window.strict and self._config.has_password)

    def set_ui_access_override(self, enabled: bool, *, reevaluate: bool = True) -> None:
        self._ui_access_override = enabled
        if reevaluate:
            self.evaluate(force=True)

    def start(self) -> None:
        self._timer.start()
        self.evaluate(force=True)

    def shutdown(self) -> None:
        self._timer.stop()
        self._ui_access_override = False
        self._lock_manager.hide()
        if self._hosts_applied and self._hosts.is_elevated():
            self._hosts.remove_block()
            self._hosts_applied = False

    def update_config(self, config: AppConfig) -> tuple[bool, str, bool]:
        now = datetime.now()
        self._config = self._store.load()
        self._state = self._store.load_state()
        self._state, cleanup_messages = sanitize_runtime_state(self._state, now)
        for message in cleanup_messages:
            self._log_event(
                self._state,
                "integrity_cleanup",
                message,
                level="warning",
                counter_field="tamper_events",
                now=now,
            )

        if config.to_dict() == self._config.to_dict():
            return True, "Không có thay đổi nào để lưu.", False

        delay_target = delay_target_for_change(self._config, self._state, now)
        if (
            self._config.protection_enabled
            and self._config.change_delay_enabled
            and delay_target is not None
        ):
            self._state.pending_config = self._build_pending_change(config, delay_target, now)
            self._state.bump_counter(now.date(), "pending_changes", 1)
            self._save_state()
            message = f"Thay đổi đã được trì hoãn đến sau {delay_target.label} ({delay_target.end.strftime('%d/%m %H:%M')})."
            self._log_event(
                self._state,
                "pending_config_created",
                message,
                now=now,
                meta={"apply_at": self._state.pending_config.apply_at},
            )
            self.evaluate(force=True)
            return True, message, True

        self._apply_config(config, now=now, log_message="Đã lưu thiết lập mới.")
        return True, "Đã lưu thiết lập.", False

    def disable_protection(self, password: str | None = None) -> tuple[bool, str]:
        if self._config.mode == "strict" and (
            self._config.protection_enabled or self._state.manual_lock is not None
        ):
            if not self.verify_strict_password(password or ""):
                self._log_event(
                    self._state,
                    "unlock_failed",
                    "Nhập sai mật khẩu khi cố gắng tắt bảo vệ.",
                    level="warning",
                    counter_field="failed_unlocks",
                )
                return False, "Mật khẩu không đúng."

        if (
            not self._config.protection_enabled
            and self._state.manual_lock is None
            and self._state.study_session is None
        ):
            return True, "Bảo vệ đã tắt sẵn."

        updated = AppConfig.from_dict(self._config.to_dict())
        updated.protection_enabled = False
        self._ui_access_override = False
        self._state.pending_config = None
        self._state.manual_lock = None
        self._state.study_session = None
        self._save_state()
        self._apply_config(updated, now=datetime.now(), log_message="Đã tắt bảo vệ.")
        return True, "Đã tắt bảo vệ."

    def start_manual_lock(self, countdown_minutes: int) -> tuple[bool, str]:
        if not self._config.has_password:
            return False, "Cần đặt mật khẩu trước khi bật đếm ngược khóa thủ công."
        if countdown_minutes < 1:
            return False, "Đếm ngược phải từ 1 phút trở lên."

        now = datetime.now()
        activate_at = now + timedelta(minutes=countdown_minutes)
        end_at = activate_at + timedelta(minutes=self._config.manual_lock_duration_minutes)
        self._state = self._store.load_state()
        self._state.manual_lock = ManualLockState(
            activate_at=activate_at.isoformat(timespec="seconds"),
            end_at=end_at.isoformat(timespec="seconds"),
            created_at=now.isoformat(timespec="seconds"),
        )
        self._save_state()
        message = f"Khóa thủ công sẽ bật lúc {activate_at.strftime('%H:%M')} và tự hết lúc {end_at.strftime('%H:%M')}."
        self._log_event(self._state, "manual_lock_scheduled", message, now=now)
        self.evaluate(force=True)
        return True, message

    def cancel_manual_lock(self, password: str | None = None) -> tuple[bool, str]:
        self._state = self._store.load_state()
        if self._state.manual_lock is None:
            return True, "Không có khóa thủ công nào đang chờ."
        if not self.verify_strict_password(password or ""):
            self._log_event(
                self._state,
                "manual_lock_cancel_failed",
                "Nhập sai mật khẩu khi cố gắng hủy khóa thủ công.",
                level="warning",
                counter_field="failed_unlocks",
            )
            return False, "Mật khẩu không đúng."
        self._state.manual_lock = None
        self._save_state()
        self._log_event(self._state, "manual_lock_cancelled", "Đã hủy đếm ngược khóa thủ công.")
        self.evaluate(force=True)
        return True, "Đã hủy khóa thủ công."

    def start_study_session(
        self,
        profile_id: str,
        *,
        duration_minutes: int | None = None,
    ) -> tuple[bool, str]:
        now = datetime.now()
        self._config = self._store.load()
        self._state = self._store.load_state()
        active_window = resolve_active_window(self._config, self._state, now)
        if active_window is not None and active_window.strict:
            return False, "Không thể bắt đầu phiên học khi strict mode đang hoạt động."
        if self._state.study_session is not None:
            return False, "Đang có một phiên học khác hoạt động."

        profile = self._config.study_profile(profile_id)
        minutes = max(15, int(duration_minutes or profile.default_duration_minutes or 50))
        session = self._build_study_session(
            profile=profile,
            now=now,
            source="manual",
            end_at=now + timedelta(minutes=minutes),
            duration_minutes=minutes,
        )
        self._activate_study_session(session, now=now)
        self.evaluate(force=True)
        return True, f"Đã bắt đầu phiên học “{profile.name}” trong {minutes} phút."

    def abort_study_session(self, reason: str) -> tuple[bool, str]:
        now = datetime.now()
        self._state = self._store.load_state()
        session = self._state.study_session
        if session is None:
            return False, "Không có phiên học nào đang chạy."
        self._finish_study_session(session, completed=False, now=now, reason=reason.strip() or "Dừng sớm")
        self.evaluate(force=True)
        return True, "Đã dừng sớm phiên học và ghi nhận thất bại."

    def evaluate(self, *, force: bool = False) -> None:
        now = datetime.now()
        self._config = self._store.load()
        self._state = self._store.load_state()
        self._state, cleanup_messages = sanitize_runtime_state(self._state, now)

        state_changed = bool(cleanup_messages)
        for message in cleanup_messages:
            self._log_event(
                self._state,
                "integrity_cleanup",
                message,
                level="warning",
                counter_field="tamper_events",
                now=now,
            )

        if self._apply_pending_config_if_due(now):
            self._config = self._store.load()
            self._state = self._store.load_state()
            state_changed = True

        new_ui_last_seen = now.isoformat(timespec="seconds")
        if self._state.ui_last_seen != new_ui_last_seen:
            self._state.ui_last_seen = new_ui_last_seen
            state_changed = True
        if self._state.service_enabled != self._config.service_enabled:
            self._state.service_enabled = self._config.service_enabled
            state_changed = True

        warning_window = should_warn_before_lock(self._config, self._state, now)
        if warning_window and self._state.last_warning_key != warning_window.warning_key:
            self._state.last_warning_key = warning_window.warning_key
            message = (
                f"Cảnh báo: khóa sẽ bật lúc {warning_window.start.strftime('%H:%M')} "
                f"trong {int((warning_window.start - now).total_seconds() // 60)} phút."
            )
            self._log_event(
                self._state,
                "warning_before_lock",
                message,
                counter_field="warnings_sent",
                now=now,
            )
            self.attention_requested.emit("Cảnh báo trước giờ khóa", message)
            state_changed = True

        study_warning = should_warn_before_study(self._config, self._state, now)
        if study_warning:
            occurrence, offset = study_warning
            warning_key = occurrence.warning_key(offset)
            if self._state.last_study_warning_key != warning_key:
                self._state.last_study_warning_key = warning_key
                message = (
                    f"Cảnh báo học tập: phiên “{occurrence.title}” sẽ bắt đầu lúc "
                    f"{occurrence.start.strftime('%H:%M')} sau khoảng {offset} phút."
                )
                self._log_event(
                    self._state,
                    "study_warning",
                    message,
                    now=now,
                    meta={"profile_name": occurrence.title, "offset_minutes": offset},
                )
                self.attention_requested.emit("Chuẩn bị vào phiên học", message)
                state_changed = True

        active_window = resolve_active_window(self._config, self._state, now)
        pending_countdown = resolve_pending_manual_countdown(self._state, now)
        service_alive = self._config.service_enabled and not is_service_stale(self._state, now)
        strict_access_required = bool(
            active_window and active_window.strict and self._config.has_password
        )
        if not strict_access_required:
            self._ui_access_override = False

        if active_window is not None:
            minute_key = now.strftime("%Y-%m-%dT%H:%M")
            if self._state.last_counted_minute != minute_key:
                self._state.last_counted_minute = minute_key
                self._state.bump_counter(now.date(), "blocked_minutes", 1)
                state_changed = True
        elif self._state.last_counted_minute is not None:
            self._state.last_counted_minute = None
            state_changed = True

        current_window_key = active_window.warning_key if active_window else None
        if current_window_key != self._last_window_key:
            if active_window is not None:
                if active_window.source == "weekly_schedule":
                    self._state.bump_counter(now.date(), "schedule_sessions", 1)
                if active_window.strict:
                    self._state.bump_counter(now.date(), "strict_sessions", 1)
                self._log_event(
                    self._state,
                    "session_started",
                    f"Đã bắt đầu khung bảo vệ {active_window.label}.",
                    now=now,
                )
                state_changed = True
            elif self._last_window_key is not None:
                self._log_event(
                    self._state,
                    "session_finished",
                    "Đã ra khỏi khung bảo vệ.",
                    now=now,
                )
            self._last_window_key = current_window_key

        study_window, study_profile = self._sync_study_session(now=now, active_window=active_window)
        if study_window is not None:
            minute_key = now.strftime("%Y-%m-%dT%H:%M")
            if self._state.last_study_counted_minute != minute_key:
                self._state.last_study_counted_minute = minute_key
                self._state.bump_counter(now.date(), "study_minutes", 1)
                state_changed = True
            if study_profile is not None:
                self._enforce_study_processes(study_profile, now)
        elif self._state.last_study_counted_minute is not None:
            self._state.last_study_counted_minute = None
            self._last_process_log_minute = None
            self._last_process_log_names.clear()
            state_changed = True

        hosts_active, admin, safe_mode_reason = self._evaluate_hosts(
            active_window=active_window,
            study_profile=study_profile,
            study_active=study_window is not None,
            service_alive=service_alive,
            force=force,
            now=now,
        )
        if (
            safe_mode_reason is None
            and active_window is not None
            and active_window.strict
            and not self._config.has_password
        ):
            safe_mode_reason = (
                "Chế độ nghiêm khắc đang bật nhưng chưa có mật khẩu hợp lệ. "
                "App hạ về chặn web để tránh tự khóa vĩnh viễn."
            )
        lock_active = self._evaluate_lock(
            active_window,
            now=now,
            strict_access_required=strict_access_required,
        )

        if safe_mode_reason != self._last_safe_mode_reason:
            if safe_mode_reason:
                self._state.safe_mode_reason = safe_mode_reason
                self._log_event(
                    self._state,
                    "safe_mode",
                    safe_mode_reason,
                    level="warning",
                    counter_field="tamper_events",
                    now=now,
                )
                self.attention_requested.emit("Chế độ an toàn chống lách", safe_mode_reason)
            else:
                self._state.safe_mode_reason = None
            self._last_safe_mode_reason = safe_mode_reason
            state_changed = True

        if state_changed:
            self._save_state()

        status = self._build_status(
            now=now,
            active_window=active_window,
            pending_countdown=pending_countdown,
            hosts_active=hosts_active,
            admin=admin,
            lock_active=lock_active,
            safe_mode_reason=safe_mode_reason or "",
            service_alive=service_alive,
            study_window=study_window,
            study_profile=study_profile,
        )
        self.status_changed.emit(status)

    def _build_pending_change(
        self,
        config: AppConfig,
        target: ProtectionWindow,
        now: datetime,
    ):
        from ..models import PendingConfigChange

        return PendingConfigChange(
            payload=config.to_dict(),
            apply_at=target.end.isoformat(timespec="seconds"),
            created_at=now.isoformat(timespec="seconds"),
            reason=f"delayed_until_{target.source}",
        )

    def _apply_config(
        self,
        config: AppConfig,
        *,
        now: datetime,
        log_message: str | None = None,
    ) -> None:
        self._config = config
        self._store.save(config)
        self.config_changed.emit(config)
        if log_message:
            self._log_event(self._state, "config_saved", log_message, now=now)
        self.evaluate(force=True)

    def _apply_pending_config_if_due(self, now: datetime) -> bool:
        pending = pending_change_due(self._state, now)
        if pending is None:
            return False

        self._config = AppConfig.from_dict(pending.payload)
        self._store.save(self._config)
        self._state.pending_config = None
        self._save_state()
        self._log_event(
            self._state,
            "pending_config_applied",
            "Thay đổi trì hoãn đã được áp dụng.",
            now=now,
        )
        self.config_changed.emit(self._config)
        return True

    def _build_study_session(
        self,
        *,
        profile: StudyProfile,
        now: datetime,
        source: str,
        end_at: datetime,
        duration_minutes: int,
        schedule_occurrence=None,
    ) -> StudySessionState:
        return StudySessionState(
            session_id=f"{source}:{profile.id}:{now.isoformat(timespec='seconds')}",
            profile_id=profile.id,
            profile_name=profile.name,
            source=source,
            started_at=now.isoformat(timespec="seconds"),
            target_end_at=end_at.isoformat(timespec="seconds"),
            duration_minutes=max(1, duration_minutes),
            resource_urls=list(profile.resource_urls),
            allowed_apps=list(profile.allowed_apps),
            blocked_processes=list(profile.blocked_processes),
            blocked_domains=blocked_domains_for_config(self._config, profile),
            schedule_day_key=schedule_occurrence.day_key if schedule_occurrence else None,
            schedule_start_at=schedule_occurrence.start.isoformat(timespec="seconds") if schedule_occurrence else None,
            schedule_end_at=schedule_occurrence.end.isoformat(timespec="seconds") if schedule_occurrence else None,
        )

    def _activate_study_session(self, session: StudySessionState, *, now: datetime) -> None:
        self._state.study_session = session
        self._save_state()
        self._log_event(
            self._state,
            "study_session_started",
            f"Đã bắt đầu phiên học “{session.profile_name}”.",
            now=now,
            meta={
                "profile_id": session.profile_id,
                "profile_name": session.profile_name,
                "source": session.source,
                "duration_minutes": session.duration_minutes,
            },
        )
        for domain in session.blocked_domains:
            self._log_event(
                self._state,
                "study_site_blocked",
                f"Đang siết web xao nhãng {domain} trong phiên “{session.profile_name}”.",
                counter_field="study_site_blocks",
                now=now,
                meta={"source": domain, "profile_name": session.profile_name},
            )

    def _finish_study_session(
        self,
        session: StudySessionState,
        *,
        completed: bool,
        now: datetime,
        reason: str | None = None,
    ) -> None:
        started_at = session.started_dt or now
        elapsed_minutes = max(1, int((now - started_at).total_seconds() // 60))
        if completed:
            self._state.bump_counter(now.date(), "study_sessions_completed", 1)
            message = f"Đã hoàn thành phiên học “{session.profile_name}”."
            kind = "study_session_completed"
        else:
            self._state.bump_counter(now.date(), "study_sessions_aborted", 1)
            message = f"Đã dừng sớm phiên học “{session.profile_name}”."
            kind = "study_session_aborted"
        self._state.study_session = None
        self._save_state()
        self._log_event(
            self._state,
            kind,
            message,
            level="warning" if not completed else "info",
            now=now,
            meta={
                "profile_id": session.profile_id,
                "profile_name": session.profile_name,
                "source": session.source,
                "elapsed_minutes": elapsed_minutes,
                "reason": reason or "",
            },
        )
        self._last_process_log_minute = None
        self._last_process_log_names.clear()

    def _sync_study_session(
        self,
        *,
        now: datetime,
        active_window: ProtectionWindow | None,
    ) -> tuple[StudyWindow | None, StudyProfile | None]:
        session = self._state.study_session
        if session is not None:
            end_at = session.target_end_dt
            if end_at is None or now >= end_at:
                self._finish_study_session(session, completed=True, now=now)
                session = None
            elif active_window is not None and active_window.strict:
                self._finish_study_session(
                    session,
                    completed=False,
                    now=now,
                    reason="Bị ngắt bởi strict mode",
                )
                session = None

        scheduled_occurrence = None
        if self._config.protection_enabled:
            scheduled_occurrence = resolve_active_study_occurrence(self._config, now)

        if (
            scheduled_occurrence is not None
            and active_window is not None
            and active_window.strict
        ):
            conflict_key = f"{scheduled_occurrence.profile_id}:{scheduled_occurrence.start.isoformat()}"
            if self._state.last_study_conflict_key != conflict_key:
                self._state.last_study_conflict_key = conflict_key
                self._log_event(
                    self._state,
                    "study_conflict_strict",
                    f"Phiên học “{scheduled_occurrence.title}” không thể bắt đầu vì strict mode đang hoạt động.",
                    level="warning",
                    now=now,
                    meta={"profile_name": scheduled_occurrence.title},
                )
        elif self._state.last_study_conflict_key:
            self._state.last_study_conflict_key = None

        if self._state.study_session is None and scheduled_occurrence is not None and (
            active_window is None or not active_window.strict
        ):
            profile = self._config.study_profile(scheduled_occurrence.profile_id)
            session = self._build_study_session(
                profile=profile,
                now=now,
                source="scheduled",
                end_at=scheduled_occurrence.end,
                duration_minutes=max(
                    1,
                    int((scheduled_occurrence.end - now).total_seconds() // 60),
                ),
                schedule_occurrence=scheduled_occurrence,
            )
            self._activate_study_session(session, now=now)

        study_window = study_window_from_session(self._state, now)
        if study_window is None:
            return None, None
        return study_window, self._config.study_profile(self._state.study_session.profile_id) if self._state.study_session else None

    def _enforce_study_processes(self, profile: StudyProfile, now: datetime) -> None:
        minute_key = now.strftime("%Y-%m-%dT%H:%M")
        if minute_key != self._last_process_log_minute:
            self._last_process_log_minute = minute_key
            self._last_process_log_names.clear()

        for process_name in SystemGuard.enforce_process_block(profile.blocked_processes):
            if process_name in self._last_process_log_names:
                continue
            self._last_process_log_names.add(process_name)
            self._log_event(
                self._state,
                "study_app_blocked",
                f"Đã chặn ứng dụng xao nhãng {process_name} trong phiên “{profile.name}”.",
                counter_field="study_app_blocks",
                now=now,
                meta={"source": process_name, "profile_name": profile.name},
            )

    def _evaluate_hosts(
        self,
        *,
        active_window: ProtectionWindow | None,
        study_profile: StudyProfile | None,
        study_active: bool,
        service_alive: bool,
        force: bool,
        now: datetime,
    ) -> tuple[bool, bool, str | None]:
        admin = self._hosts.is_elevated()
        safe_mode_reason: str | None = None
        if active_window is None and not study_active:
            if self._hosts_applied and admin:
                ok, message = self._hosts.remove_block()
                self._hosts_applied = False
                self._last_block_signature = ""
                if ok:
                    self._log_event(self._state, "hosts_removed", "Đã gỡ chặn hosts sau khi enforcement kết thúc.", now=now)
                else:
                    self._log_event(
                        self._state,
                        "hosts_remove_failed",
                        message,
                        level="warning",
                        counter_field="tamper_events",
                        now=now,
                    )
            return False, admin, None

        blocked_domains = blocked_domains_for_config(self._config, study_profile if study_active else None)
        if not blocked_domains:
            return False, admin, "Danh sách chặn rỗng, enforcement hosts không còn tác dụng."

        signature = "|".join(blocked_domains)
        if admin:
            needs_update = force or signature != self._last_block_signature or not self._hosts_applied
            if needs_update:
                ok, message = self._hosts.apply_block(blocked_domains)
                self._hosts_applied = ok
                self._last_block_signature = signature
                if ok:
                    self._log_event(
                        self._state,
                        "hosts_applied",
                        "Đã áp dụng chặn hosts cho khung giờ hiện tại.",
                        now=now,
                    )
                    return True, admin, None
                self._log_event(
                    self._state,
                    "hosts_apply_failed",
                    message,
                    level="warning",
                    counter_field="tamper_events",
                    now=now,
                )
                safe_mode_reason = message
                return False, admin, safe_mode_reason
            return self._hosts_applied, admin, None

        self._last_block_signature = signature
        if service_alive:
            return True, admin, None

        safe_mode_reason = (
            "Không có quyền Admin và dịch vụ nền chưa sẵn sàng. "
            "Chặn hosts không được đảm bảo."
        )
        return False, admin, safe_mode_reason

    def _evaluate_lock(
        self,
        active_window: ProtectionWindow | None,
        *,
        now: datetime,
        strict_access_required: bool,
    ) -> bool:
        if active_window is None or not active_window.strict:
            self._lock_manager.hide()
            SystemGuard.set_task_manager_enabled(True)
            self._last_lock_active = False
            return False

        if not self._config.has_password:
            self._lock_manager.hide()
            SystemGuard.set_task_manager_enabled(True)
            return False

        SystemGuard.set_task_manager_enabled(False)
        if self._ui_access_override and strict_access_required:
            self._lock_manager.hide()
            self._last_lock_active = False
            return False

        schedule_text = active_window.label
        if active_window.source == "manual_lock":
            schedule_text = f"Khóa tay đến {active_window.end.strftime('%H:%M')}"
        message_text = (
            "Đang trong khung giờ nghiêm khắc. Đường vòng vào web và máy tính đã bị khóa."
            if active_window.source != "manual_lock"
            else "Khóa thủ công đang hoạt động. Máy tính sẽ tự mở lại khi hết thời gian hoặc khi nhập đúng mật khẩu."
        )
        hint_text = "Nhập đúng mật khẩu để tắt chế độ nghiêm khắc. Sai mật khẩu sẽ bị khóa thử lại 60 giây."
        self._lock_manager.show(
            schedule_text=schedule_text,
            message_text=message_text,
            hint_text=hint_text,
            form_title="Nhập mật khẩu để tắt chế độ nghiêm khắc",
        )
        if self._should_lock_workstation(now):
            WindowsSessionController.lock_workstation()
            self._last_lock_moment = now
        if not self._last_lock_active:
            self._log_event(
                self._state,
                "lock_screen_activated",
                "Màn hình khóa nghiêm khắc đang hiện.",
                now=now,
            )
        self._last_lock_active = True
        return True

    def _build_status(
        self,
        *,
        now: datetime,
        active_window: ProtectionWindow | None,
        pending_countdown: tuple[datetime, datetime] | None,
        hosts_active: bool,
        admin: bool,
        lock_active: bool,
        safe_mode_reason: str,
        service_alive: bool,
        study_window: StudyWindow | None,
        study_profile: StudyProfile | None,
    ) -> EnforcementStatus:
        next_window = resolve_next_window(self._config, self._state, now)
        next_study = resolve_next_study_occurrence(self._config, now)

        pending_text = "Không có thay đổi trì hoãn."
        if self._state.pending_config:
            pending_text = f"Chờ áp dụng lúc {self._state.pending_config.apply_at.replace('T', ' ')}"

        manual_countdown_text = "Không có."
        if pending_countdown:
            activate_at, end_at = pending_countdown
            manual_countdown_text = f"Bật lúc {activate_at.strftime('%H:%M')} - tự hết {end_at.strftime('%H:%M')}"
        elif active_window is not None and active_window.source == "manual_lock":
            manual_countdown_text = f"Đang khóa đến {active_window.end.strftime('%H:%M')}"

        if lock_active:
            summary = "Máy tính đang bị khóa bởi chế độ nghiêm khắc."
        elif study_window is not None:
            summary = f"Đang trong phiên học “{study_window.profile_name}”."
        elif active_window is not None:
            summary = "Đang trong khung giờ chặn tập trung."
        elif self._config.protection_enabled:
            summary = "Đã bật, chờ đến khung giờ tiếp theo."
        else:
            summary = "Bảo vệ đang tắt."

        if safe_mode_reason:
            summary = safe_mode_reason

        next_window_text = "Không có lịch tiếp theo."
        if next_window:
            next_window_text = f"{next_window.start.strftime('%a %d/%m %H:%M')} -> {next_window.end.strftime('%H:%M')}"

        next_study_text = "Không có phiên học theo lịch."
        if next_study:
            next_study_text = f"{next_study.title}: {next_study.start.strftime('%a %d/%m %H:%M')} -> {next_study.end.strftime('%H:%M')}"

        study_label = "Chưa có phiên học"
        study_profile_name = "Chưa chọn"
        study_remaining_text = "Sẵn sàng bắt đầu thủ công."
        study_summary = "Chưa có phiên học đang chạy."
        study_resources: list[str] = []
        study_allowed_apps: list[str] = []
        if study_window is not None and study_profile is not None:
            remaining = max(0, int((study_window.end - now).total_seconds() // 60))
            study_label = study_window.label
            study_profile_name = study_profile.name
            study_remaining_text = f"Còn khoảng {remaining} phút."
            study_summary = f"Đang siết tài nguyên ngoài học cho profile “{study_profile.name}”."
            study_resources = list(study_profile.resource_urls)
            study_allowed_apps = list(study_profile.allowed_apps)
        elif study_profile is not None:
            study_profile_name = study_profile.name
            study_resources = list(study_profile.resource_urls)
            study_allowed_apps = list(study_profile.allowed_apps)

        return EnforcementStatus(
            now_text=now.strftime("%d/%m/%Y %H:%M:%S"),
            protection_enabled=self._config.protection_enabled,
            schedule_active=active_window is not None,
            hosts_active=hosts_active,
            lock_active=lock_active,
            admin=admin,
            mode=self._config.mode,
            summary=summary,
            current_window_label=active_window.label if active_window else self._config.schedule_window(now).label,
            next_window_text=next_window_text,
            pending_change_text=pending_text,
            manual_countdown_text=manual_countdown_text,
            safe_mode=bool(safe_mode_reason),
            safe_mode_reason=safe_mode_reason,
            service_alive=service_alive,
            weekly_stats=self._store.weekly_stats(self._state, now=now),
            today_schedule_label=self._config.schedule_window(now).label,
            study_active=study_window is not None,
            study_profile_name=study_profile_name,
            study_label=study_label,
            study_remaining_text=study_remaining_text,
            next_study_text=next_study_text,
            study_summary=study_summary,
            study_resources=study_resources,
            study_allowed_apps=study_allowed_apps,
        )

    def _handle_unlock_attempt(self, password: str) -> None:
        success, message = self.disable_protection(password)
        self._lock_manager.show_feedback(message, error=not success)

    def _should_lock_workstation(self, now: datetime) -> bool:
        if self._last_lock_moment is None:
            return True
        return now - self._last_lock_moment >= timedelta(seconds=45)

    def _save_state(self) -> None:
        self._store.save_state(self._state)

    def _log_event(
        self,
        state: RuntimeState,
        kind: str,
        message: str,
        *,
        level: str = "info",
        counter_field: str | None = None,
        now: datetime | None = None,
        meta: dict | None = None,
    ) -> None:
        moment = now or datetime.now()
        if counter_field:
            state.bump_counter(moment.date(), counter_field, 1)
        self._store.save_state(state)
        self._store.append_event(kind, message, level=level, meta=meta, at=moment)
        self.log_message.emit(message)
