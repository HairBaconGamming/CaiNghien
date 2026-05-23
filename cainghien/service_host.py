from __future__ import annotations

import sys
import traceback
from datetime import datetime

import win32event
import win32service
import win32serviceutil

try:
    import servicemanager
except Exception:  # pragma: no cover
    servicemanager = None

from .config import ConfigStore
from .models import AppConfig, RuntimeState
from .services.hosts_blocker import HostsBlocker
from .services.runtime_rules import (
    blocked_domains_for_config,
    pending_change_due,
    resolve_active_window,
    sanitize_runtime_state,
)
from .services.windows_guard import SERVICE_DISPLAY_NAME, SERVICE_NAME


class FocusGuardService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = SERVICE_DISPLAY_NAME
    _svc_description_ = (
        "Ap dung chan hosts, heartbeat va cau hinh tri hoan cho CaiNghien Focus Guard."
    )

    def __init__(self, args) -> None:
        super().__init__(args)
        self._stop_event = win32event.CreateEvent(None, 0, 0, None)
        self._store = ConfigStore(root_dir=ConfigStore.shared_root_path())
        self._hosts = HostsBlocker()
        self._hosts_applied = False
        self._last_signature = ""
        self._last_runtime_error_key: str | None = None

    def SvcStop(self) -> None:  # noqa: N802
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self._stop_event)

    def SvcDoRun(self) -> None:  # noqa: N802
        if servicemanager is not None:
            servicemanager.LogInfoMsg("CaiNghien Focus Guard Service dang chay.")
        self.main()

    def main(self) -> None:
        self._run_once_safely()
        while True:
            wait_result = win32event.WaitForSingleObject(self._stop_event, 10_000)
            if wait_result == win32event.WAIT_OBJECT_0:
                break
            self._run_once_safely()

    def _run_once_safely(self) -> None:
        try:
            self.run_once()
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            detail = traceback.format_exc(limit=8)
            now = datetime.now()
            error_key = f"{type(exc).__name__}:{exc}"
            if self._last_runtime_error_key != error_key:
                self._store.append_event(
                    "service_runtime_failed",
                    f"Service gap loi khi dang chay: {exc}",
                    level="error",
                    at=now,
                    meta={"traceback": detail},
                )
                self._last_runtime_error_key = error_key
            if servicemanager is not None:
                servicemanager.LogErrorMsg(
                    "CaiNghien Focus Guard Service gap loi vong lap:\n" + detail
                )

    def run_once(self) -> None:
        now = datetime.now()
        config = self._store.load()
        config, guarded_message = self._guard_against_continuous_strict_lock(
            config,
            now=now,
            source="service_runtime",
        )
        if guarded_message is not None:
            self._store.save(config)

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
            config, guarded_message = self._guard_against_continuous_strict_lock(
                config,
                now=now,
                source="service_pending",
            )
            self._store.save(config)
            state.pending_config = None
            self._store.append_event(
                "service_pending_applied",
                guarded_message or "Service da ap dung thay doi tri hoan.",
                at=now,
            )

        state.service_last_seen = now.isoformat(timespec="seconds")
        state.service_enabled = config.service_enabled

        stale_ui = self._is_ui_stale(state, now)
        active_window = resolve_active_window(config, state, now)
        blocked_domains = blocked_domains_for_config(config)
        if config.service_enabled and active_window and blocked_domains:
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
            state.safe_mode_reason = (
                "Service phat hien strict dang bat nhung khong co mat khau hop le."
            )
            if state.last_integrity_issue != "strict_without_password":
                state.bump_counter(now.date(), "tamper_events", 1)
                self._store.append_event(
                    "service_safe_mode",
                    state.safe_mode_reason,
                    level="warning",
                    at=now,
                )
            state.last_integrity_issue = "strict_without_password"
        elif state.safe_mode_reason and "Service phat hien strict" in state.safe_mode_reason:
            state.safe_mode_reason = None
            if state.last_integrity_issue == "strict_without_password":
                state.last_integrity_issue = None

        if active_window and active_window.strict:
            if stale_ui:
                if state.last_integrity_issue != "ui_heartbeat_missing":
                    self._store.append_event(
                        "service_ui_heartbeat_missing",
                        "Service khong thay heartbeat UI trong khi strict dang hoat dong.",
                        level="warning",
                        at=now,
                    )
                    state.bump_counter(now.date(), "tamper_events", 1)
                state.last_integrity_issue = "ui_heartbeat_missing"
            elif state.last_integrity_issue == "ui_heartbeat_missing":
                state.last_integrity_issue = None

        self._store.save_state(state)
        self._last_runtime_error_key = None

    def _guard_against_continuous_strict_lock(
        self,
        config: AppConfig,
        *,
        now: datetime,
        source: str,
    ) -> tuple[AppConfig, str | None]:
        if not config.creates_continuous_strict_lock():
            return config, None

        updated = AppConfig.from_dict(config.to_dict())
        updated.mode = "normal"
        message = (
            "Service phat hien lich nghiem khac 24/7 va da ha ve che do binh thuong "
            "de tranh tu khoa vinh vien."
        )
        self._store.append_event(
            "service_strict_schedule_guarded",
            message,
            level="warning",
            at=now,
            meta={"source": source},
        )
        return updated, message

    def _is_ui_stale(self, state: RuntimeState, now: datetime) -> bool:
        try:
            return (
                state.ui_last_seen is None
                or (now - datetime.fromisoformat(state.ui_last_seen)).total_seconds() > 150
            )
        except ValueError:
            return True




def main() -> int:
    if len(sys.argv) == 1:
        if servicemanager is None:
            raise RuntimeError("Khong tai duoc servicemanager de host Windows service.")
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(FocusGuardService)
        servicemanager.StartServiceCtrlDispatcher()
        return 0

    win32serviceutil.HandleCommandLine(FocusGuardService)
    return 0
