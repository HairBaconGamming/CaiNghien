from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any


WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
WEEKDAY_LABELS = {
    "mon": "Thứ 2",
    "tue": "Thứ 3",
    "wed": "Thứ 4",
    "thu": "Thứ 5",
    "fri": "Thứ 6",
    "sat": "Thứ 7",
    "sun": "Chủ nhật",
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

DEFAULT_STUDY_RESOURCE_URLS = [
    "https://gemini.google.com",
    "https://scholar.google.com",
    "https://classroom.google.com",
]

DEFAULT_STUDY_EXTRA_BLOCKED_DOMAINS = [
    "messenger.com",
    "twitch.tv",
    "netflix.com",
]

DEFAULT_STUDY_BLOCKED_APPS = [
    "discord.exe",
    "telegram.exe",
    "steam.exe",
    "spotify.exe",
]

DEFAULT_STUDY_ALLOWED_APPS = [
    r"C:\Windows\System32\notepad.exe",
]

DEFAULT_STUDY_WARNING_OFFSETS = [10, 2]

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


def normalize_process_name(value: str) -> str:
    return value.strip().lower()


def dedupe_processes(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in values:
        normalized = normalize_process_name(item)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def dedupe_text_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in values:
        cleaned = str(item).strip()
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(cleaned)
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


def default_daily_counter() -> dict[str, int]:
    return {
        "blocked_minutes": 0,
        "schedule_sessions": 0,
        "strict_sessions": 0,
        "warnings_sent": 0,
        "failed_unlocks": 0,
        "tamper_events": 0,
        "pending_changes": 0,
        "study_sessions_completed": 0,
        "study_sessions_aborted": 0,
        "study_minutes": 0,
        "study_site_blocks": 0,
        "study_app_blocks": 0,
    }


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
            return "Tắt"
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
class StudyProfile:
    id: str
    name: str
    default_duration_minutes: int = 50
    study_domains: list[str] = field(default_factory=lambda: DEFAULT_ALLOWED_DOMAINS.copy())
    resource_urls: list[str] = field(default_factory=lambda: DEFAULT_STUDY_RESOURCE_URLS.copy())
    allowed_apps: list[str] = field(default_factory=lambda: DEFAULT_STUDY_ALLOWED_APPS.copy())
    blocked_processes: list[str] = field(default_factory=lambda: DEFAULT_STUDY_BLOCKED_APPS.copy())
    extra_blocked_domains: list[str] = field(default_factory=lambda: DEFAULT_STUDY_EXTRA_BLOCKED_DOMAINS.copy())

    @classmethod
    def from_dict(
        cls,
        raw: dict[str, Any] | None,
        *,
        fallback_id: str = "study-default",
    ) -> StudyProfile:
        raw = raw or {}
        return cls(
            id=str(raw.get("id") or fallback_id).strip() or fallback_id,
            name=str(raw.get("name") or "Phiên học sâu").strip() or "Phiên học sâu",
            default_duration_minutes=max(15, int(raw.get("default_duration_minutes", 50))),
            study_domains=dedupe_domains(list(raw.get("study_domains") or DEFAULT_ALLOWED_DOMAINS)),
            resource_urls=dedupe_text_values(list(raw.get("resource_urls") or DEFAULT_STUDY_RESOURCE_URLS)),
            allowed_apps=dedupe_text_values(list(raw.get("allowed_apps") or DEFAULT_STUDY_ALLOWED_APPS)),
            blocked_processes=dedupe_processes(list(raw.get("blocked_processes") or DEFAULT_STUDY_BLOCKED_APPS)),
            extra_blocked_domains=dedupe_domains(
                list(raw.get("extra_blocked_domains") or DEFAULT_STUDY_EXTRA_BLOCKED_DOMAINS)
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "default_duration_minutes": self.default_duration_minutes,
            "study_domains": dedupe_domains(self.study_domains),
            "resource_urls": dedupe_text_values(self.resource_urls),
            "allowed_apps": dedupe_text_values(self.allowed_apps),
            "blocked_processes": dedupe_processes(self.blocked_processes),
            "extra_blocked_domains": dedupe_domains(self.extra_blocked_domains),
        }


def default_study_profile() -> StudyProfile:
    return StudyProfile(id="study-default", name="Phiên học sâu")


def default_study_profiles() -> list[StudyProfile]:
    return [default_study_profile()]


@dataclass(slots=True)
class StudyDaySchedule:
    enabled: bool = False
    start: str = "19:00"
    end: str = "20:30"
    profile_id: str = "study-default"

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> StudyDaySchedule:
        raw = raw or {}
        return cls(
            enabled=bool(raw.get("enabled", False)),
            start=str(raw.get("start", "19:00")),
            end=str(raw.get("end", "20:30")),
            profile_id=str(raw.get("profile_id") or "study-default"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "start": self.start,
            "end": self.end,
            "profile_id": self.profile_id,
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
            return "Tắt"
        return f"{self.start} -> {self.end}"

    def occurrence_for(
        self,
        day: date,
        *,
        profile_name: str = "",
    ) -> StudyScheduleOccurrence | None:
        if not self.enabled:
            return None
        start_dt = datetime.combine(day, self.start_time)
        end_dt = datetime.combine(day, self.end_time)
        if self.start_time == self.end_time:
            end_dt = start_dt + timedelta(days=1)
        elif end_dt <= start_dt:
            end_dt += timedelta(days=1)
        return StudyScheduleOccurrence(
            source="study_schedule",
            start=start_dt,
            end=end_dt,
            profile_id=self.profile_id,
            profile_name=profile_name,
            day_key=weekday_key_for_date(day),
        )


def default_study_schedule() -> dict[str, StudyDaySchedule]:
    return {key: StudyDaySchedule(profile_id="study-default") for key in WEEKDAY_KEYS}


@dataclass(slots=True)
class StudyScheduleOccurrence:
    source: str
    start: datetime
    end: datetime
    profile_id: str
    profile_name: str
    day_key: str | None = None

    @property
    def label(self) -> str:
        return f"{self.start.strftime('%H:%M')} -> {self.end.strftime('%H:%M')}"

    @property
    def title(self) -> str:
        return self.profile_name or self.profile_id

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment < self.end

    def warning_key(self, offset_minutes: int) -> str:
        return f"study:{self.profile_id}:{self.start.isoformat()}:{offset_minutes}"


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
class StudySessionState:
    session_id: str
    profile_id: str
    profile_name: str
    source: str
    started_at: str
    target_end_at: str
    duration_minutes: int
    resource_urls: list[str] = field(default_factory=list)
    allowed_apps: list[str] = field(default_factory=list)
    blocked_processes: list[str] = field(default_factory=list)
    blocked_domains: list[str] = field(default_factory=list)
    schedule_day_key: str | None = None
    schedule_start_at: str | None = None
    schedule_end_at: str | None = None
    abort_reason: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> StudySessionState | None:
        if not raw:
            return None
        session_id = str(raw.get("session_id", "")).strip()
        profile_id = str(raw.get("profile_id", "")).strip()
        profile_name = str(raw.get("profile_name", "")).strip()
        started_at = str(raw.get("started_at", "")).strip()
        target_end_at = str(raw.get("target_end_at", "")).strip()
        source = str(raw.get("source", "")).strip() or "manual"
        if not session_id or not profile_id or not started_at or not target_end_at:
            return None
        return cls(
            session_id=session_id,
            profile_id=profile_id,
            profile_name=profile_name or profile_id,
            source=source,
            started_at=started_at,
            target_end_at=target_end_at,
            duration_minutes=max(1, int(raw.get("duration_minutes", 50))),
            resource_urls=dedupe_text_values(list(raw.get("resource_urls") or [])),
            allowed_apps=dedupe_text_values(list(raw.get("allowed_apps") or [])),
            blocked_processes=dedupe_processes(list(raw.get("blocked_processes") or [])),
            blocked_domains=dedupe_domains(list(raw.get("blocked_domains") or [])),
            schedule_day_key=str(raw.get("schedule_day_key")) if raw.get("schedule_day_key") else None,
            schedule_start_at=str(raw.get("schedule_start_at")) if raw.get("schedule_start_at") else None,
            schedule_end_at=str(raw.get("schedule_end_at")) if raw.get("schedule_end_at") else None,
            abort_reason=str(raw.get("abort_reason")) if raw.get("abort_reason") else None,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "profile_id": self.profile_id,
            "profile_name": self.profile_name,
            "source": self.source,
            "started_at": self.started_at,
            "target_end_at": self.target_end_at,
            "duration_minutes": self.duration_minutes,
            "resource_urls": dedupe_text_values(self.resource_urls),
            "allowed_apps": dedupe_text_values(self.allowed_apps),
            "blocked_processes": dedupe_processes(self.blocked_processes),
            "blocked_domains": dedupe_domains(self.blocked_domains),
            "schedule_day_key": self.schedule_day_key,
            "schedule_start_at": self.schedule_start_at,
            "schedule_end_at": self.schedule_end_at,
            "abort_reason": self.abort_reason,
        }

    @property
    def started_dt(self) -> datetime | None:
        return parse_iso_datetime(self.started_at)

    @property
    def target_end_dt(self) -> datetime | None:
        return parse_iso_datetime(self.target_end_at)

    @property
    def schedule_start_dt(self) -> datetime | None:
        return parse_iso_datetime(self.schedule_start_at)

    @property
    def schedule_end_dt(self) -> datetime | None:
        return parse_iso_datetime(self.schedule_end_at)


@dataclass(slots=True)
class RuntimeState:
    pending_config: PendingConfigChange | None = None
    manual_lock: ManualLockState | None = None
    recovery_request: RecoveryRequest | None = None
    study_session: StudySessionState | None = None
    last_warning_key: str | None = None
    last_study_warning_key: str | None = None
    last_study_conflict_key: str | None = None
    service_last_seen: str | None = None
    ui_last_seen: str | None = None
    service_enabled: bool = False
    safe_mode_reason: str | None = None
    last_integrity_issue: str | None = None
    last_counted_minute: str | None = None
    last_study_counted_minute: str | None = None
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
                counter = default_daily_counter()
                for field_name in counter:
                    counter[field_name] = max(0, int(value.get(field_name, 0)))
                daily_counters[str(key)] = counter
        return cls(
            pending_config=PendingConfigChange.from_dict(raw.get("pending_config")),
            manual_lock=ManualLockState.from_dict(raw.get("manual_lock")),
            recovery_request=RecoveryRequest.from_dict(raw.get("recovery_request")),
            study_session=StudySessionState.from_dict(raw.get("study_session")),
            last_warning_key=str(raw.get("last_warning_key")) if raw.get("last_warning_key") else None,
            last_study_warning_key=str(raw.get("last_study_warning_key")) if raw.get("last_study_warning_key") else None,
            last_study_conflict_key=str(raw.get("last_study_conflict_key")) if raw.get("last_study_conflict_key") else None,
            service_last_seen=str(raw.get("service_last_seen")) if raw.get("service_last_seen") else None,
            ui_last_seen=str(raw.get("ui_last_seen")) if raw.get("ui_last_seen") else None,
            service_enabled=bool(raw.get("service_enabled", False)),
            safe_mode_reason=str(raw.get("safe_mode_reason")) if raw.get("safe_mode_reason") else None,
            last_integrity_issue=str(raw.get("last_integrity_issue")) if raw.get("last_integrity_issue") else None,
            last_counted_minute=str(raw.get("last_counted_minute")) if raw.get("last_counted_minute") else None,
            last_study_counted_minute=str(raw.get("last_study_counted_minute")) if raw.get("last_study_counted_minute") else None,
            daily_counters=daily_counters,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "pending_config": self.pending_config.to_dict() if self.pending_config else None,
            "manual_lock": self.manual_lock.to_dict() if self.manual_lock else None,
            "recovery_request": self.recovery_request.to_dict() if self.recovery_request else None,
            "study_session": self.study_session.to_dict() if self.study_session else None,
            "last_warning_key": self.last_warning_key,
            "last_study_warning_key": self.last_study_warning_key,
            "last_study_conflict_key": self.last_study_conflict_key,
            "service_last_seen": self.service_last_seen,
            "ui_last_seen": self.ui_last_seen,
            "service_enabled": self.service_enabled,
            "safe_mode_reason": self.safe_mode_reason,
            "last_integrity_issue": self.last_integrity_issue,
            "last_counted_minute": self.last_counted_minute,
            "last_study_counted_minute": self.last_study_counted_minute,
            "daily_counters": self.daily_counters,
        }

    def day_counter(self, day: date) -> dict[str, int]:
        key = day.isoformat()
        if key not in self.daily_counters:
            self.daily_counters[key] = default_daily_counter()
        return self.daily_counters[key]

    def bump_counter(self, day: date, field_name: str, amount: int = 1) -> None:
        counter = self.day_counter(day)
        counter[field_name] = max(0, counter.get(field_name, 0) + amount)

    def prune_counters(self, *, keep_days: int = 35, now: date | None = None) -> None:
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
    study_sessions_completed: int = 0
    study_sessions_aborted: int = 0
    study_minutes: int = 0
    study_site_blocks: int = 0
    study_app_blocks: int = 0
    current_streak: int = 0
    best_streak: int = 0
    average_study_minutes: int = 0
    profile_distribution: dict[str, int] = field(default_factory=dict)
    top_blocked_domains: list[str] = field(default_factory=list)
    top_blocked_apps: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AppConfig:
    mode: str = "normal"
    protection_enabled: bool = False
    weekly_schedule: dict[str, DaySchedule] = field(
        default_factory=lambda: {key: DaySchedule() for key in WEEKDAY_KEYS}
    )
    blocked_domains: list[str] = field(
        default_factory=lambda: DEFAULT_BLOCKED_DOMAINS.copy()
    )
    allowed_domains: list[str] = field(
        default_factory=lambda: DEFAULT_ALLOWED_DOMAINS.copy()
    )
    study_profiles: list[StudyProfile] = field(default_factory=default_study_profiles)
    study_schedule: dict[str, StudyDaySchedule] = field(default_factory=default_study_schedule)
    study_warning_offsets: list[int] = field(default_factory=lambda: DEFAULT_STUDY_WARNING_OFFSETS.copy())
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

        profiles_raw = raw.get("study_profiles")
        if isinstance(profiles_raw, list) and profiles_raw:
            study_profiles = [
                StudyProfile.from_dict(
                    item if isinstance(item, dict) else None,
                    fallback_id=f"study-{index + 1}",
                )
                for index, item in enumerate(profiles_raw)
            ]
        else:
            study_profiles = default_study_profiles()

        seen_ids: set[str] = set()
        normalized_profiles: list[StudyProfile] = []
        for index, profile in enumerate(study_profiles):
            profile_id = profile.id or f"study-{index + 1}"
            if profile_id in seen_ids:
                profile_id = f"{profile_id}-{index + 1}"
            seen_ids.add(profile_id)
            if profile.id != profile_id:
                profile = StudyProfile.from_dict(
                    {**profile.to_dict(), "id": profile_id},
                    fallback_id=profile_id,
                )
            normalized_profiles.append(profile)
        study_profiles = normalized_profiles or default_study_profiles()
        profile_ids = {profile.id for profile in study_profiles}
        first_profile_id = study_profiles[0].id

        study_schedule_raw = raw.get("study_schedule")
        if isinstance(study_schedule_raw, dict):
            study_schedule = {
                key: StudyDaySchedule.from_dict(study_schedule_raw.get(key))
                for key in WEEKDAY_KEYS
            }
        else:
            study_schedule = default_study_schedule()
        for key in WEEKDAY_KEYS:
            if study_schedule[key].profile_id not in profile_ids:
                study_schedule[key].profile_id = first_profile_id

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
            study_profiles=study_profiles,
            study_schedule=study_schedule,
            study_warning_offsets=_parse_warning_offsets(raw.get("study_warning_offsets")),
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
            "study_profiles": [profile.to_dict() for profile in self.study_profiles],
            "study_schedule": {
                key: schedule.to_dict()
                for key, schedule in self.study_schedule.items()
            },
            "study_warning_offsets": self.study_warning_offsets_sorted,
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

    def creates_continuous_strict_lock(self) -> bool:
        if self.mode != "strict":
            return False
        return all(
            schedule.enabled and schedule.start_time == schedule.end_time
            for schedule in self.weekly_schedule.values()
        )

    @property
    def study_warning_offsets_sorted(self) -> list[int]:
        return _parse_warning_offsets(self.study_warning_offsets)

    def day_schedule(self, key: str) -> DaySchedule:
        return self.weekly_schedule.get(key, DaySchedule())

    def study_day_schedule(self, key: str) -> StudyDaySchedule:
        fallback_profile_id = self.study_profiles[0].id if self.study_profiles else "study-default"
        return self.study_schedule.get(key, StudyDaySchedule(profile_id=fallback_profile_id))

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

    def study_window(self, day: date | datetime | str | None = None) -> StudyDaySchedule:
        if day is None:
            key = weekday_key_for_date(datetime.now().date())
        elif isinstance(day, datetime):
            key = weekday_key_for_date(day.date())
        elif isinstance(day, date):
            key = weekday_key_for_date(day)
        else:
            key = day
        return self.study_day_schedule(key)

    def study_profile(self, profile_id: str | None = None) -> StudyProfile:
        if not self.study_profiles:
            return default_study_profile()
        if profile_id:
            for profile in self.study_profiles:
                if profile.id == profile_id:
                    return profile
        return self.study_profiles[0]

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

    def active_study_occurrence(self, now: datetime) -> StudyScheduleOccurrence | None:
        for delta_days in (-1, 0):
            target_day = now.date() + timedelta(days=delta_days)
            schedule = self.study_day_schedule(weekday_key_for_date(target_day))
            occurrence = schedule.occurrence_for(
                target_day,
                profile_name=self.study_profile(schedule.profile_id).name,
            )
            if occurrence and occurrence.contains(now):
                return occurrence
        return None

    def next_study_occurrence(self, now: datetime, *, days: int = 8) -> StudyScheduleOccurrence | None:
        for offset in range(days):
            target_day = now.date() + timedelta(days=offset)
            schedule = self.study_day_schedule(weekday_key_for_date(target_day))
            occurrence = schedule.occurrence_for(
                target_day,
                profile_name=self.study_profile(schedule.profile_id).name,
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


def _parse_warning_offsets(value: Any) -> list[int]:
    raw_values = value if isinstance(value, list) else DEFAULT_STUDY_WARNING_OFFSETS
    cleaned: list[int] = []
    seen: set[int] = set()
    for item in raw_values:
        try:
            minute = int(item)
        except (TypeError, ValueError):
            continue
        if minute <= 0 or minute in seen:
            continue
        seen.add(minute)
        cleaned.append(minute)
    if not cleaned:
        return DEFAULT_STUDY_WARNING_OFFSETS.copy()
    return sorted(cleaned)
