from __future__ import annotations

import ctypes
import shutil
import subprocess
import sys
from pathlib import Path

import winreg

from ..config import ConfigStore
from ..windows_subprocess import run_hidden

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
    def is_admin() -> bool:
        try:
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:
            return False

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
        return self.current_service_source_path().exists()

    def current_service_source_path(self) -> Path:
        return Path(service_launch_tokens()[0]).resolve()

    def current_bundle_dir(self) -> Path:
        if getattr(sys, "frozen", False):
            return Path(sys.executable).resolve().parent
        return Path(__file__).resolve().parents[2]

    def shared_bundle_dir(self) -> Path:
        return ConfigStore.shared_container_root_path() / "service-bundle"

    def shared_data_dir(self) -> Path:
        return ConfigStore.shared_root_path()

    def shared_service_path(self) -> Path:
        if getattr(sys, "frozen", False):
            return self.shared_bundle_dir() / "CaiNghienFocusGuardService.exe"
        return self.current_service_source_path()

    def expected_service_path(self) -> Path:
        if getattr(sys, "frozen", False):
            return self.shared_service_path()
        return self.current_service_source_path()

    def query_configuration(self) -> dict[str, str]:
        try:
            result = run_hidden(
                ["sc.exe", "qc", SERVICE_NAME],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
        except OSError as exc:
            return {
                "installed": "Không",
                "image_path": "",
                "start_type": "",
                "message": str(exc),
            }

        output = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
        lowered = output.lower()
        if "1060" in lowered or "does not exist as an installed service" in lowered:
            return {
                "installed": "Không",
                "image_path": "",
                "start_type": "",
                "message": "Dịch vụ chưa được cài.",
            }

        image_path = ""
        start_type = ""
        for raw_line in output.splitlines():
            line = raw_line.strip()
            upper = line.upper()
            if upper.startswith("BINARY_PATH_NAME"):
                _, _, value = raw_line.partition(":")
                image_path = self._normalize_service_image_path(value.strip())
            elif upper.startswith("START_TYPE"):
                _, _, value = raw_line.partition(":")
                start_type = value.strip()

        return {
            "installed": "Có",
            "image_path": image_path,
            "start_type": start_type,
            "message": "Đã đọc cấu hình dịch vụ.",
        }

    def validate_installation(self) -> tuple[bool, str]:
        config = self.query_configuration()
        if config["installed"] != "Có":
            return False, config["message"]

        actual = config["image_path"]
        if not actual:
            return False, "Không đọc được đường dẫn file của dịch vụ."
        if not Path(actual).exists():
            return False, (
                "Dịch vụ đang trỏ tới một file không còn tồn tại.\n"
                f"Hiện tại: {actual}"
            )

        if not getattr(sys, "frozen", False):
            return True, "Đang chạy từ source checkout; bỏ qua kiểm tra đường dẫn service tuyệt đối."

        expected = str(self.expected_service_path())
        if actual.lower() != expected.lower():
            return False, (
                "Dịch vụ đang trỏ tới file cũ hoặc sai vị trí.\n"
                f"Hiện tại: {actual}\n"
                f"Mong đợi: {expected}"
            )
        return True, "Dịch vụ đang trỏ đúng file hiện tại."

    def diagnostics(self) -> dict[str, str]:
        running, message = self.query_status()
        path_ok, path_message = self.validate_installation()
        config = self.query_configuration()
        return {
            "available": "Có" if self.is_available() else "Không",
            "installed": config["installed"],
            "running": "Có" if running else "Không",
            "message": message,
            "path_ok": "Có" if path_ok else "Không",
            "path_message": path_message,
            "image_path": config["image_path"],
            "expected_image_path": str(self.expected_service_path()),
            "start_type": config["start_type"],
        }

    def query_status(self) -> tuple[bool, str]:
        if win32serviceutil is None or win32service is None:
            return self._query_status_with_sc()
        try:
            status = win32serviceutil.QueryServiceStatus(SERVICE_NAME)[1]
        except Exception as exc:
            if pywintypes is not None and isinstance(exc, pywintypes.error) and exc.winerror == 1060:
                return False, "Dịch vụ chưa được cài."
            fallback_ok, fallback_message = self._query_status_with_sc()
            if "chưa được cài" in fallback_message.lower():
                return fallback_ok, fallback_message
            return False, str(exc)

        if status == win32service.SERVICE_RUNNING:
            return True, "Dịch vụ đang chạy."
        if status == win32service.SERVICE_START_PENDING:
            return False, "Dịch vụ đang khởi động."
        if status == win32service.SERVICE_STOP_PENDING:
            return False, "Dịch vụ đang dừng."
        return False, "Dịch vụ đang tắt."

    def install_and_start(self, store: ConfigStore | None = None) -> tuple[bool, str]:
        if not self.is_available():
            return False, "Không tìm thấy file service để cài đặt."
        if not WindowsSessionController.is_admin():
            return False, "Cần chạy app với quyền Admin để cài hoặc sửa dịch vụ."

        prepared, prepare_message = self._prepare_shared_installation(store=store)
        if not prepared:
            return False, prepare_message

        _installed, message = self.query_status()
        if "chưa được cài" in message.lower():
            ok, install_message = self._run_command(
                "--startup",
                "auto",
                "install",
                prefer_shared=True,
            )
            if not ok:
                return False, install_message
        ok, start_message = self.start()
        if not ok:
            return False, start_message
        return self.query_status()

    def ensure_running(self, store: ConfigStore | None = None) -> tuple[bool, str]:
        if not self.is_available():
            return False, "Không tìm thấy file service để cài hoặc khởi động."
        if not WindowsSessionController.is_admin():
            return False, "Cần chạy app với quyền Admin để cài hoặc mở dịch vụ."

        running, message = self.query_status()
        install_ok, install_message = self.validate_installation()
        if running and install_ok:
            return True, message
        if running and not install_ok:
            return self.repair_installation(reason=install_message, store=store)
        if "chưa được cài" in message.lower():
            return self.install_and_start(store=store)
        if not install_ok:
            return self.repair_installation(reason=install_message, store=store)

        ok, start_message = self.start()
        post_running, post_message = self.query_status()
        if ok and post_running:
            return True, post_message
        repair_ok, repair_message = self.repair_installation(
            reason=start_message or post_message,
            store=store,
        )
        if repair_ok:
            return True, repair_message
        return False, start_message or repair_message

    def start(self) -> tuple[bool, str]:
        return self._run_command("--wait", "45", "start", prefer_shared=True)

    def stop(self) -> tuple[bool, str]:
        return self._run_command("--wait", "30", "stop", prefer_shared=True)

    def remove(self) -> tuple[bool, str]:
        ok, message = self._run_command("remove", prefer_shared=True)
        if ok:
            ConfigStore.clear_shared_mode()
        return ok, message

    def repair_installation(
        self,
        *,
        reason: str | None = None,
        store: ConfigStore | None = None,
    ) -> tuple[bool, str]:
        if not self.is_available():
            return False, "Không tìm thấy file service để sửa."
        if not WindowsSessionController.is_admin():
            return False, "Cần quyền Admin để sửa dịch vụ."

        prepared, prepare_message = self._prepare_shared_installation(store=store)
        if not prepared:
            return False, prepare_message

        _running, status_message = self.query_status()
        if "chưa được cài" not in status_message.lower():
            ok, update_message = self._run_command(
                "--startup",
                "auto",
                "update",
                prefer_shared=True,
            )
            if ok:
                ok, start_message = self.start()
                post_running, post_message = self.query_status()
                if ok and post_running:
                    return True, "Dịch vụ đã được sửa và khởi động lại."
                reason = start_message or post_message or reason
            else:
                reason = update_message or reason

        self.stop()
        self.remove()
        ok, message = self.install_and_start(store=store)
        if ok:
            return True, "Dịch vụ đã được sửa và khởi động lại."
        if reason:
            return False, f"{reason}\n\n{message}"
        return False, message

    def _run_command(self, *args: str, prefer_shared: bool = False) -> tuple[bool, str]:
        if not self.is_available():
            return False, "Không tìm thấy file service để thực thi lệnh."
        try:
            result = run_hidden(
                self._command_tokens(*args, prefer_shared=prefer_shared),
                capture_output=True,
                text=True,
                timeout=self._command_timeout(*args),
                check=False,
            )
        except OSError as exc:
            return False, str(exc)
        output = (result.stdout or result.stderr or "").strip() or "Không có output."
        normalized = output.lower()
        known_error_markers = (
            "usage:",
            "error installing service:",
            "error starting service:",
            "error stopping service:",
            "error removing service:",
            "error updating service:",
            "error changing service configuration:",
        )
        if result.returncode != 0:
            return False, output
        if "timely fashion" in normalized or "1053" in normalized:
            return (
                False,
                "Dịch vụ không phản hồi kịp khi khởi động. Hãy sửa hoặc cài lại dịch vụ "
                "để đồng bộ đúng service host mới nhất.",
            )
        if any(marker in normalized for marker in known_error_markers):
            return False, output
        if normalized.startswith("error ") or "\nerror " in normalized:
            return False, output
        return True, output

    def _command_timeout(self, *args: str) -> int:
        verbs = {arg.lower() for arg in args}
        if "start" in verbs or "restart" in verbs:
            return 90
        if "install" in verbs or "update" in verbs:
            return 60
        return 30

    def _command_tokens(self, *args: str, prefer_shared: bool = False) -> list[str]:
        if prefer_shared and getattr(sys, "frozen", False):
            shared_executable = self.shared_service_path()
            if shared_executable.exists():
                return [str(shared_executable), *args]
        return service_launch_tokens(*args)

    def _prepare_shared_installation(
        self,
        *,
        store: ConfigStore | None = None,
    ) -> tuple[bool, str]:
        if not getattr(sys, "frozen", False):
            return True, str(self.current_service_source_path())

        source_bundle = self.current_bundle_dir()
        if not source_bundle.exists():
            return False, "Không tìm thấy bundle hiện tại để đồng bộ dịch vụ."

        target_bundle = self.shared_bundle_dir()
        if source_bundle == target_bundle:
            access_ok, access_message = self._harden_service_storage()
            if not access_ok:
                return False, access_message
            if store is not None:
                sync_ok, sync_message = self.sync_service_store(store)
                if not sync_ok:
                    return False, sync_message
            return True, str(self.shared_service_path())

        staging_bundle = target_bundle.with_name(target_bundle.name + ".staging")
        backup_bundle = target_bundle.with_name(target_bundle.name + ".backup")
        for stale in (staging_bundle, backup_bundle):
            if stale.exists():
                shutil.rmtree(stale, ignore_errors=True)
        try:
            target_bundle.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(
                source_bundle,
                staging_bundle,
                ignore=shutil.ignore_patterns(
                    "unins*.exe",
                    "unins*.dat",
                    "unins*.msg",
                    "unins*.tmp",
                    "*.log",
                ),
            )
            if target_bundle.exists():
                target_bundle.replace(backup_bundle)
            staging_bundle.replace(target_bundle)
            shutil.rmtree(backup_bundle, ignore_errors=True)
            access_ok, access_message = self._harden_service_storage()
            if not access_ok:
                return False, access_message
            if store is not None:
                sync_ok, sync_message = self.sync_service_store(store)
                if not sync_ok:
                    return False, sync_message
            return True, str(self.shared_service_path())
        except OSError as exc:
            shutil.rmtree(staging_bundle, ignore_errors=True)
            if backup_bundle.exists() and not target_bundle.exists():
                try:
                    backup_bundle.replace(target_bundle)
                except OSError:
                    pass
            return False, f"Không thể đồng bộ bundle dịch vụ dùng chung: {exc}"

    def sync_service_store(self, store: ConfigStore) -> tuple[bool, str]:
        access_ok, access_message = self._harden_service_storage(bundle_only=False)
        if not access_ok:
            return False, access_message
        try:
            target = store.sync_to_shared_root()
        except OSError as exc:
            return False, f"KhÃ´ng thá»ƒ Ä‘á»“ng bá»™ service-data: {exc}"
        return True, str(target)

        shared_root = ConfigStore.shared_root_path()
        try:
            shared_root.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            return False, f"Không thể tạo thư mục dùng chung cho service: {exc}"

        try:
            result = run_hidden(
                [
                    "icacls.exe",
                    str(shared_root),
                    "/grant",
                    "*S-1-5-32-545:(OI)(CI)M",
                    "/T",
                    "/C",
                ],
                capture_output=True,
                text=True,
                timeout=45,
                check=False,
            )
        except OSError as exc:
            return False, f"Không thể cấp quyền cho kho service dùng chung: {exc}"

        output = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
        if result.returncode != 0:
            return False, output or "Không thể cấp quyền ghi cho thư mục dùng chung của service."
        return True, output or "Đã cấp quyền cho thư mục dùng chung của service."

    def _harden_service_storage(self, *, bundle_only: bool = False) -> tuple[bool, str]:
        bundle_ok, bundle_message = self._lock_down_directory(self.shared_bundle_dir())
        if not bundle_ok:
            return False, bundle_message
        if bundle_only:
            return True, bundle_message
        data_ok, data_message = self._lock_down_directory(self.shared_data_dir())
        if not data_ok:
            return False, data_message
        return True, data_message

    def _lock_down_directory(self, target: Path) -> tuple[bool, str]:
        try:
            target.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            return False, f"KhÃ´ng thá»ƒ táº¡o thÆ° má»¥c báº£o vá»‡ cho service: {exc}"

        try:
            result = run_hidden(
                [
                    "icacls.exe",
                    str(target),
                    "/inheritance:r",
                    "/grant:r",
                    "*S-1-5-18:(OI)(CI)F",
                    "*S-1-5-32-544:(OI)(CI)F",
                    "/T",
                    "/C",
                ],
                capture_output=True,
                text=True,
                timeout=45,
                check=False,
            )
        except OSError as exc:
            return False, f"KhÃ´ng thá»ƒ siáº¿t ACL cho service storage: {exc}"

        output = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
        if result.returncode != 0:
            return False, output or "KhÃ´ng thá»ƒ siáº¿t ACL cho service storage."
        return True, output or f"ÄÃ£ siáº¿t ACL an toÃ n cho {target}."

    def _query_status_with_sc(self) -> tuple[bool, str]:
        try:
            result = run_hidden(
                ["sc.exe", "query", SERVICE_NAME],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
        except OSError as exc:
            return False, str(exc)

        output = ((result.stdout or "") + "\n" + (result.stderr or "")).strip().lower()
        if "1060" in output or "does not exist as an installed service" in output:
            return False, "Dịch vụ chưa được cài."
        if "running" in output:
            return True, "Dịch vụ đang chạy."
        if "start pending" in output:
            return False, "Dịch vụ đang khởi động."
        if "stop pending" in output:
            return False, "Dịch vụ đang dừng."
        if "stopped" in output:
            return False, "Dịch vụ đang tắt."
        if result.returncode == 0:
            return False, "Dịch vụ đang tắt hoặc chưa sẵn sàng."
        return False, (
            result.stderr or result.stdout or "Không truy vấn được service."
        ).strip()

    @staticmethod
    def _normalize_service_image_path(raw_value: str) -> str:
        value = raw_value.strip()
        if not value:
            return ""
        if value.startswith('"'):
            closing = value.find('"', 1)
            if closing > 1:
                value = value[1:closing]
        else:
            value = value.split(" ", 1)[0]
        if value.startswith("\\\\?\\"):
            value = value[4:]
        try:
            return str(Path(value).resolve())
        except OSError:
            return value
