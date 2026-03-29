from __future__ import annotations

import json
import os
import shutil
import subprocess
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from .models import AppConfig, RuntimeState, WeeklyStats
from .windows_subprocess import run_hidden


APP_FOLDER_NAME = "CaiNghienFocusGuard"
LEGACY_FOLDER_NAME = "CaiNghien"
SCHEMA_VERSION = 2
EVENT_LOG_LIMIT_BYTES = 2 * 1024 * 1024
SERVICE_NAME = "CaiNghienFocusGuardService"
SHARED_MODE_MARKER_NAME = "service-mode.json"


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


class ConfigStore:
    def __init__(self, root_dir: Path | None = None) -> None:
        self._user_root = self.user_root_path()
        self._shared_root = self.shared_root_path()
        self._set_root(root_dir or self._resolve_root_dir())

    @classmethod
    def user_root_path(cls) -> Path:
        return Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / APP_FOLDER_NAME

    @classmethod
    def shared_root_path(cls) -> Path:
        return Path(os.getenv("PROGRAMDATA", r"C:\ProgramData")) / APP_FOLDER_NAME

    @classmethod
    def shared_mode_marker_path(cls) -> Path:
        return cls.shared_root_path() / SHARED_MODE_MARKER_NAME

    @classmethod
    def mark_shared_mode(cls) -> None:
        marker = cls.shared_mode_marker_path()
        marker.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "enabled": True,
            "saved_at": now_iso(),
            "schema": SCHEMA_VERSION,
        }
        marker.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @classmethod
    def clear_shared_mode(cls) -> None:
        try:
            cls.shared_mode_marker_path().unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass

    @property
    def shared_mode(self) -> bool:
        return self.root_dir == self._shared_root

    def load(self) -> AppConfig:
        payload = self._load_payload(
            self.config_path,
            self.config_backup_path,
            AppConfig().to_dict(),
        )
        return AppConfig.from_dict(payload)

    def save(self, config: AppConfig) -> None:
        payload = config.to_dict()
        self._write_payload(self.config_path, self.config_backup_path, payload)

    def load_state(self) -> RuntimeState:
        payload = self._load_payload(
            self.state_path,
            self.state_backup_path,
            RuntimeState().to_dict(),
        )
        state = RuntimeState.from_dict(payload)
        state.prune_counters()
        return state

    def save_state(self, state: RuntimeState) -> None:
        state.prune_counters()
        self._write_payload(self.state_path, self.state_backup_path, state.to_dict())

    def append_event(
        self,
        kind: str,
        message: str,
        *,
        level: str = "info",
        meta: dict[str, Any] | None = None,
        at: datetime | None = None,
    ) -> None:
        self._ensure_root()
        if self.events_path.exists() and self.events_path.stat().st_size >= EVENT_LOG_LIMIT_BYTES:
            try:
                if self.events_backup_path.exists():
                    self.events_backup_path.unlink()
                self.events_path.replace(self.events_backup_path)
            except OSError:
                pass

        record = {
            "at": (at or datetime.now()).isoformat(timespec="seconds"),
            "kind": kind,
            "level": level,
            "message": message,
            "meta": meta or {},
        }
        with self.events_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    def recent_events(self, *, limit: int = 200) -> list[dict[str, Any]]:
        records = self._iter_all_events()
        return records[-limit:]

    def weekly_stats(
        self,
        state: RuntimeState,
        *,
        now: datetime | None = None,
    ) -> WeeklyStats:
        today = (now or datetime.now()).date()
        stats = WeeklyStats()
        for delta in range(7):
            key = (today - timedelta(days=delta)).isoformat()
            counter = state.daily_counters.get(key, {})
            stats.blocked_minutes += int(counter.get("blocked_minutes", 0))
            stats.schedule_sessions += int(counter.get("schedule_sessions", 0))
            stats.strict_sessions += int(counter.get("strict_sessions", 0))
            stats.warnings_sent += int(counter.get("warnings_sent", 0))
            stats.failed_unlocks += int(counter.get("failed_unlocks", 0))
            stats.tamper_events += int(counter.get("tamper_events", 0))
            stats.pending_changes += int(counter.get("pending_changes", 0))
            stats.study_sessions_completed += int(counter.get("study_sessions_completed", 0))
            stats.study_sessions_aborted += int(counter.get("study_sessions_aborted", 0))
            stats.study_minutes += int(counter.get("study_minutes", 0))
            stats.study_site_blocks += int(counter.get("study_site_blocks", 0))
            stats.study_app_blocks += int(counter.get("study_app_blocks", 0))
        stats.current_streak = self._current_study_streak(state, today)
        stats.best_streak = self._best_study_streak(state)
        stats.average_study_minutes = (
            stats.study_minutes // stats.study_sessions_completed
            if stats.study_sessions_completed > 0
            else 0
        )
        profile_distribution, top_domains, top_apps = self._recent_study_breakdown(
            now=now or datetime.now()
        )
        stats.profile_distribution = profile_distribution
        stats.top_blocked_domains = top_domains
        stats.top_blocked_apps = top_apps
        return stats

    def record_counter(
        self,
        field_name: str,
        *,
        amount: int = 1,
        when: date | datetime | None = None,
    ) -> RuntimeState:
        state = self.load_state()
        target_day = when.date() if isinstance(when, datetime) else when or date.today()
        state.bump_counter(target_day, field_name, amount)
        self.save_state(state)
        return state

    def path_summary(self) -> dict[str, str]:
        return {
            "root": str(self.root_dir),
            "user_root": str(self._user_root),
            "shared_root": str(self._shared_root),
            "shared_mode": "Có" if self.shared_mode else "Không",
            "config": str(self.config_path),
            "state": str(self.state_path),
            "events": str(self.events_path),
            "updates": str(self.updates_dir),
            "cleanup_backups": str(self.cleanup_backups_dir),
        }

    def integrity_snapshot(self) -> dict[str, dict[str, str]]:
        config_status, config_detail = self._payload_health(self.config_path)
        state_status, state_detail = self._payload_health(self.state_path)
        config_backup_status, config_backup_detail = self._payload_health(self.config_backup_path)
        state_backup_status, state_backup_detail = self._payload_health(self.state_backup_path)
        events_status = "ok"
        events_detail = "Nhật ký sự kiện đang sẵn sàng."
        if not self.events_path.exists() and not self.events_backup_path.exists():
            events_status = "missing"
            events_detail = "Chưa có file nhật ký."
        return {
            "config": {"status": config_status, "detail": config_detail},
            "state": {"status": state_status, "detail": state_detail},
            "config_backup": {"status": config_backup_status, "detail": config_backup_detail},
            "state_backup": {"status": state_backup_status, "detail": state_backup_detail},
            "events": {"status": events_status, "detail": events_detail},
        }

    def create_cleanup_backup(self) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        target = self.cleanup_backups_dir / timestamp
        target.mkdir(parents=True, exist_ok=True)

        for path in (
            self.config_path,
            self.config_backup_path,
            self.state_path,
            self.state_backup_path,
            self.events_path,
            self.events_backup_path,
        ):
            if not path.exists():
                continue
            try:
                shutil.copy2(path, target / path.name)
            except OSError:
                continue

        if self.updates_dir.exists():
            updates_target = target / "updates"
            updates_target.mkdir(parents=True, exist_ok=True)
            for item in self.updates_dir.iterdir():
                destination = updates_target / item.name
                try:
                    if item.is_dir():
                        shutil.copytree(item, destination, dirs_exist_ok=True)
                    else:
                        shutil.copy2(item, destination)
                except OSError:
                    continue
        return target

    def emergency_reset(self) -> Path:
        backup_dir = self.create_cleanup_backup()
        for path in (
            self.config_path,
            self.config_backup_path,
            self.state_path,
            self.state_backup_path,
            self.events_path,
            self.events_backup_path,
        ):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                pass

        if self.updates_dir.exists():
            for item in self.updates_dir.iterdir():
                try:
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    else:
                        item.unlink()
                except OSError:
                    continue

        self._write_payload(self.config_path, self.config_backup_path, AppConfig().to_dict())
        self._write_payload(self.state_path, self.state_backup_path, RuntimeState().to_dict())
        self.append_event(
            "emergency_cleanup_completed",
            f"Đã dọn dẹp khẩn cấp và tạo lại dữ liệu mặc định. Bản sao lưu nằm ở {backup_dir}.",
        )
        return backup_dir

    def activate_shared_root(self) -> Path:
        target = self._shared_root
        self._copy_store_contents(self.root_dir, target)
        self.mark_shared_mode()
        self._set_root(target)
        return target

    def activate_user_root(self) -> Path:
        target = self._user_root
        if self.root_dir != target:
            self._copy_store_contents(self.root_dir, target)
        self.clear_shared_mode()
        self._set_root(target)
        return target

    def _resolve_root_dir(self) -> Path:
        roaming_candidate = self._user_root
        shared_candidate = self._shared_root
        user_has_data = self._has_store_artifacts(roaming_candidate)
        shared_has_data = self._has_store_artifacts(shared_candidate)
        service_registered = self._service_is_registered()

        if self.shared_mode_marker_path().exists() or service_registered:
            if user_has_data and not shared_has_data:
                self._copy_store_contents(roaming_candidate, shared_candidate)
            shared_candidate.mkdir(parents=True, exist_ok=True)
            self.mark_shared_mode()
            return shared_candidate
        if user_has_data:
            roaming_candidate.mkdir(parents=True, exist_ok=True)
            return roaming_candidate
        if shared_has_data:
            self._copy_store_contents(shared_candidate, roaming_candidate)
            self.clear_shared_mode()
            roaming_candidate.mkdir(parents=True, exist_ok=True)
            return roaming_candidate
        roaming_candidate.mkdir(parents=True, exist_ok=True)
        return roaming_candidate

    def _legacy_config_paths(self) -> list[Path]:
        app_data = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming"))
        program_data = Path(os.getenv("PROGRAMDATA", r"C:\ProgramData"))
        return [
            app_data / LEGACY_FOLDER_NAME / "config.json",
            app_data / APP_FOLDER_NAME / "config.json",
            program_data / LEGACY_FOLDER_NAME / "config.json",
            program_data / APP_FOLDER_NAME / "config.json",
        ]

    def _ensure_root(self) -> None:
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.updates_dir.mkdir(parents=True, exist_ok=True)
        self.cleanup_backups_dir.mkdir(parents=True, exist_ok=True)

    def _set_root(self, root_dir: Path) -> None:
        self.root_dir = root_dir
        self.config_path = self.root_dir / "config.json"
        self.config_backup_path = self.root_dir / "config.backup.json"
        self.state_path = self.root_dir / "state.json"
        self.state_backup_path = self.root_dir / "state.backup.json"
        self.events_path = self.root_dir / "events.jsonl"
        self.events_backup_path = self.root_dir / "events.previous.jsonl"
        self.updates_dir = self.root_dir / "updates"
        self.cleanup_backups_dir = self.root_dir / "cleanup-backups"
        self.legacy_config_paths = self._legacy_config_paths()
        self._ensure_root()

    def _load_payload(
        self,
        path: Path,
        backup_path: Path,
        default_data: dict[str, Any],
    ) -> dict[str, Any]:
        self._migrate_legacy_config_if_needed(path, backup_path)

        payload = self._read_payload(path)
        if payload is not None:
            return payload

        backup_payload = self._read_payload(backup_path)
        if backup_payload is not None:
            self._write_payload(path, backup_path, backup_payload)
            return backup_payload

        self._write_payload(path, backup_path, default_data)
        return default_data

    def _migrate_legacy_config_if_needed(self, path: Path, backup_path: Path) -> None:
        if path.exists():
            return
        if path != self.config_path:
            return
        for legacy_path in self.legacy_config_paths:
            if not legacy_path.exists():
                continue
            raw = self._read_payload(legacy_path)
            if raw is None:
                continue
            self._write_payload(path, backup_path, raw)
            return

    def _read_payload(self, path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        try:
            with path.open("r", encoding="utf-8") as handle:
                raw = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return None

        if isinstance(raw, dict) and "data" in raw and "schema" in raw:
            data = raw.get("data")
            if isinstance(data, dict):
                return data
            return None

        if isinstance(raw, dict):
            return raw
        return None

    def _payload_health(self, path: Path) -> tuple[str, str]:
        if not path.exists():
            return "missing", "Chưa có file."
        payload = self._read_payload(path)
        if payload is None:
            return "invalid", "File tồn tại nhưng không đọc được hoặc đã hỏng."
        return "ok", "Đọc dữ liệu thành công."

    def _write_payload(
        self,
        path: Path,
        backup_path: Path,
        payload: dict[str, Any],
    ) -> None:
        self._ensure_root()
        wrapper = {
            "schema": SCHEMA_VERSION,
            "saved_at": now_iso(),
            "data": payload,
        }
        if path.exists():
            try:
                shutil.copy2(path, backup_path)
            except OSError:
                pass

        temp_path = path.with_suffix(path.suffix + ".tmp")
        with temp_path.open("w", encoding="utf-8") as handle:
            json.dump(wrapper, handle, ensure_ascii=False, indent=2)
        temp_path.replace(path)

    def _events_since(self, since: datetime) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for record in self._iter_all_events():
            try:
                moment = datetime.fromisoformat(str(record.get("at", "")))
            except ValueError:
                continue
            if moment >= since:
                records.append(record)
        return records

    def _current_study_streak(self, state: RuntimeState, today: date) -> int:
        streak = 0
        cursor = today
        while True:
            counter = state.daily_counters.get(cursor.isoformat(), {})
            if int(counter.get("study_sessions_completed", 0)) <= 0:
                break
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    def _best_study_streak(self, state: RuntimeState) -> int:
        days: list[tuple[date, dict[str, int]]] = []
        for key, counter in state.daily_counters.items():
            if not key:
                continue
            try:
                day_value = date.fromisoformat(key)
            except ValueError:
                continue
            days.append((day_value, counter))
        days.sort(key=lambda item: item[0])
        best = 0
        current = 0
        previous: date | None = None
        for day_value, counter in days:
            if int(counter.get("study_sessions_completed", 0)) <= 0:
                current = 0
                previous = day_value
                continue
            if previous is not None and day_value - previous == timedelta(days=1):
                current += 1
            else:
                current = 1
            best = max(best, current)
            previous = day_value
        return best

    def _recent_study_breakdown(
        self,
        *,
        now: datetime,
    ) -> tuple[dict[str, int], list[str], list[str]]:
        since = now - timedelta(days=7)
        profile_counter: Counter[str] = Counter()
        domain_counter: Counter[str] = Counter()
        app_counter: Counter[str] = Counter()
        for record in self._events_since(since):
            kind = str(record.get("kind", ""))
            meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
            if kind in {"study_session_completed", "study_session_aborted"}:
                profile_name = str(meta.get("profile_name", "")).strip()
                if profile_name:
                    profile_counter[profile_name] += 1
            if kind == "study_site_blocked":
                source = str(meta.get("source", "")).strip()
                if source:
                    domain_counter[source] += 1
            if kind == "study_app_blocked":
                source = str(meta.get("source", "")).strip()
                if source:
                    app_counter[source] += 1
        return (
            dict(profile_counter.most_common()),
            [name for name, _ in domain_counter.most_common(3)],
            [name for name, _ in app_counter.most_common(3)],
        )

    def _iter_all_events(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for path in (self.events_backup_path, self.events_path):
            if not path.exists():
                continue
            try:
                with path.open("r", encoding="utf-8", errors="ignore") as handle:
                    for line in handle:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            parsed = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if isinstance(parsed, dict):
                            records.append(parsed)
            except OSError:
                continue
        return records

    def _has_store_artifacts(self, candidate: Path) -> bool:
        return any((candidate / name).exists() for name in ("config.json", "state.json", "events.jsonl"))

    def _copy_store_contents(self, source: Path, target: Path) -> None:
        if source == target:
            target.mkdir(parents=True, exist_ok=True)
            return
        target.mkdir(parents=True, exist_ok=True)
        for name in (
            "config.json",
            "config.backup.json",
            "state.json",
            "state.backup.json",
            "events.jsonl",
            "events.previous.jsonl",
        ):
            source_path = source / name
            if not source_path.exists():
                continue
            try:
                shutil.copy2(source_path, target / name)
            except OSError:
                continue
        source_updates = source / "updates"
        target_updates = target / "updates"
        if source_updates.exists():
            target_updates.mkdir(parents=True, exist_ok=True)
            for item in source_updates.iterdir():
                destination = target_updates / item.name
                try:
                    if item.is_dir():
                        shutil.copytree(item, destination, dirs_exist_ok=True)
                    else:
                        shutil.copy2(item, destination)
                except OSError:
                    continue

    def _service_is_registered(self) -> bool:
        if os.getenv("CAINGHIEN_FORCE_SHARED_STORE") == "1":
            return True
        try:
            result = run_hidden(
                ["sc", "query", SERVICE_NAME],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except OSError:
            return False
        output = ((result.stdout or "") + "\n" + (result.stderr or "")).lower()
        return result.returncode == 0 and "does not exist as an installed service" not in output and "1060" not in output
