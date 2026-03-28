from __future__ import annotations

import configparser
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from ..config import ConfigStore


APPROVAL_FILE_NAME = "uninstall-approval.ini"


def approval_file_path(store: ConfigStore) -> Path:
    return store.root_dir / APPROVAL_FILE_NAME


def write_uninstall_approval(
    store: ConfigStore,
    *,
    purge_data: bool,
    expires_in_minutes: int = 10,
) -> Path:
    target = approval_file_path(store)
    target.parent.mkdir(parents=True, exist_ok=True)
    config = configparser.ConfigParser()
    expires_at = datetime.now() + timedelta(minutes=max(1, expires_in_minutes))
    config["approval"] = {
        "expires_at": expires_at.isoformat(timespec="seconds"),
        "expires_unix": str(int(expires_at.timestamp())),
        "expires_stamp": expires_at.strftime("%Y%m%d%H%M%S"),
        "purge_data": "1" if purge_data else "0",
    }
    with target.open("w", encoding="utf-8") as handle:
        config.write(handle)
    return target


def clear_uninstall_approval(store: ConfigStore) -> None:
    target = approval_file_path(store)
    try:
        target.unlink()
    except FileNotFoundError:
        pass
    except OSError:
        pass


def find_uninstaller() -> Path | None:
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        app_dir = Path(sys.executable).resolve().parent
        candidates.extend(sorted(app_dir.glob("unins*.exe")))
    else:
        candidates.extend(sorted(Path.cwd().glob("unins*.exe")))
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def launch_uninstaller(path: Path) -> tuple[bool, str]:
    try:
        subprocess.Popen([str(path)])
    except OSError as exc:
        return False, str(exc)
    return True, "Da mo bo go cai dat."
