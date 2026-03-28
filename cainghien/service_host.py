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
from .models import AppConfig
from .services.hosts_blocker import HostsBlocker
from .services.runtime_rules import (
    blocked_domains_for_config,
    pending_change_due,
    resolve_active_window,
    sanitize_runtime_state,
)
from .services.windows_guard import SERVICE_DISPLAY_NAME, SERVICE_NAME, WindowsStartupManager


class FocusGuardService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = SERVICE_DISPLAY_NAME
    _svc_description_ = (
        "Ap dung hosts blocking, heartbeat va pending changes cho CaiNghien Focus Guard."
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
            servicemanager.LogInfoMsg("CaiNghien Focus Guard Service dang chay.")
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
                "Service da ap dung thay doi tri hoan.",
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
                    "Service khong the khoi phuc startup entry.",
                    level="warning",
                    at=now,
                )

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
            state.safe_mode_reason = "Service phat hien strict dang bat nhung khong co mat khau hop le."
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
            try:
                stale_ui = (
                    state.ui_last_seen is None
                    or (now - datetime.fromisoformat(state.ui_last_seen)).total_seconds() > 150
                )
            except ValueError:
                stale_ui = True
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


def main() -> int:
    win32serviceutil.HandleCommandLine(FocusGuardService)
    return 0
