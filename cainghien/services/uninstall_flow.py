from __future__ import annotations

import configparser
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
import winreg

from ..config import ConfigStore


APPROVAL_FILE_NAME = "uninstall-approval.ini"
CLOSE_REQUEST_FILE_NAME = "installer-close-request.flag"
CLOSE_DENIED_FILE_NAME = "installer-close-denied.flag"


def _root_candidates(store: ConfigStore) -> list[Path]:
    roots: list[Path] = []
    seen: set[str] = set()
    for root in (
        store.root_dir,
        ConfigStore.user_root_path(),
        ConfigStore.shared_root_path(),
    ):
        key = str(root).lower()
        if key in seen:
            continue
        seen.add(key)
        roots.append(root)
    return roots


def approval_file_paths(store: ConfigStore) -> list[Path]:
    return [root / APPROVAL_FILE_NAME for root in _root_candidates(store)]


def close_request_file_paths(store: ConfigStore) -> list[Path]:
    return [root / CLOSE_REQUEST_FILE_NAME for root in _root_candidates(store)]


def close_denied_file_paths(store: ConfigStore) -> list[Path]:
    return [root / CLOSE_DENIED_FILE_NAME for root in _root_candidates(store)]


def approval_file_path(store: ConfigStore) -> Path:
    return approval_file_paths(store)[0]


def close_request_file_path(store: ConfigStore) -> Path:
    return close_request_file_paths(store)[0]


def close_denied_file_path(store: ConfigStore) -> Path:
    return close_denied_file_paths(store)[0]


def write_uninstall_approval(
    store: ConfigStore,
    *,
    purge_data: bool,
    expires_in_minutes: int = 10,
) -> Path:
    config = configparser.ConfigParser()
    expires_at = datetime.now() + timedelta(minutes=max(1, expires_in_minutes))
    config["approval"] = {
        "expires_at": expires_at.isoformat(timespec="seconds"),
        "expires_unix": str(int(expires_at.timestamp())),
        "expires_stamp": expires_at.strftime("%Y%m%d%H%M%S"),
        "purge_data": "1" if purge_data else "0",
    }
    primary_target = approval_file_path(store)
    for target in approval_file_paths(store):
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("w", encoding="utf-8") as handle:
                config.write(handle)
        except OSError:
            continue
    return primary_target


def clear_uninstall_approval(store: ConfigStore) -> None:
    for target in approval_file_paths(store):
        try:
            target.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


def write_close_request(store: ConfigStore, *, source: str = "installer") -> Path:
    primary_target = close_request_file_path(store)
    for target in close_request_file_paths(store):
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(source, encoding="utf-8")
        except OSError:
            continue
    return primary_target


def clear_close_request(store: ConfigStore) -> None:
    for target in close_request_file_paths(store):
        try:
            target.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


def write_close_denied(store: ConfigStore, *, reason: str) -> Path:
    primary_target = close_denied_file_path(store)
    for target in close_denied_file_paths(store):
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(reason, encoding="utf-8")
        except OSError:
            continue
    return primary_target


def clear_close_denied(store: ConfigStore) -> None:
    for target in close_denied_file_paths(store):
        try:
            target.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


def _registry_uninstaller_candidates() -> list[Path]:
    paths: list[Path] = []
    uninstall_roots = (
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    )
    for hive, root in uninstall_roots:
        try:
            with winreg.OpenKey(hive, root) as uninstall_key:
                count = winreg.QueryInfoKey(uninstall_key)[0]
                for index in range(count):
                    subkey_name = winreg.EnumKey(uninstall_key, index)
                    try:
                        with winreg.OpenKey(uninstall_key, subkey_name) as entry:
                            display_name = str(winreg.QueryValueEx(entry, "DisplayName")[0])
                            if "CaiNghien Focus Guard" not in display_name:
                                continue
                            uninstall_string = str(winreg.QueryValueEx(entry, "UninstallString")[0])
                    except (FileNotFoundError, OSError):
                        continue
                    candidate = uninstall_string.strip()
                    if candidate.startswith('"'):
                        closing = candidate.find('"', 1)
                        if closing > 1:
                            candidate = candidate[1:closing]
                    else:
                        candidate = candidate.split(" ", 1)[0]
                    if candidate:
                        paths.append(Path(candidate))
        except OSError:
            continue
    return paths


def find_uninstaller() -> Path | None:
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        app_dir = Path(sys.executable).resolve().parent
        candidates.extend(sorted(app_dir.glob("unins*.exe")))
    else:
        candidates.extend(sorted(Path.cwd().glob("unins*.exe")))
    candidates.extend(_registry_uninstaller_candidates())
    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate).lower()
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists():
            return candidate
    return None


def launch_uninstaller(path: Path) -> tuple[bool, str]:
    try:
        subprocess.Popen([str(path)])
    except OSError as exc:
        return False, str(exc)
    return True, "Đã mở bộ gỡ cài đặt."
