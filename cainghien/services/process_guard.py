from __future__ import annotations

import winreg
import psutil

FORBIDDEN_PROCESSES = {
    "taskmgr.exe",          # Chặn Task Manager
    "robloxplayerbeta.exe", # Chặn Game
    "valorant.exe",
    "leagueoflegends.exe"
}

class SystemGuard:
    @staticmethod
    def set_task_manager_enabled(enabled: bool) -> None:
        """Dùng Registry để Khóa/Mở Khóa Task Manager (Cần quyền Admin)."""
        try:
            registry_path = r"Software\Microsoft\Windows\CurrentVersion\Policies\System"
            # Tạo key nếu chưa tồn tại
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, registry_path) as key:
                if enabled:
                    try:
                        winreg.DeleteValue(key, "DisableTaskMgr")
                    except FileNotFoundError:
                        pass  # Key không tồn tại, bỏ qua
                else:
                    winreg.SetValueEx(key, "DisableTaskMgr", 0, winreg.REG_DWORD, 1)
        except Exception:
            pass  # Bỏ qua nếu không đủ quyền Admin

    @staticmethod
    def enforce_process_block() -> None:
        """Quét và kill các process bị cấm đang chạy."""
        for proc in psutil.process_iter(['name']):
            try:
                if proc.info['name'] and proc.info['name'].lower() in FORBIDDEN_PROCESSES:
                    proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
