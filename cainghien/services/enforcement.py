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
    WeeklyStats,
)
from ..ui.lock_overlay import StrictLockManager
from .hosts_blocker import HostsBlocker
from .process_guard import SystemGuard
from .runtime_rules import (
    ProtectionWindow,
    blocked_domains_for_config,
    delay_target_for_change,
    is_service_stale,
    pending_change_due,
    resolve_active_window,
    resolve_next_window,
    resolve_pending_manual_countdown,
    sanitize_runtime_state,
    should_warn_before_lock,
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
        if available_at is None:
            return False
        return now >= available_at

    def emergency_recovery_status_text(self, when: datetime | None = None) -> str:
        now = when or datetime.now()
        self._state = self._store.load_state()
        request = self._state.recovery_request
        if request is None or request.purpose != "account_recovery":
            return "Chua co emergency recovery nao."
        available_at = request.available_dt
        if available_at is None:
            return "Emergency recovery dang loi va can tao lai."
        if now >= available_at:
            return (
                "Emergency recovery da toi han. Ban co the dung no de reset mat khau "
                "hoac go cai dat."
            )
        return f"Emergency recovery se san sang luc {available_at.strftime('%d/%m/%Y %H:%M')}."

    def start_emergency_recovery(self, *, days: int = 7) -> tuple[bool, str]:
        now = datetime.now()
        self._state = self._store.load_state()
        request = self._state.recovery_request
        if request and request.purpose == "account_recovery":
            available_at = request.available_dt
            if available_at is not None and now < available_at:
                return (
                    True,
                    f"Emergency recovery da duoc bat va se san sang luc {available_at.strftime('%d/%m/%Y %H:%M')}.",
                )
            if available_at is not None and now >= available_at:
                return True, "Emergency recovery da toi han va san sang de su dung."

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
            (
                "Da bat emergency recovery cooldown. "
                f"Su dung duoc sau {available_at.strftime('%d/%m/%Y %H:%M')}."
            ),
            level="warning",
            counter_field="tamper_events",
            now=now,
        )
        return True, f"Emergency recovery se san sang luc {available_at.strftime('%d/%m/%Y %H:%M')}."

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
                    "Nhap sai recovery key khi co gang reset mat khau.",
                    level="warning",
                    counter_field="failed_unlocks",
                )
                return False, "Recovery key khong dung.", None
        elif use_emergency_recovery:
            self._state = self._store.load_state()
            if not self.emergency_recovery_due():
                return False, self.emergency_recovery_status_text(), None
        else:
            return False, "Can recovery key hoac emergency recovery de reset mat khau.", None

        recovery_code_display = generate_recovery_code()
        updated = AppConfig.from_dict(self._config.to_dict())
        updated.strict_password = hash_password(new_password)
        updated.recovery_key = hash_password(
            normalize_recovery_code(recovery_code_display)
        )
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
            "Da reset mat khau strict bang co che recovery.",
        )
        self.evaluate(force=True)
        return True, "Da reset mat khau strict thanh cong.", recovery_code_display

    def save_secret_material(
        self,
        *,
        strict_password: PasswordRecord | None | object = None,
        recovery_key: PasswordRecord | None | object = None,
        recovery_key_created_at: str | None | object = None,
        clear_recovery_request: bool = False,
        log_message: str = "Da cap nhat secret material.",
    ) -> tuple[bool, str]:
        now = datetime.now()
        marker = object()
        strict_value = strict_password if strict_password is not None else marker
        recovery_value = recovery_key if recovery_key is not None else marker
        recovery_created_value = (
            recovery_key_created_at if recovery_key_created_at is not None else marker
        )

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
        return bool(
            active_window
            and active_window.strict
            and self._config.has_password
        )

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
            self._log_event(self._state, "integrity_cleanup", message, level="warning", counter_field="tamper_events", now=now)

        if config.to_dict() == self._config.to_dict():
            return True, "Khong co thay doi nao de luu.", False

        delay_target = delay_target_for_change(self._config, self._state, now)
        if (
            self._config.protection_enabled
            and self._config.change_delay_enabled
            and delay_target is not None
        ):
            self._state.pending_config = self._build_pending_change(config, delay_target, now)
            self._state.bump_counter(now.date(), "pending_changes", 1)
            self._save_state()
            message = (
                f"Thay doi da duoc tri hoan den sau {delay_target.label} "
                f"({delay_target.end.strftime('%d/%m %H:%M')})."
            )
            self._log_event(
                self._state,
                "pending_config_created",
                message,
                counter_field=None,
                now=now,
                meta={"apply_at": self._state.pending_config.apply_at},
            )
            self.evaluate(force=True)
            return True, message, True

        self._apply_config(config, now=now, log_message="Da luu thiet lap moi.")
        return True, "Da luu thiet lap.", False

    def disable_protection(self, password: str | None = None) -> tuple[bool, str]:
        if self._config.mode == "strict" and (
            self._config.protection_enabled or self._state.manual_lock is not None
        ):
            if not self.verify_strict_password(password or ""):
                self._log_event(
                    self._state,
                    "unlock_failed",
                    "Nhap sai mat khau khi co gang tat bao ve.",
                    level="warning",
                    counter_field="failed_unlocks",
                )
                return False, "Mat khau khong dung."

        if not self._config.protection_enabled and self._state.manual_lock is None:
            return True, "Bao ve da tat san."

        updated = AppConfig.from_dict(self._config.to_dict())
        updated.protection_enabled = False
        self._ui_access_override = False
        self._state.pending_config = None
        self._state.manual_lock = None
        self._save_state()
        self._apply_config(updated, now=datetime.now(), log_message="Da tat bao ve.")
        return True, "Da tat bao ve."

    def start_manual_lock(self, countdown_minutes: int) -> tuple[bool, str]:
        if not self._config.has_password:
            return False, "Can dat mat khau truoc khi bat manual lock countdown."
        if countdown_minutes < 1:
            return False, "Countdown phai tu 1 phut tro len."

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
        message = (
            f"Manual lock se bat luc {activate_at.strftime('%H:%M')} "
            f"va tu het luc {end_at.strftime('%H:%M')}."
        )
        self._log_event(
            self._state,
            "manual_lock_scheduled",
            message,
            now=now,
        )
        self.evaluate(force=True)
        return True, message

    def cancel_manual_lock(self, password: str | None = None) -> tuple[bool, str]:
        self._state = self._store.load_state()
        if self._state.manual_lock is None:
            return True, "Khong co manual lock nao dang cho."
        if not self.verify_strict_password(password or ""):
            self._log_event(
                self._state,
                "manual_lock_cancel_failed",
                "Nhap sai mat khau khi co gang huy manual lock.",
                level="warning",
                counter_field="failed_unlocks",
            )
            return False, "Mat khau khong dung."
        self._state.manual_lock = None
        self._save_state()
        self._log_event(self._state, "manual_lock_cancelled", "Da huy manual lock countdown.")
        self.evaluate(force=True)
        return True, "Da huy manual lock."

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
                f"Canh bao: khoa se bat luc {warning_window.start.strftime('%H:%M')} "
                f"trong {int((warning_window.start - now).total_seconds() // 60)} phut."
            )
            self._log_event(
                self._state,
                "warning_before_lock",
                message,
                counter_field="warnings_sent",
                now=now,
            )
            self.attention_requested.emit("Canh bao truoc gio khoa", message)
            state_changed = True

        active_window = resolve_active_window(self._config, self._state, now)
        pending_countdown = resolve_pending_manual_countdown(self._state, now)
        service_alive = self._config.service_enabled and not is_service_stale(self._state, now)
        strict_access_required = bool(
            active_window
            and active_window.strict
            and self._config.has_password
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
                    f"Da bat dau khung bao ve {active_window.label}.",
                    now=now,
                )
                state_changed = True
            elif self._last_window_key is not None:
                self._log_event(
                    self._state,
                    "session_finished",
                    "Da ra khoi khung bao ve.",
                    now=now,
                )
            self._last_window_key = current_window_key

        hosts_active, admin, safe_mode_reason = self._evaluate_hosts(active_window, service_alive, force=force, now=now)
        if (
            safe_mode_reason is None
            and active_window is not None
            and active_window.strict
            and not self._config.has_password
        ):
            safe_mode_reason = (
                "Strict dang bat nhung chua co mat khau hop le. "
                "App ha ve chan web de tranh tu khoa vinh vien."
            )
        lock_active = self._evaluate_lock(active_window, now=now, strict_access_required=strict_access_required)

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
                self.attention_requested.emit("Safe mode chong lach", safe_mode_reason)
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
            "Thay doi tri hoan da duoc ap dung.",
            now=now,
        )
        self.config_changed.emit(self._config)
        return True

    def _evaluate_hosts(
        self,
        active_window: ProtectionWindow | None,
        service_alive: bool,
        *,
        force: bool,
        now: datetime,
    ) -> tuple[bool, bool, str | None]:
        admin = self._hosts.is_elevated()
        safe_mode_reason: str | None = None
        if active_window is None:
            if self._hosts_applied and admin:
                ok, message = self._hosts.remove_block()
                self._hosts_applied = False
                self._last_block_signature = ""
                if ok:
                    self._log_event(self._state, "hosts_removed", "Da go chan hosts sau khi het gio khoa.", now=now)
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

        blocked_domains = blocked_domains_for_config(self._config)
        if not blocked_domains:
            return False, admin, "Danh sach chan rong, enforcement hosts khong con tac dung."

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
                        "Da ap dung hosts blocking cho khung gio hien tai.",
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
            "Khong co quyen Admin va service nen chua san sang. "
            "Chan hosts khong duoc dam bao."
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
            schedule_text = f"Khoa tay den {active_window.end.strftime('%H:%M')}"
        message_text = (
            "Dang trong khung gio nghiem khac. Duong vong vao web va may tinh da bi khoa."
            if active_window.source != "manual_lock"
            else "Manual lock dang hoat dong. May tinh se tu mo lai khi het thoi gian hoac khi nhap dung mat khau."
        )
        hint_text = (
            "Nhap dung mat khau de tat che do nghiem khac. Sai mat khau se bi khoa thu lai 60 giay."
        )
        self._lock_manager.show(
            schedule_text=schedule_text,
            message_text=message_text,
            hint_text=hint_text,
            form_title="Nhap mat khau de tat che do nghiem khac",
        )
        if self._should_lock_workstation(now):
            WindowsSessionController.lock_workstation()
            self._last_lock_moment = now
        if not self._last_lock_active:
            self._log_event(
                self._state,
                "lock_screen_activated",
                "Man hinh khoa nghiem khac dang hien.",
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
    ) -> EnforcementStatus:
        next_window = resolve_next_window(self._config, self._state, now)
        pending_text = "Khong co thay doi tri hoan."
        if self._state.pending_config:
            pending_text = (
                f"Cho ap dung luc "
                f"{self._state.pending_config.apply_at.replace('T', ' ')}"
            )

        manual_countdown_text = "Khong co."
        if pending_countdown:
            activate_at, end_at = pending_countdown
            manual_countdown_text = (
                f"Bat luc {activate_at.strftime('%H:%M')} - tu het {end_at.strftime('%H:%M')}"
            )
        elif active_window is not None and active_window.source == "manual_lock":
            manual_countdown_text = f"Dang khoa den {active_window.end.strftime('%H:%M')}"

        if lock_active:
            summary = "May tinh dang bi khoa boi strict mode."
        elif active_window is not None:
            summary = "Dang trong khung gio chan tap trung."
        elif self._config.protection_enabled:
            summary = "Da arm, cho den khung gio tiep theo."
        else:
            summary = "Bao ve dang tat."

        if safe_mode_reason:
            summary = safe_mode_reason

        next_window_text = "Khong co lich tiep theo."
        if next_window:
            next_window_text = (
                f"{next_window.start.strftime('%a %d/%m %H:%M')} -> "
                f"{next_window.end.strftime('%H:%M')}"
            )

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
