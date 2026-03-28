from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from ..models import AppConfig, PendingConfigChange, RuntimeState, dedupe_domains


@dataclass(slots=True)
class ProtectionWindow:
    source: str
    start: datetime
    end: datetime
    label: str
    strict: bool

    @property
    def warning_key(self) -> str:
        return f"{self.source}:{self.start.isoformat()}"


def blocked_domains_for_config(config: AppConfig) -> list[str]:
    allowed = set(dedupe_domains(config.allowed_domains))
    return [
        domain
        for domain in dedupe_domains(config.blocked_domains)
        if domain not in allowed
    ]


def resolve_active_window(
    config: AppConfig,
    state: RuntimeState,
    now: datetime,
) -> ProtectionWindow | None:
    manual = state.manual_lock
    if manual:
        activate_at = manual.activate_dt
        end_at = manual.end_dt
        if activate_at and end_at and activate_at <= now < end_at:
            return ProtectionWindow(
                source="manual_lock",
                start=activate_at,
                end=end_at,
                label=f"Manual lock den {end_at.strftime('%H:%M')}",
                strict=True,
            )

    if not config.protection_enabled:
        return None

    occurrence = config.active_schedule_occurrence(now)
    if occurrence is None:
        return None
    return ProtectionWindow(
        source="weekly_schedule",
        start=occurrence.start,
        end=occurrence.end,
        label=occurrence.label,
        strict=config.mode == "strict",
    )


def resolve_pending_manual_countdown(
    state: RuntimeState,
    now: datetime,
) -> tuple[datetime, datetime] | None:
    manual = state.manual_lock
    if manual is None:
        return None
    activate_at = manual.activate_dt
    end_at = manual.end_dt
    if activate_at is None or end_at is None:
        return None
    if now < activate_at:
        return activate_at, end_at
    return None


def resolve_next_window(
    config: AppConfig,
    state: RuntimeState,
    now: datetime,
) -> ProtectionWindow | None:
    manual_countdown = resolve_pending_manual_countdown(state, now)
    if manual_countdown is not None:
        activate_at, end_at = manual_countdown
        return ProtectionWindow(
            source="manual_countdown",
            start=activate_at,
            end=end_at,
            label=f"Manual lock tu {activate_at.strftime('%H:%M')}",
            strict=True,
        )

    occurrence = config.next_schedule_occurrence(now)
    if occurrence is None:
        return None
    return ProtectionWindow(
        source="weekly_schedule",
        start=occurrence.start,
        end=occurrence.end,
        label=occurrence.label,
        strict=config.mode == "strict",
    )


def pending_change_due(
    state: RuntimeState,
    now: datetime,
) -> PendingConfigChange | None:
    pending = state.pending_config
    if pending is None:
        return None
    try:
        apply_at = datetime.fromisoformat(pending.apply_at)
    except ValueError:
        return pending
    if now >= apply_at:
        return pending
    return None


def delay_target_for_change(
    config: AppConfig,
    state: RuntimeState,
    now: datetime,
) -> ProtectionWindow | None:
    active_window = resolve_active_window(config, state, now)
    if active_window is not None:
        return active_window

    in_guard, next_occurrence = config.in_last_minute_guard(now)
    if not in_guard or next_occurrence is None:
        return None
    return ProtectionWindow(
        source="guard_window",
        start=next_occurrence.start,
        end=next_occurrence.end,
        label=next_occurrence.label,
        strict=config.mode == "strict",
    )


def should_warn_before_lock(
    config: AppConfig,
    state: RuntimeState,
    now: datetime,
) -> ProtectionWindow | None:
    if config.warning_minutes <= 0:
        return None
    if resolve_active_window(config, state, now) is not None:
        return None
    next_window = resolve_next_window(config, state, now)
    if next_window is None:
        return None
    if next_window.start <= now:
        return None
    if next_window.start - now > timedelta(minutes=config.warning_minutes):
        return None
    return next_window


def is_service_stale(
    state: RuntimeState,
    now: datetime,
    *,
    max_age_seconds: int = 150,
) -> bool:
    if not state.service_last_seen:
        return True
    try:
        last_seen = datetime.fromisoformat(state.service_last_seen)
    except ValueError:
        return True
    return now - last_seen > timedelta(seconds=max_age_seconds)


def sanitize_runtime_state(state: RuntimeState, now: datetime) -> tuple[RuntimeState, list[str]]:
    messages: list[str] = []
    changed = False

    if state.manual_lock:
        activate_at = state.manual_lock.activate_dt
        end_at = state.manual_lock.end_dt
        if activate_at is None or end_at is None or end_at <= activate_at:
            state.manual_lock = None
            changed = True
            messages.append("Manual lock khong hop le da duoc go bo an toan.")
        elif now >= end_at:
            state.manual_lock = None
            changed = True
            messages.append("Manual lock da het han.")

    if state.pending_config:
        try:
            apply_at = datetime.fromisoformat(state.pending_config.apply_at)
        except ValueError:
            state.pending_config = None
            changed = True
            messages.append("Pending config bi hong va da duoc xoa.")
        else:
            if apply_at < now - timedelta(days=14):
                state.pending_config = None
                changed = True
                messages.append("Pending config qua cu da duoc xoa.")

    if state.recovery_request:
        requested_at = state.recovery_request.requested_dt
        available_at = state.recovery_request.available_dt
        if requested_at is None or available_at is None or available_at <= requested_at:
            state.recovery_request = None
            changed = True
            messages.append("Yeu cau recovery khong hop le da duoc xoa.")
        elif available_at < now - timedelta(days=30):
            state.recovery_request = None
            changed = True
            messages.append("Yeu cau recovery qua han da duoc xoa.")

    if changed:
        state.last_integrity_issue = messages[-1]
    state.prune_counters(now=now.date())
    return state, messages
