from __future__ import annotations

import ctypes
import subprocess
import sys
from pathlib import Path

import winreg

try:
    import pywintypes
    import win32service
    import win32serviceutil
except Exception:  # pragma: no cover - optional at source checkout time
    pywintypes = None
    win32service = None
    win32serviceutil = None


APP_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_VALUE_NAME = "CaiNghienFocusGuard"
SERVICE_NAME = "CaiNghienFocusGuardService"
SERVICE_DISPLAY_NAME = "CaiNghien Focus Guard Service"


def quote_command(parts: list[str]) -> str:
    return " ".join(f'"{part}"' for part in parts if part)


def current_launch_tokens(*extra_args: str) -> list[str]:
    if getattr(sys, "frozen", False):
        return [str(Path(sys.executable).resolve()), *extra_args]
    executable = Path(sys.executable).resolve()
    script = Path(sys.argv[0]).resolve()
    return [str(executable), str(script), *extra_args]


def current_launch_command(*extra_args: str) -> str:
    return quote_command(current_launch_tokens(*extra_args))


def startup_launch_command() -> str:
    return current_launch_command("--background", "--startup")


def service_launch_tokens(*extra_args: str) -> list[str]:
    if getattr(sys, "frozen", False):
        service_executable = Path(sys.executable).resolve().with_name(
            "CaiNghienFocusGuardService.exe"
        )
        return [str(service_executable), *extra_args]

    service_script = Path(__file__).resolve().parents[2] / "service.py"
    return [str(Path(sys.executable).resolve()), str(service_script), *extra_args]


class WindowsSessionController:
    @staticmethod
    def relaunch_as_admin() -> bool:
        try:
            if getattr(sys, "frozen", False):
                executable = sys.executable
                parameters = " ".join(f'"{arg}"' for arg in sys.argv[1:])
            else:
                executable = sys.executable
                parameters = " ".join(f'"{arg}"' for arg in sys.argv)
            result = ctypes.windll.shell32.ShellExecuteW(
                None,
                "runas",
                executable,
                parameters,
                None,
                1,
            )
            return result > 32
        except Exception:
            return False

    @staticmethod
    def lock_workstation() -> bool:
        try:
            return bool(ctypes.windll.user32.LockWorkStation())
        except Exception:
            return False


class WindowsStartupManager:
    def is_enabled(self) -> bool:
        try:
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                APP_RUN_KEY,
                0,
                winreg.KEY_READ,
            ) as handle:
                value, _ = winreg.QueryValueEx(handle, APP_VALUE_NAME)
            return bool(value)
        except FileNotFoundError:
            return False
        except OSError:
            return False

    def set_enabled(self, enabled: bool) -> None:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            APP_RUN_KEY,
            0,
            winreg.KEY_SET_VALUE,
        ) as handle:
            if enabled:
                winreg.SetValueEx(
                    handle,
                    APP_VALUE_NAME,
                    0,
                    winreg.REG_SZ,
                    startup_launch_command(),
                )
            else:
                try:
                    winreg.DeleteValue(handle, APP_VALUE_NAME)
                except FileNotFoundError:
                    pass


class WindowsServiceManager:
    def is_available(self) -> bool:
        path = Path(service_launch_tokens()[0])
        return path.exists()

    def query_status(self) -> tuple[bool, str]:
        if win32serviceutil is None or win32service is None:
            return False, "PyWin32 chưa sẵn sàng."
        try:
            status = win32serviceutil.QueryServiceStatus(SERVICE_NAME)[1]
        except Exception as exc:
            if pywintypes is not None and isinstance(exc, pywintypes.error):
                if exc.winerror == 1060:
                    return False, "Dịch vụ chưa được cài."
            return False, str(exc)

        if status == win32service.SERVICE_RUNNING:
            return True, "Dịch vụ đang chạy."
        if status == win32service.SERVICE_START_PENDING:
            return False, "Dịch vụ đang khởi động."
        if status == win32service.SERVICE_STOP_PENDING:
            return False, "Dịch vụ đang dừng."
        return False, "Dịch vụ đang tắt."

    def install_and_start(self) -> tuple[bool, str]:
        if not self.is_available():
            return False, "Không tìm thấy tệp chương trình hoặc service.py để cài dịch vụ."

        installed, message = self.query_status()
        if "chưa được cài" in message.lower():
            ok, install_message = self._run_command("install", "--startup", "auto")
            if not ok:
                return False, install_message
        ok, start_message = self.start()
        return ok, start_message

    def ensure_running(self) -> tuple[bool, str]:
        running, message = self.query_status()
        if running:
            return True, message
        if "chưa được cài" in message.lower():
            return self.install_and_start()
        return self.start()

    def start(self) -> tuple[bool, str]:
        return self._run_command("start")

    def stop(self) -> tuple[bool, str]:
        return self._run_command("stop")

    def remove(self) -> tuple[bool, str]:
        return self._run_command("remove")

    def _run_command(self, *args: str) -> tuple[bool, str]:
        try:
            result = subprocess.run(
                service_launch_tokens(*args),
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
        except OSError as exc:
            return False, str(exc)
        output = (result.stdout or result.stderr or "").strip() or "Không có output."
        return result.returncode == 0, output
