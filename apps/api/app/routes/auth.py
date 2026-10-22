"""First-run setup, login, recovery, two-factor and account endpoints."""

from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..accounts import find_user_by_email, normalize_email, set_recovery_code
from ..auth import (
    audit,
    clear_session_cookie,
    create_session,
    require_csrf,
    require_user,
    set_session_cookie,
)
from ..config import settings
from ..crypto import encrypt_secret
from ..database import get_db
from ..mailer import send_password_reset_code
from ..models import AuthSession, LoginChallenge, PasswordReset, User, utcnow
from ..rate_limit import RateLimiter
from ..security import (
    hash_password,
    hash_token,
    new_token,
    normalize_recovery_code,
    verify_password,
)
from ..twofa import (
    backup_codes_remaining,
    generate_backup_codes,
    new_totp_secret,
    provisioning_uri,
    qr_data_url,
    set_backup_codes,
    verify_second_factor,
    verify_totp,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["auth"])

_limiter = RateLimiter(
    max_attempts=settings.auth_max_attempts,
    window_seconds=settings.auth_window_minutes * 60,
)


class SetupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class TwoFactorLoginRequest(BaseModel):
    challenge_token: str = Field(min_length=20, max_length=200)
    code: str = Field(min_length=6, max_length=20)


class RecoverRequest(BaseModel):
    email: EmailStr
    recovery_code: str = Field(min_length=4, max_length=30)
    new_password: str = Field(min_length=10, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)
    new_password: str = Field(min_length=10, max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=200)


class ChangeEmailRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_email: EmailStr


class RecoveryCodeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)


class TwoFactorEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=20)


class TwoFactorDisableRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=6, max_length=20)


def _client_key(request: Request, prefix: str, suffix: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"{prefix}:{ip}:{suffix}"


def _user_response(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "created_at": user.created_at.isoformat(),
    }


def _require_current_password(user: User, password: str) -> None:
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha atual incorreta.",
        )


def _ensure_new_password(current: str, new: str) -> None:
    if current and new == current:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha precisa ser diferente da senha atual.",
        )


def _clear_two_factor(user: User) -> None:
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_backup_codes = None


def _new_email_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _delete_expired_challenges(db: Session, user_id: str) -> None:
    db.execute(
        delete(LoginChallenge).where(
            LoginChallenge.user_id == user_id,
            LoginChallenge.expires_at <= utcnow(),
        )
    )


@router.get("/setup/status")
def setup_status(db: Session = Depends(get_db)) -> dict[str, bool]:
    total = db.scalar(select(func.count()).select_from(User)) or 0
    return {"needs_setup": total == 0}


@router.get("/auth/recovery-methods")
def recovery_methods() -> dict[str, bool]:
    return {
        "email": settings.smtp_configured,
        "recovery_code": True,
        "admin_cli": True,
    }


@router.post("/setup", status_code=status.HTTP_201_CREATED)
def setup(
    body: SetupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    total = db.scalar(select(func.count()).select_from(User)) or 0
    if total > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta instalação já tem um dono. Use o login.",
        )

    email = normalize_email(str(body.email))
    user = User(email=email, password_hash=hash_password(body.password))
    recovery_code = set_recovery_code(user)
    db.add(user)
    db.commit()
    db.refresh(user)

    auth_session, token = create_session(db, user, request)
    audit(db, "setup.owner_created", user.id, request)
    set_session_cookie(response, token)
    return {
        "user": _user_response(user),
        "csrf_token": auth_session.csrf_token,
        "recovery_code": recovery_code,
        "email_recovery": settings.smtp_configured,
    }


@router.post("/auth/login")
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    email = normalize_email(str(body.email))
    limit_key = _client_key(request, "login", email)
    if not _limiter.allow(limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Tente novamente em alguns minutos.",
        )

    user = find_user_by_email(db, email)
    if not user or not verify_password(body.password, user.password_hash):
        _limiter.hit(limit_key)
        audit(db, "auth.login_failed", user.id if user else None, request, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
        )

    _limiter.reset(limit_key)

    if user.totp_enabled:
        _delete_expired_challenges(db, user.id)
        challenge_token = new_token()
        db.add(
            LoginChallenge(
                user_id=user.id,
                token_hash=hash_token(challenge_token),
                expires_at=utcnow() + timedelta(minutes=5),
            )
        )
        db.commit()
        audit(db, "auth.login_pending_2fa", user.id, request)
        return {"requires_2fa": True, "challenge_token": challenge_token}

    auth_session, token = create_session(db, user, request)
    set_session_cookie(response, token)
    return {"user": _user_response(user), "csrf_token": auth_session.csrf_token}


