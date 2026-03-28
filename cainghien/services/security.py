from __future__ import annotations

import base64
import hashlib
import os

from ..models import PasswordRecord


MIN_PASSWORD_LENGTH = 4


def validate_password(password: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Mat khau can it nhat {MIN_PASSWORD_LENGTH} ky tu."
    return None


def hash_password(password: str, *, iterations: int = 200_000) -> PasswordRecord:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return PasswordRecord(
        salt=base64.b64encode(salt).decode("ascii"),
        digest=base64.b64encode(digest).decode("ascii"),
        iterations=iterations,
        algorithm="sha256",
    )


def verify_password(password: str, record: PasswordRecord | None) -> bool:
    if record is None:
        return False
    salt = base64.b64decode(record.salt.encode("ascii"))
    digest = hashlib.pbkdf2_hmac(
        record.algorithm,
        password.encode("utf-8"),
        salt,
        record.iterations,
    )
    return base64.b64encode(digest).decode("ascii") == record.digest

