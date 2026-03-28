from __future__ import annotations

from datetime import datetime

import win32event
import win32service
import win32serviceutil

try:
    import servicemanager
except Exception:  # pragma: no cover
    servicemanager = None

from .config import ConfigStore
from .models import AppConfig, StudyProfile, StudySessionState
from .services.hosts_blocker import HostsBlocker
from .services.runtime_rules import (
    blocked_domains_for_config,
    pending_change_due,
    resolve_active_study_occurrence,
    resolve_active_window,
    sanitize_runtime_state,
    study_window_from_session,
)
from .services.windows_guard import SERVICE_DISPLAY_NAME, SERVICE_NAME, WindowsStartupManager


class FocusGuardService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = SERVICE_DISPLAY_NAME
    _svc_description_ = (
        "Áp dụng chặn hosts, heartbeat và cấu hình trì hoãn cho CaiNghiện Focus Guard."
    )

    def __init__(self, args) -> None:
        super().__init__(args)
        self._stop_event = win32event.CreateEvent(None, 0, 0, None)
        self._store = ConfigStore()
        self._hosts = HostsBlocker()
        self._startup = WindowsStartupManager()
        self._hosts_applied = False
        self._last_signature = ""

    def SvcStop(self) -> None:  # noqa: N802
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self._stop_event)

    def SvcDoRun(self) -> None:  # noqa: N802
        if servicemanager is not None:
            servicemanager.LogInfoMsg("CaiNghiện Focus Guard Service đang chạy.")
        self.main()

    def main(self) -> None:
        while True:
            wait_result = win32event.WaitForSingleObject(self._stop_event, 10_000)
            if wait_result == win32event.WAIT_OBJECT_0:
                break
            self.run_once()

    def run_once(self) -> None:
        now = datetime.now()
        config = self._store.load()
        state = self._store.load_state()
        state, cleanup_messages = sanitize_runtime_state(state, now)
        for message in cleanup_messages:
            self._store.append_event(
                "service_integrity_cleanup",
                message,
                level="warning",
                at=now,
            )
            state.bump_counter(now.date(), "tamper_events", 1)

        pending = pending_change_due(state, now)
        if pending is not None:
            config = AppConfig.from_dict(pending.payload)
            self._store.save(config)
            state.pending_config = None
            self._store.append_event(
                "service_pending_applied",
                "Service đã áp dụng thay đổi trì hoãn.",
                at=now,
            )

        state.service_last_seen = now.isoformat(timespec="seconds")
        state.service_enabled = config.service_enabled

        if config.start_with_windows and not self._startup.is_enabled():
            try:
                self._startup.set_enabled(True)
            except OSError:
                self._store.append_event(
                    "service_startup_fix_failed",
                    "Service không thể khôi phục startup entry.",
                    level="warning",
                    at=now,
                )

        stale_ui = self._is_ui_stale(state, now)
        active_window = resolve_active_window(config, state, now)
        study_profile = self._sync_background_study_session(
            config=config,
            state=state,
            now=now,
            active_window=active_window,
            stale_ui=stale_ui,
        )
        study_active = study_window_from_session(state, now) is not None
        blocked_domains = blocked_domains_for_config(
            config,
            study_profile if study_active else None,
        )
        if config.service_enabled and (active_window or study_active) and blocked_domains:
            signature = "|".join(blocked_domains)
            if signature != self._last_signature or not self._hosts_applied:
                ok, message = self._hosts.apply_block(blocked_domains)
                self._hosts_applied = ok
                self._last_signature = signature
                if not ok:
                    self._store.append_event(
                        "service_hosts_failed",
                        message,
                        level="warning",
                        at=now,
                    )
                    state.bump_counter(now.date(), "tamper_events", 1)
        else:
            if self._hosts_applied:
                self._hosts.remove_block()
            self._hosts_applied = False
            self._last_signature = ""

        if active_window and active_window.strict and not config.has_password:
            state.safe_mode_reason = "Service phát hiện strict đang bật nhưng không có mật khẩu hợp lệ."
            if state.last_integrity_issue != "strict_without_password":
                state.bump_counter(now.date(), "tamper_events", 1)
                self._store.append_event(
                    "service_safe_mode",
                    state.safe_mode_reason,
                    level="warning",
                    at=now,
                )
            state.last_integrity_issue = "strict_without_password"
        elif state.safe_mode_reason and "Service phát hiện strict" in state.safe_mode_reason:
            state.safe_mode_reason = None
            if state.last_integrity_issue == "strict_without_password":
                state.last_integrity_issue = None

        if active_window and active_window.strict:
            if stale_ui:
                if state.last_integrity_issue != "ui_heartbeat_missing":
                    self._store.append_event(
                        "service_ui_heartbeat_missing",
                        "Service không thấy heartbeat UI trong khi strict đang hoạt động.",
                        level="warning",
                        at=now,
                    )
                    state.bump_counter(now.date(), "tamper_events", 1)
                state.last_integrity_issue = "ui_heartbeat_missing"
            elif state.last_integrity_issue == "ui_heartbeat_missing":
                state.last_integrity_issue = None

        self._store.save_state(state)

    def _is_ui_stale(self, state, now: datetime) -> bool:
        try:
            return (
                state.ui_last_seen is None
                or (now - datetime.fromisoformat(state.ui_last_seen)).total_seconds() > 150
            )
        except ValueError:
            return True

    def _sync_background_study_session(
        self,
        *,
        config: AppConfig,
        state,
        now: datetime,
        active_window,
        stale_ui: bool,
    ) -> StudyProfile | None:
        if not config.protection_enabled and state.study_session is None:
            state.last_study_conflict_key = None
            state.last_study_counted_minute = None
            return None

        if stale_ui and state.study_session is not None:
            study_window = study_window_from_session(state, now)
            session = state.study_session
            if study_window is None:
                self._finish_service_study_session(state, now, completed=True)
            elif active_window is not None and active_window.strict:
                self._finish_service_study_session(
                    state,
                    now,
                    completed=False,
                    reason="Bị ngắt bởi strict mode",
                )

        scheduled_occurrence = resolve_active_study_occurrence(config, now) if config.protection_enabled else None
        if (
            scheduled_occurrence is not None
            and active_window is not None
            and active_window.strict
        ):
            conflict_key = f"{scheduled_occurrence.profile_id}:{scheduled_occurrence.start.isoformat()}"
            if state.last_study_conflict_key != conflict_key:
                state.last_study_conflict_key = conflict_key
                self._store.append_event(
                    "study_conflict_strict",
                    f"Phiên học “{scheduled_occurrence.title}” không thể bắt đầu vì strict mode đang hoạt động.",
                    level="warning",
                    at=now,
                    meta={"profile_name": scheduled_occurrence.title},
                )
        elif state.last_study_conflict_key:
            state.last_study_conflict_key = None

        if stale_ui and state.study_session is None and scheduled_occurrence is not None and (
            active_window is None or not active_window.strict
        ):
            profile = config.study_profile(scheduled_occurrence.profile_id)
            state.study_session = StudySessionState(
                session_id=f"scheduled:{profile.id}:{now.isoformat(timespec='seconds')}",
                profile_id=profile.id,
                profile_name=profile.name,
                source="scheduled",
                started_at=now.isoformat(timespec="seconds"),
                target_end_at=scheduled_occurrence.end.isoformat(timespec="seconds"),
                duration_minutes=max(
                    1,
                    int((scheduled_occurrence.end - now).total_seconds() // 60),
                ),
                resource_urls=list(profile.resource_urls),
                allowed_apps=list(profile.allowed_apps),
                blocked_processes=list(profile.blocked_processes),
                blocked_domains=blocked_domains_for_config(config, profile),
                schedule_day_key=scheduled_occurrence.day_key,
                schedule_start_at=scheduled_occurrence.start.isoformat(timespec="seconds"),
                schedule_end_at=scheduled_occurrence.end.isoformat(timespec="seconds"),
            )
            self._store.append_event(
                "study_session_started",
                f"Đã bắt đầu phiên học “{profile.name}”.",
                at=now,
                meta={
                    "profile_id": profile.id,
                    "profile_name": profile.name,
                    "source": "scheduled",
                    "duration_minutes": state.study_session.duration_minutes,
                },
            )
            for domain in state.study_session.blocked_domains:
                state.bump_counter(now.date(), "study_site_blocks", 1)
                self._store.append_event(
                    "study_site_blocked",
                    f"Đang siết web xao nhãng {domain} trong phiên “{profile.name}”.",
                    at=now,
                    meta={"source": domain, "profile_name": profile.name},
                )

        study_window = study_window_from_session(state, now)
        if study_window is None:
            state.last_study_counted_minute = None
            return None

        if stale_ui:
            minute_key = now.strftime("%Y-%m-%dT%H:%M")
            if state.last_study_counted_minute != minute_key:
                state.last_study_counted_minute = minute_key
                state.bump_counter(now.date(), "study_minutes", 1)
        return config.study_profile(state.study_session.profile_id) if state.study_session else None

    def _finish_service_study_session(
        self,
        state,
        now: datetime,
        *,
        completed: bool,
        reason: str | None = None,
    ) -> None:
        session = state.study_session
        if session is None:
            return
        if completed:
            state.bump_counter(now.date(), "study_sessions_completed", 1)
            kind = "study_session_completed"
            message = f"Đã hoàn thành phiên học “{session.profile_name}”."
            level = "info"
        else:
            state.bump_counter(now.date(), "study_sessions_aborted", 1)
            kind = "study_session_aborted"
            message = f"Đã dừng sớm phiên học “{session.profile_name}”."
            level = "warning"
        state.study_session = None
        state.last_study_counted_minute = None
        self._store.append_event(
            kind,
            message,
            level=level,
            at=now,
            meta={
                "profile_id": session.profile_id,
                "profile_name": session.profile_name,
                "source": session.source,
                "reason": reason or "",
            },
        )


def main() -> int:
    win32serviceutil.HandleCommandLine(FocusGuardService)
    return 0