@router.post("/auth/login/2fa")
def login_2fa(
    body: TwoFactorLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    challenge = db.scalar(
        select(LoginChallenge).where(
            LoginChallenge.token_hash == hash_token(body.challenge_token)
        )
    )
    if not challenge or challenge.expires_at <= utcnow():
        if challenge:
            db.delete(challenge)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Desafio expirado. Entre novamente.",
        )

    user = db.get(User, challenge.user_id)
    if not user or not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação em dois fatores indisponível.",
        )

    limit_key = _client_key(request, "2fa", user.id)
    if not _limiter.allow(limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Tente novamente em alguns minutos.",
        )

    if not verify_second_factor(user, body.code):
        _limiter.hit(limit_key)
        db.commit()
        audit(db, "auth.login_2fa_failed", user.id, request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido ou expirado.",
        )

    _limiter.reset(limit_key)
    db.delete(challenge)
    db.commit()

    auth_session, token = create_session(db, user, request)
    audit(db, "auth.login_2fa", user.id, request)
    set_session_cookie(response, token)
    return {"user": _user_response(user), "csrf_token": auth_session.csrf_token}


@router.post("/auth/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    if not settings.smtp_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recuperação por e-mail não configurada. Use o código de recuperação ou o comando no servidor.",
        )

    email = normalize_email(str(body.email))
    limit_key = _client_key(request, "forgot", email)
    if not _limiter.allow(limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitos pedidos. Tente novamente em alguns minutos.",
        )
    _limiter.hit(limit_key)

    user = find_user_by_email(db, email)
    if not user:
        return {"ok": True}

    code = _new_email_code()
    db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
    db.add(
        PasswordReset(
            user_id=user.id,
            code_hash=hash_password(code),
            expires_at=utcnow() + timedelta(minutes=15),
        )
    )
    db.commit()

    try:
        send_password_reset_code(user.email, code)
    except Exception as exc:  # noqa: BLE001 - mail is best-effort
        logger.warning("Falha ao enviar e-mail de recuperação: %s", exc)

    audit(db, "auth.password_reset_requested", user.id, request)
    return {"ok": True}


@router.post("/auth/reset-password")
def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if not settings.smtp_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recuperação por e-mail não configurada. Use o código de recuperação ou o comando no servidor.",
        )

    email = normalize_email(str(body.email))
    limit_key = _client_key(request, "reset", email)
    if not _limiter.allow(limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Tente novamente em alguns minutos.",
        )

    user = find_user_by_email(db, email)
    if not user:
        _limiter.hit(limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido ou expirado.",
        )

    reset = db.scalar(
        select(PasswordReset)
        .where(
            PasswordReset.user_id == user.id,
            PasswordReset.used_at.is_(None),
        )
        .order_by(PasswordReset.created_at.desc())
    )
    if not reset or reset.expires_at <= utcnow():
        _limiter.hit(limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido ou expirado.",
        )

    if reset.attempts >= 5:
        reset.used_at = utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Peça um novo código.",
        )

    reset.attempts += 1
    if not verify_password(body.code.strip(), reset.code_hash):
        db.commit()
        _limiter.hit(limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido ou expirado.",
        )

    _limiter.reset(limit_key)
    reset.used_at = utcnow()
    user.password_hash = hash_password(body.new_password)
    recovery_code = set_recovery_code(user)
    _clear_two_factor(user)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()

    auth_session, token = create_session(db, user, request)
    audit(db, "auth.password_reset", user.id, request)
    set_session_cookie(response, token)
    return {
        "user": _user_response(user),
        "csrf_token": auth_session.csrf_token,
        "recovery_code": recovery_code,
    }


@router.post("/auth/recover")
def recover(
    body: RecoverRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    email = normalize_email(str(body.email))
    limit_key = _client_key(request, "recover", email)
    if not _limiter.allow(limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Tente novamente em alguns minutos.",
        )

    user = find_user_by_email(db, email)
    code = normalize_recovery_code(body.recovery_code)
    valid = bool(
        user
        and user.recovery_code_hash
        and code
        and verify_password(code, user.recovery_code_hash)
    )
    if not valid or not user:
        _limiter.hit(limit_key)
        audit(db, "auth.recovery_failed", user.id if user else None, request, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou código de recuperação inválidos.",
        )

    _limiter.reset(limit_key)
    user.password_hash = hash_password(body.new_password)
    new_code = set_recovery_code(user)
    _clear_two_factor(user)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()

    auth_session, token = create_session(db, user, request)
    audit(db, "auth.password_recovered", user.id, request)
    set_session_cookie(response, token)
    return {
        "user": _user_response(user),
        "csrf_token": auth_session.csrf_token,
        "recovery_code": new_code,
    }


@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    _require_current_password(user, body.current_password)
    _ensure_new_password(body.current_password, body.new_password)

    current_session: AuthSession = request.state.auth_session
    user.password_hash = hash_password(body.new_password)
    db.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id,
            AuthSession.id != current_session.id,
        )
    )
    db.commit()
    audit(db, "auth.password_changed", user.id, request)
    return {"ok": True}


