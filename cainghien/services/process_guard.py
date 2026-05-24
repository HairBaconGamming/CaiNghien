from __future__ import annotations

import contextlib
import winreg

import psutil


class SystemGuard:
    CRITICAL_PROCESSES = {
        "svchost.exe", "csrss.exe", "wininit.exe", "smss.exe",
        "services.exe", "lsass.exe", "winlogon.exe", "explorer.exe",
        "taskmgr.exe", "system", "registry", "spoolsv.exe"
    }

    @staticmethod
    def set_task_manager_enabled(enabled: bool) -> None:
        try:
            registry_path = r"Software\Microsoft\Windows\CurrentVersion\Policies\System"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, registry_path) as key:
                with contextlib.suppress(FileNotFoundError):
                    winreg.DeleteValue(key, "DisableTaskMgr")
        except Exception:
            pass


