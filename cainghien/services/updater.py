from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from PySide6 import QtCore

from ..config import ConfigStore


def _version_key(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for raw_part in version.split("."):
        digits = "".join(ch for ch in raw_part if ch.isdigit())
        parts.append(int(digits or "0"))
    return tuple(parts)


@dataclass(slots=True)
class UpdateInfo:
    version: str
    installer_url: str
    published_at: str
    notes: list[str]
    sha256: str | None = None
    size_bytes: int | None = None

    @classmethod
    def from_manifest(cls, manifest_url: str, raw: dict[str, Any]) -> UpdateInfo | None:
        latest = raw.get("latest")
        if not isinstance(latest, dict):
            return None
        version = str(latest.get("version", "")).strip()
        installer = str(latest.get("installer", "")).strip()
        if not version or not installer:
            return None
        return cls(
            version=version,
            installer_url=urljoin(manifest_url, installer),
            published_at=str(latest.get("published_at", "")).strip(),
            notes=[str(item) for item in latest.get("notes", []) if str(item).strip()],
            sha256=str(latest.get("sha256")).strip() if latest.get("sha256") else None,
            size_bytes=int(latest.get("size_bytes")) if latest.get("size_bytes") else None,
        )

    def is_newer_than(self, current_version: str) -> bool:
        return _version_key(self.version) > _version_key(current_version)


class UpdateManager(QtCore.QObject):
    check_completed = QtCore.Signal(object, str, bool)
    download_completed = QtCore.Signal(str, object, str)
    cleanup_completed = QtCore.Signal(str)

    def __init__(self, store: ConfigStore) -> None:
        super().__init__()
        self._store = store

    def check_for_updates(
        self,
        current_version: str,
        manifest_url: str,
        *,
        silent: bool,
    ) -> None:
        thread = threading.Thread(
            target=self._check_worker,
            args=(current_version, manifest_url, silent),
            daemon=True,
        )
        thread.start()

    def download_update(self, update: UpdateInfo) -> None:
        thread = threading.Thread(
            target=self._download_worker,
            args=(update,),
            daemon=True,
        )
        thread.start()

    def cleanup_cached_versions(self, *, keep_latest: int = 3) -> str:
        candidates = sorted(
            self._store.updates_dir.glob("*.exe"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        removed = 0
        for path in candidates[keep_latest:]:
            try:
                path.unlink()
                removed += 1
            except OSError:
                continue
        message = f"Đã dọn {removed} bản cập nhật cũ trong cache."
        self.cleanup_completed.emit(message)
        return message

    def _check_worker(self, current_version: str, manifest_url: str, silent: bool) -> None:
        try:
            request = Request(
                manifest_url,
                headers={"User-Agent": f"CaiNghienFocusGuard/{current_version}"},
            )
            with urlopen(request, timeout=15) as response:
                raw = json.loads(response.read().decode("utf-8"))
            update = UpdateInfo.from_manifest(manifest_url, raw)
            if update is None:
                self.check_completed.emit(None, "Manifest cập nhật không hợp lệ.", silent)
                return
            if update.is_newer_than(current_version):
                self.check_completed.emit(update, "", silent)
                return
            self.check_completed.emit(None, "", silent)
        except Exception as exc:
            self.check_completed.emit(None, str(exc), silent)

    def _download_worker(self, update: UpdateInfo) -> None:
        target_path = self._store.updates_dir / f"CaiNghienFocusGuard-Setup-{update.version}.exe"
        try:
            request = Request(
                update.installer_url,
                headers={"User-Agent": f"CaiNghienFocusGuard-Updater/{update.version}"},
            )
            with urlopen(request, timeout=60) as response:
                payload = response.read()
            if update.sha256:
                digest = hashlib.sha256(payload).hexdigest()
                if digest.lower() != update.sha256.lower():
                    self.download_completed.emit(
                        "",
                        update,
                        "Checksum bản cập nhật không khớp. Đã hủy để tránh lỗi.",
                    )
                    return
            target_path.write_bytes(payload)
            self.cleanup_cached_versions()
            self.download_completed.emit(str(target_path), update, "")
        except Exception as exc:
            self.download_completed.emit("", update, str(exc))
