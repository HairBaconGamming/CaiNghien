from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any


WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
WEEKDAY_LABELS = {
    "mon": "Thu 2",
    "tue": "Thu 3",
    "wed": "Thu 4",
    "thu": "Thu 5",
    "fri": "Thu 6",
    "sat": "Thu 7",
    "sun": "Chu nhat",
}

DEFAULT_BLOCKED_DOMAINS = [
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "threads.net",
    "reddit.com",
    "discord.com",
    "web.whatsapp.com",
    "youtube.com",
]

DEFAULT_ALLOWED_DOMAINS = [
    "gemini.google.com",
]

DEFAULT_UPDATE_MANIFEST_URL = (
    "https://cainghien-focus-guard-site.onrender.com/data/update-manifest.json"
)


def normalize_domain(value: str) -> str:
    cleaned = value.strip().lower()
    cleaned = cleaned.removeprefix("https://").removeprefix("http://")
    if "/" in cleaned:
        cleaned = cleaned.split("/", 1)[0]
    return cleaned.strip()


def dedupe_domains(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in values:
        normalized = normalize_domain(item)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def weekday_key_for_date(value: date) -> str:
    return WEEKDAY_KEYS[value.weekday()]


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@dataclass(slots=True)
class PasswordRecord:
    salt: str
    digest: str
    iterations: int = 200_000
    algorithm: str = "sha256"

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> PasswordRecord | None:
        if not raw:
            return None
        if not raw.get("salt") or not raw.get("digest"):
            return None
        return cls(
            salt=str(raw["salt"]),
            digest=str(raw["digest"]),
            iterations=int(raw.get("iterations", 200_000)),
            algorithm=str(raw.get("algorithm", "sha256")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "salt": self.salt,
            "digest": self.digest,
            "iterations": self.iterations,
            "algorithm": self.algorithm,
        }


@dataclass(slots=True)
class DaySchedule:
    enabled: bool = True
    start: str = "17:00"
    end: str = "20:00"

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> DaySchedule:
        raw = raw or {}
        return cls(
            enabled=bool(raw.get("enabled", True)),
            start=str(raw.get("start", "17:00")),
            end=str(raw.get("end", "20:00")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "start": self.start,
            "end": self.end,
        }

    @property
    def start_time(self) -> time:
        return _parse_time(self.start)

    @property
    def end_time(self) -> time:
        return _parse_time(self.end)

    @property
    def label(self) -> str:
        if not self.enabled:
            return "Tat"
        return f"{self.start} -> {self.end}"

    def occurrence_for(self, day: date) -> ScheduleOccurrence | None:
        if not self.enabled:
            return None
        start_dt = datetime.combine(day, self.start_time)
        end_dt = datetime.combine(day, self.end_time)
        if self.start_time == self.end_time:
            end_dt = start_dt + timedelta(days=1)
        elif end_dt <= start_dt:
            end_dt += timedelta(days=1)
        return ScheduleOccurrence(
            source="weekly",
            start=start_dt,
            end=end_dt,
            day_key=weekday_key_for_date(day),
        )


@dataclass(slots=True)
class ScheduleOccurrence:
    source: str
    start: datetime
    end: datetime
    day_key: str | None = None

    @property
    def label(self) -> str:
        return f"{self.start.strftime('%H:%M')} -> {self.end.strftime('%H:%M')}"

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment < self.end


@dataclass(slots=True)
class PendingConfigChange:
    payload: dict[str, Any]
    apply_at: str
    created_at: str
    reason: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> PendingConfigChange | None:
        if not raw:
            return None
        payload = raw.get("payload")
        apply_at = raw.get("apply_at")
        created_at = raw.get("created_at")
        reason = raw.get("reason")
        if not isinstance(payload, dict) or not apply_at or not created_at:
            return None
        return cls(
            payload=payload,
            apply_at=str(apply_at),
            created_at=str(created_at),
            reason=str(reason or "pending_change"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "payload": self.payload,
            "apply_at": self.apply_at,
            "created_at": self.created_at,
            "reason": self.reason,
        }


@dataclass(slots=True)
class ManualLockState:
    activate_at: str
    end_at: str
    created_at: str
    source: str = "manual_countdown"

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> ManualLockState | None:
        if not raw:
            return None
        activate_at = raw.get("activate_at")
        end_at = raw.get("end_at")
        created_at = raw.get("created_at")
        if not activate_at or not end_at or not created_at:
            return None
        return cls(
            activate_at=str(activate_at),
            end_at=str(end_at),
            created_at=str(created_at),
            source=str(raw.get("source", "manual_countdown")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "activate_at": self.activate_at,
            "end_at": self.end_at,
            "created_at": self.created_at,
            "source": self.source,
        }

    @property
    def activate_dt(self) -> datetime | None:
        return parse_iso_datetime(self.activate_at)

    @property
    def end_dt(self) -> datetime | None:
        return parse_iso_datetime(self.end_at)


@dataclass(slots=True)
class RecoveryRequest:
    purpose: str
    requested_at: str
    available_at: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> RecoveryRequest | None:
        if not raw:
            return None
        purpose = str(raw.get("purpose", "")).strip()
        requested_at = str(raw.get("requested_at", "")).strip()
        available_at = str(raw.get("available_at", "")).strip()
        if not purpose or not requested_at or not available_at:
            return None
        return cls(
            purpose=purpose,
            requested_at=requested_at,
            available_at=available_at,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "purpose": self.purpose,
            "requested_at": self.requested_at,
            "available_at": self.available_at,
        }

    @property
    def requested_dt(self) -> datetime | None:
        return parse_iso_datetime(self.requested_at)

    @property
    def available_dt(self) -> datetime | None:
        return parse_iso_datetime(self.available_at)


@dataclass(slots=True)
class RuntimeState:
    pending_config: PendingConfigChange | None = None
    manual_lock: ManualLockState | None = None
    recovery_request: RecoveryRequest | None = None
    last_warning_key: str | None = None
    service_last_seen: str | None = None
    ui_last_seen: str | None = None
    service_enabled: bool = False
    safe_mode_reason: str | None = None
    last_integrity_issue: str | None = None
    last_counted_minute: str | None = None
    daily_counters: dict[str, dict[str, int]] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> RuntimeState:
        raw = raw or {}
        daily_counters: dict[str, dict[str, int]] = {}
        raw_counters = raw.get("daily_counters")
        if isinstance(raw_counters, dict):
            for key, value in raw_counters.items():
                if not isinstance(value, dict):
                    continue
                daily_counters[str(key)] = {
                    "blocked_minutes": max(0, int(value.get("blocked_minutes", 0))),
                    "schedule_sessions": max(
                        0, int(value.get("schedule_sessions", 0))
                    ),
                    "strict_sessions": max(0, int(value.get("strict_sessions", 0))),
                    "warnings_sent": max(0, int(value.get("warnings_sent", 0))),
                    "failed_unlocks": max(
                        0, int(value.get("failed_unlocks", 0))
                    ),
                    "tamper_events": max(0, int(value.get("tamper_events", 0))),
                    "pending_changes": max(
                        0, int(value.get("pending_changes", 0))
                    ),
                }
        return cls(
            pending_config=PendingConfigChange.from_dict(raw.get("pending_config")),
            manual_lock=ManualLockState.from_dict(raw.get("manual_lock")),
            recovery_request=RecoveryRequest.from_dict(raw.get("recovery_request")),
            last_warning_key=str(raw.get("last_warning_key")) if raw.get("last_warning_key") else None,
            service_last_seen=str(raw.get("service_last_seen")) if raw.get("service_last_seen") else None,
            ui_last_seen=str(raw.get("ui_last_seen")) if raw.get("ui_last_seen") else None,
            service_enabled=bool(raw.get("service_enabled", False)),
            safe_mode_reason=str(raw.get("safe_mode_reason")) if raw.get("safe_mode_reason") else None,
            last_integrity_issue=str(raw.get("last_integrity_issue")) if raw.get("last_integrity_issue") else None,
            last_counted_minute=str(raw.get("last_counted_minute")) if raw.get("last_counted_minute") else None,
            daily_counters=daily_counters,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "pending_config": self.pending_config.to_dict() if self.pending_config else None,
            "manual_lock": self.manual_lock.to_dict() if self.manual_lock else None,
            "recovery_request": self.recovery_request.to_dict() if self.recovery_request else None,
            "last_warning_key": self.last_warning_key,
            "service_last_seen": self.service_last_seen,
            "ui_last_seen": self.ui_last_seen,
            "service_enabled": self.service_enabled,
            "safe_mode_reason": self.safe_mode_reason,
            "last_integrity_issue": self.last_integrity_issue,
            "last_counted_minute": self.last_counted_minute,
            "daily_counters": self.daily_counters,
        }

    def day_counter(self, day: date) -> dict[str, int]:
        key = day.isoformat()
        if key not in self.daily_counters:
            self.daily_counters[key] = {
                "blocked_minutes": 0,
                "schedule_sessions": 0,
                "strict_sessions": 0,
                "warnings_sent": 0,
                "failed_unlocks": 0,
                "tamper_events": 0,
                "pending_changes": 0,
            }
        return self.daily_counters[key]

    def bump_counter(self, day: date, field_name: str, amount: int = 1) -> None:
        counter = self.day_counter(day)
        counter[field_name] = max(0, counter.get(field_name, 0) + amount)

    def prune_counters(self, *, keep_days: int = 21, now: date | None = None) -> None:
        today = now or date.today()
        cutoff = today - timedelta(days=max(1, keep_days))
        for key in list(self.daily_counters):
            try:
                day_value = date.fromisoformat(key)
            except ValueError:
                self.daily_counters.pop(key, None)
                continue
            if day_value < cutoff:
                self.daily_counters.pop(key, None)


@dataclass(slots=True)
class WeeklyStats:
    blocked_minutes: int = 0
    schedule_sessions: int = 0
    strict_sessions: int = 0
    warnings_sent: int = 0
    failed_unlocks: int = 0
    tamper_events: int = 0
    pending_changes: int = 0


@dataclass(slots=True)
class AppConfig:
    mode: str = "normal"
    protection_enabled: bool = False
    weekly_schedule: dict[str, DaySchedule] = field(
        default_factory=lambda: {
            key: DaySchedule() for key in WEEKDAY_KEYS
        }
    )
    blocked_domains: list[str] = field(
        default_factory=lambda: DEFAULT_BLOCKED_DOMAINS.copy()
    )
    allowed_domains: list[str] = field(
        default_factory=lambda: DEFAULT_ALLOWED_DOMAINS.copy()
    )
    strict_password: PasswordRecord | None = None
    recovery_key: PasswordRecord | None = None
    recovery_key_created_at: str | None = None
    start_with_windows: bool = False
    warning_minutes: int = 10
    last_minute_guard_minutes: int = 30
    change_delay_enabled: bool = True
    service_enabled: bool = True
    manual_lock_duration_minutes: int = 60
    auto_check_updates: bool = True
    update_manifest_url: str = DEFAULT_UPDATE_MANIFEST_URL

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> AppConfig:
        raw = raw or {}
        legacy_start = str(raw.get("schedule_start", "17:00"))
        legacy_end = str(raw.get("schedule_end", "20:00"))
        weekly_raw = raw.get("weekly_schedule")
        if isinstance(weekly_raw, dict):
            weekly_schedule = {
                key: DaySchedule.from_dict(weekly_raw.get(key))
                for key in WEEKDAY_KEYS
            }
        else:
            weekly_schedule = {
                key: DaySchedule(enabled=True, start=legacy_start, end=legacy_end)
                for key in WEEKDAY_KEYS
            }
        return cls(
            mode="strict" if raw.get("mode") == "strict" else "normal",
            protection_enabled=bool(raw.get("protection_enabled", False)),
            weekly_schedule=weekly_schedule,
            blocked_domains=dedupe_domains(
                list(raw.get("blocked_domains") or DEFAULT_BLOCKED_DOMAINS)
            )
            or DEFAULT_BLOCKED_DOMAINS.copy(),
            allowed_domains=dedupe_domains(
                list(raw.get("allowed_domains") or DEFAULT_ALLOWED_DOMAINS)
            )
            or DEFAULT_ALLOWED_DOMAINS.copy(),
            strict_password=PasswordRecord.from_dict(raw.get("strict_password")),
            recovery_key=PasswordRecord.from_dict(raw.get("recovery_key")),
            recovery_key_created_at=str(raw.get("recovery_key_created_at"))
            if raw.get("recovery_key_created_at")
            else None,
            start_with_windows=bool(raw.get("start_with_windows", False)),
            warning_minutes=max(1, int(raw.get("warning_minutes", 10))),
            last_minute_guard_minutes=max(
                0, int(raw.get("last_minute_guard_minutes", 30))
            ),
            change_delay_enabled=bool(raw.get("change_delay_enabled", True)),
            service_enabled=bool(raw.get("service_enabled", True)),
            manual_lock_duration_minutes=max(
                5, int(raw.get("manual_lock_duration_minutes", 60))
            ),
            auto_check_updates=bool(raw.get("auto_check_updates", True)),
            update_manifest_url=str(
                raw.get("update_manifest_url", DEFAULT_UPDATE_MANIFEST_URL)
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        default_schedule = self.day_schedule("mon")
        return {
            "mode": self.mode,
            "protection_enabled": self.protection_enabled,
            "weekly_schedule": {
                key: schedule.to_dict()
                for key, schedule in self.weekly_schedule.items()
            },
            "schedule_start": default_schedule.start,
            "schedule_end": default_schedule.end,
            "blocked_domains": dedupe_domains(self.blocked_domains),
            "allowed_domains": dedupe_domains(self.allowed_domains),
            "strict_password": self.strict_password.to_dict() if self.strict_password else None,
            "recovery_key": self.recovery_key.to_dict() if self.recovery_key else None,
            "recovery_key_created_at": self.recovery_key_created_at,
            "start_with_windows": self.start_with_windows,
            "warning_minutes": self.warning_minutes,
            "last_minute_guard_minutes": self.last_minute_guard_minutes,
            "change_delay_enabled": self.change_delay_enabled,
            "service_enabled": self.service_enabled,
            "manual_lock_duration_minutes": self.manual_lock_duration_minutes,
            "auto_check_updates": self.auto_check_updates,
            "update_manifest_url": self.update_manifest_url,
        }

    @property
    def has_password(self) -> bool:
        return self.strict_password is not None

    @property
    def has_recovery_key(self) -> bool:
        return self.recovery_key is not None

    def day_schedule(self, key: str) -> DaySchedule:
        return self.weekly_schedule.get(key, DaySchedule())

    def schedule_window(self, day: date | datetime | str | None = None) -> DaySchedule:
        if day is None:
            key = weekday_key_for_date(datetime.now().date())
        elif isinstance(day, datetime):
            key = weekday_key_for_date(day.date())
        elif isinstance(day, date):
            key = weekday_key_for_date(day)
        else:
            key = day
        return self.day_schedule(key)

    def active_schedule_occurrence(self, now: datetime) -> ScheduleOccurrence | None:
        for delta_days in (-1, 0):
            target_day = now.date() + timedelta(days=delta_days)
            occurrence = self.day_schedule(weekday_key_for_date(target_day)).occurrence_for(
                target_day
            )
            if occurrence and occurrence.contains(now):
                return occurrence
        return None

    def next_schedule_occurrence(self, now: datetime, *, days: int = 8) -> ScheduleOccurrence | None:
        for offset in range(days):
            target_day = now.date() + timedelta(days=offset)
            occurrence = self.day_schedule(weekday_key_for_date(target_day)).occurrence_for(
                target_day
            )
            if occurrence and occurrence.start > now:
                return occurrence
        return None

    def in_last_minute_guard(self, now: datetime) -> tuple[bool, ScheduleOccurrence | None]:
        if not self.change_delay_enabled or self.last_minute_guard_minutes <= 0:
            return False, None
        next_occurrence = self.next_schedule_occurrence(now)
        if not next_occurrence:
            return False, None
        if next_occurrence.start - now <= timedelta(minutes=self.last_minute_guard_minutes):
            return True, next_occurrence
        return False, None


def _parse_time(value: str) -> time:
    hour_text, minute_text = value.split(":", 1)
    return time(hour=int(hour_text), minute=int(minute_text))