@router.post("/auth/change-email")
def change_email(
    body: ChangeEmailRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_current_password(user, body.current_password)
    new_email = normalize_email(str(body.new_email))

    existing = find_user_by_email(db, new_email)
    if existing and existing.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está em uso.",
        )

    user.email = new_email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está em uso.",
        ) from None

    audit(db, "auth.email_changed", user.id, request, new_email)
    return {"user": _user_response(user)}


@router.post("/auth/recovery-code")
def rotate_recovery_code(
    body: RecoveryCodeRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    _require_current_password(user, body.current_password)
    code = set_recovery_code(user)
    db.commit()
    audit(db, "auth.recovery_code_rotated", user.id, request)
    return {"recovery_code": code}


@router.get("/auth/2fa/status")
def two_factor_status(
    user: User = Depends(require_user),
) -> dict[str, object]:
    return {
        "enabled": bool(user.totp_enabled),
        "backup_codes_remaining": backup_codes_remaining(user),
    }


@router.post("/auth/2fa/setup")
def two_factor_setup(
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A autenticação em dois fatores já está ativada.",
        )

    secret = new_totp_secret()
    user.totp_secret = encrypt_secret(secret)
    user.totp_enabled = False
    db.commit()
    audit(db, "auth.2fa_setup_started", user.id, request)

    uri = provisioning_uri(user.email, secret)
    return {
        "secret": secret,
        "otpauth_uri": uri,
        "qr_data_url": qr_data_url(uri),
    }


@router.post("/auth/2fa/enable")
def two_factor_enable(
    body: TwoFactorEnableRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A autenticação em dois fatores já está ativada.",
        )
    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gere o QR code antes de ativar.",
        )
    if not verify_totp(user, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido. Confira o app autenticador.",
        )

    codes = generate_backup_codes()
    user.totp_enabled = True
    set_backup_codes(user, codes)
    db.commit()
    audit(db, "auth.2fa_enabled", user.id, request)
    return {"backup_codes": codes}


@router.post("/auth/2fa/disable")
def two_factor_disable(
    body: TwoFactorDisableRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    _require_current_password(user, body.current_password)
    if user.totp_enabled and not verify_second_factor(user, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido.",
        )

    _clear_two_factor(user)
    db.commit()
    audit(db, "auth.2fa_disabled", user.id, request)
    return {"ok": True}


@router.post("/auth/logout")
def logout(
    request: Request,
    response: Response,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    auth_session: AuthSession | None = getattr(request.state, "auth_session", None)
    if auth_session:
        db.delete(auth_session)
        db.commit()
    audit(db, "auth.logout", user.id, request)
    clear_session_cookie(response)
    return {"ok": True}


@router.post("/auth/logout-all")
def logout_all(
    request: Request,
    response: Response,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    audit(db, "auth.logout_all", user.id, request)
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/auth/me")
def me(
    request: Request,
    user: User = Depends(require_user),
) -> dict[str, object]:
    auth_session: AuthSession = request.state.auth_session
    return {
        "user": _user_response(user),
        "csrf_token": auth_session.csrf_token,
        "has_recovery_code": bool(user.recovery_code_hash),
        "two_factor_enabled": bool(user.totp_enabled),
    }


@router.get("/auth/session")
def session_info(
    request: Request,
    user: User = Depends(require_user),
) -> dict[str, object]:
    auth_session: AuthSession = request.state.auth_session
    return {
        "user": _user_response(user),
        "csrf_token": auth_session.csrf_token,
        "has_recovery_code": bool(user.recovery_code_hash),
        "two_factor_enabled": bool(user.totp_enabled),
        "expires_at": auth_session.expires_at.isoformat(),
        "expires_in_seconds": max(
            0,
            int((auth_session.expires_at - utcnow()).total_seconds()),
        ),
        "session_ttl": settings.session_ttl_hours * 3600,
    }
