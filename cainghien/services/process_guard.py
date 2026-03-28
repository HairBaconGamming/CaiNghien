from __future__ import annotations

import contextlib
import winreg

import psutil


class SystemGuard:
    @staticmethod
    def set_task_manager_enabled(enabled: bool) -> None:
        try:
            registry_path = r"Software\Microsoft\Windows\CurrentVersion\Policies\System"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, registry_path) as key:
                if enabled:
                    with contextlib.suppress(FileNotFoundError):
                        winreg.DeleteValue(key, "DisableTaskMgr")
                else:
                    winreg.SetValueEx(key, "DisableTaskMgr", 0, winreg.REG_DWORD, 1)
        except Exception:
            pass

    @staticmethod
    def enforce_process_block(blocked_processes: list[str]) -> list[str]:
        blocked = {item.strip().lower() for item in blocked_processes if item.strip()}
        if not blocked:
            return []

        killed: list[str] = []
        for proc in psutil.process_iter(["name"]):
            try:
                name = str(proc.info.get("name") or "").lower()
                if name and name in blocked:
                    proc.kill()
                    killed.append(name)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
        return killed
