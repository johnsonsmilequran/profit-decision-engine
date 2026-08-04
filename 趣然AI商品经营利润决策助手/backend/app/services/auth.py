from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import OAuthState, RoleMapping, utc_now
from app.security import digest, random_token

VALID_ROLES = {"operator", "supervisor", "procurement"}


def create_authorization_url(db: Session, settings: Settings) -> str:
    if not settings.dingtalk_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "DINGTALK_UNAVAILABLE",
                "message": "钉钉登录尚未完成部署配置，请联系 IT。",
            },
        )
    raw_state = random_token()
    db.add(
        OAuthState(
            state_hash=digest(raw_state),
            expires_at=utc_now() + timedelta(seconds=settings.auth_state_ttl_seconds),
        )
    )
    db.commit()
    query = urlencode(
        {
            "redirect_uri": f"{str(settings.public_base_url).rstrip('/')}/api/auth/callback",
            "response_type": "code",
            "client_id": settings.dingtalk_client_id,
            "scope": "openid",
            "state": raw_state,
            "prompt": "consent",
        }
    )
    return f"{settings.dingtalk_authorize_url}?{query}"


def consume_state(db: Session, raw_state: str) -> None:
    oauth_state = db.scalar(select(OAuthState).where(OAuthState.state_hash == digest(raw_state)))
    if (
        oauth_state is None
        or oauth_state.used_at is not None
        or oauth_state.expires_at <= utc_now()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CALLBACK", "message": "登录未完成，请重新使用钉钉登录。"},
        )
    oauth_state.used_at = utc_now()
    db.flush()


def exchange_code(settings: Settings, code: str) -> tuple[str, str]:
    try:
        with httpx.Client(timeout=8.0) as client:
            token_response = client.post(
                str(settings.dingtalk_token_url),
                json={
                    "clientId": settings.dingtalk_client_id,
                    "clientSecret": settings.dingtalk_client_secret,
                    "code": code,
                    "grantType": "authorization_code",
                },
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("accessToken")
            if not isinstance(access_token, str) or not access_token:
                raise ValueError("钉钉令牌响应不完整")
            user_response = client.get(
                str(settings.dingtalk_user_url),
                headers={"x-acs-dingtalk-access-token": access_token},
            )
            user_response.raise_for_status()
            payload = user_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "DINGTALK_FAILED", "message": "暂时无法完成钉钉登录，请重新尝试。"},
        ) from exc
    actor_ref = payload.get("unionId") or payload.get("openId")
    actor_name = payload.get("nick") or payload.get("name")
    if not isinstance(actor_ref, str) or not actor_ref or not isinstance(actor_name, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "DINGTALK_IDENTITY_INVALID", "message": "暂时无法确认登录身份。"},
        )
    return actor_ref, actor_name


def resolve_role(db: Session, actor_ref: str) -> RoleMapping:
    mappings = db.scalars(
        select(RoleMapping).where(
            RoleMapping.actor_ref == actor_ref,
            RoleMapping.active.is_(True),
            RoleMapping.role.in_(VALID_ROLES),
        )
    ).all()
    if len(mappings) != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ROLE_MAPPING_INVALID",
                "message": "未配置唯一有效业务角色，请联系 IT。",
            },
        )
    return mappings[0]
