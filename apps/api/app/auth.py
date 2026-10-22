"""Session and CSRF helpers shared by the auth routes."""

from __future__ import annotations

import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import AuditLog, AuthSession, User, utcnow
from .security import hash_token, new_csrf_token, new_token

SESSION_COOKIE = "interpres_session"
CSRF_HEADER = "X-CSRF-Token"


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def audit(
    db: Session,
    action: str,
    user_id: str | None = None,
    request: Request | None = None,
    detail: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            detail=detail,
            ip=client_ip(request) if request else None,
        )
    )
    db.commit()


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/")


def create_session(db: Session, user: User, request: Request) -> tuple[AuthSession, str]:
    token = new_token()
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        csrf_token=new_csrf_token(),
        expires_at=utcnow() + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(auth_session)
    db.commit()
    db.refresh(auth_session)
    audit(db, "auth.login", user.id, request)
    return auth_session, token


def get_session_from_request(db: Session, request: Request) -> AuthSession | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    auth_session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    )
    if not auth_session:
        return None
    if auth_session.expires_at <= utcnow():
        db.delete(auth_session)
        db.commit()
        return None
    return auth_session


def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_session = get_session_from_request(db, request)
    if not auth_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada.",
        )
    user = db.get(User, auth_session.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida.",
        )
    request.state.auth_session = auth_session
    return user


def require_csrf(request: Request, user: User = Depends(require_user)) -> User:
    auth_session: AuthSession | None = getattr(request.state, "auth_session", None)
    supplied = request.headers.get(CSRF_HEADER, "")
    if not auth_session or not secrets.compare_digest(supplied, auth_session.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token CSRF inválido.",
        )
    return user
