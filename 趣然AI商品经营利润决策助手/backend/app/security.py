from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.models import UserSession, utc_now

SESSION_COOKIE = "quran_session"
CSRF_COOKIE = "quran_csrf"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def random_token() -> str:
    return secrets.token_urlsafe(32)


@dataclass(frozen=True)
class Actor:
    actor_ref: str
    actor_name: str
    role: str
    csrf_token: str


def create_user_session(
    db: Session, settings: Settings, actor_ref: str, actor_name: str, role: str
) -> tuple[str, str]:
    token = random_token()
    csrf = random_token()
    db.add(
        UserSession(
            token_hash=digest(token),
            csrf_hash=digest(csrf),
            actor_ref=actor_ref,
            actor_name=actor_name,
            role=role,
            expires_at=utc_now() + timedelta(seconds=settings.session_ttl_seconds),
        )
    )
    db.commit()
    return token, csrf


def optional_actor(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    csrf_token: str | None = Cookie(default=None, alias=CSRF_COOKIE),
    db: Session = Depends(get_db),
) -> Actor | None:
    if not session_token or not csrf_token:
        return None
    user_session = db.scalar(
        select(UserSession).where(UserSession.token_hash == digest(session_token))
    )
    if (
        user_session is None
        or user_session.revoked_at is not None
        or user_session.expires_at <= utc_now()
        or user_session.csrf_hash != digest(csrf_token)
    ):
        return None
    return Actor(
        actor_ref=user_session.actor_ref,
        actor_name=user_session.actor_name,
        role=user_session.role,
        csrf_token=csrf_token,
    )


def require_actor(actor: Actor | None = Depends(optional_actor)) -> Actor:
    if actor is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_REQUIRED", "message": "登录状态已失效，请重新使用钉钉登录。"},
        )
    return actor


def require_roles(*roles: str) -> Callable[..., Actor]:
    def dependency(actor: Actor = Depends(require_actor)) -> Actor:
        if actor.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ACCESS_DENIED", "message": "当前账号无权访问此内容。"},
            )
        return actor

    return dependency


def verify_csrf(
    actor: Actor = Depends(require_actor),
    header_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> Actor:
    if not header_token or not secrets.compare_digest(header_token, actor.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CSRF_REJECTED", "message": "请求校验失败，请刷新后重试。"},
        )
    return actor
