"""Account operations shared by the HTTP API and the admin CLI."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import AuthSession, User
from .security import (
    hash_password,
    new_recovery_code,
    normalize_recovery_code,
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def set_recovery_code(user: User) -> str:
    code = new_recovery_code()
    user.recovery_code_hash = hash_password(normalize_recovery_code(code))
    return code


def reset_password(
    db: Session,
    email: str,
    new_password: str,
) -> tuple[User | None, str | None]:
    """Reset a password, rotate the recovery code and revoke every session."""
    user = find_user_by_email(db, email)
    if not user:
        return None, None

    user.password_hash = hash_password(new_password)
    code = set_recovery_code(user)
    # A lost authenticator must not lock the owner out after an admin reset.
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_backup_codes = None
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    db.refresh(user)
    return user, code
