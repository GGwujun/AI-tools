from __future__ import annotations

import asyncio
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import delete, select, update

from app.config import AUTH_CODE_EXPIRE_MINUTES, AUTH_DEV_MODE, AUTH_SESSION_EXPIRE_DAYS
from app.infrastructure.db.session import session_scope
from app.db_models import AuthSession, AuthUser, AuthVerificationCode
from app.models.auth import (
    AuthUserProfile,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    MeResponse,
    SendCodeRequest,
    SendCodeResponse,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])

MOBILE_RE = re.compile(r"^1\d{10}$")


def _validate_mobile(mobile: str) -> str:
    normalized = mobile.strip()
    if not MOBILE_RE.match(normalized):
        raise HTTPException(status_code=400, detail="invalid_mobile")
    return normalized


def _build_user_profile(user: AuthUser) -> AuthUserProfile:
    return AuthUserProfile(
        id=user.id,
        mobile=user.mobile,
        nickname=user.nickname,
        avatar=user.avatar,
        mobile_bound=user.mobile_bound,
        level=user.level,
    )


def _get_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="missing_authorization")
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="invalid_authorization")
    token = authorization[len(prefix) :].strip()
    if not token:
        raise HTTPException(status_code=401, detail="invalid_authorization")
    return token


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(payload: SendCodeRequest):
    mobile = _validate_mobile(payload.mobile)
    if AUTH_DEV_MODE:
        code = "123456"
    else:
        code = secrets.token_hex(3).upper()[:6]  # 6-digit random code
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=AUTH_CODE_EXPIRE_MINUTES)

    await asyncio.to_thread(_send_code_db, mobile, code, expires_at)

    return SendCodeResponse(
        success=True,
        message="验证码已发送" + ("，开发环境请使用 123456" if AUTH_DEV_MODE else ""),
        expires_in_seconds=AUTH_CODE_EXPIRE_MINUTES * 60,
        debug_code=code,
    )


def _send_code_db(mobile: str, code: str, expires_at: datetime) -> None:
    """同步写入验证码到数据库（在子线程中执行）。"""
    with session_scope() as session:
        session.execute(
            update(AuthVerificationCode)
            .where(AuthVerificationCode.mobile == mobile, AuthVerificationCode.consumed.is_(False))
            .values(consumed=True)
        )
        session.add(
            AuthVerificationCode(
                mobile=mobile,
                code=code,
                purpose="login",
                expires_at=expires_at,
            )
        )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    mobile = _validate_mobile(payload.mobile)
    code = payload.code.strip()
    now = datetime.now(timezone.utc)

    result = await asyncio.to_thread(_login_db, mobile, code, now)
    if result is None:
        raise HTTPException(status_code=400, detail="invalid_code")
    return result


def _login_db(mobile: str, code: str, now: datetime) -> LoginResponse | None:
    """同步登录逻辑（在子线程中执行）。返回 None 表示验证码无效。"""
    with session_scope() as session:
        code_record = session.execute(
            select(AuthVerificationCode)
            .where(
                AuthVerificationCode.mobile == mobile,
                AuthVerificationCode.code == code,
                AuthVerificationCode.consumed.is_(False),
                AuthVerificationCode.expires_at >= now,
            )
            .order_by(AuthVerificationCode.id.desc())
        ).scalar_one_or_none()
        if code_record is None:
            return None

        code_record.consumed = True

        user = session.execute(select(AuthUser).where(AuthUser.mobile == mobile)).scalar_one_or_none()
        if user is None:
            user = AuthUser(
                mobile=mobile,
                nickname=f"用户{mobile[-4:]}",
                mobile_bound=True,
                level="已注册用户",
            )
            session.add(user)
            session.flush()

        token = secrets.token_urlsafe(32)
        session.add(
            AuthSession(
                user_id=user.id,
                token=token,
                expires_at=now + timedelta(days=AUTH_SESSION_EXPIRE_DAYS),
            )
        )
        session.flush()

        return LoginResponse(success=True, token=token, user=_build_user_profile(user))


@router.get("/me", response_model=MeResponse)
async def me(authorization: str | None = Header(default=None)):
    token = _get_bearer_token(authorization)
    now = datetime.now(timezone.utc)

    result = await asyncio.to_thread(_me_db, token, now)
    if result is None:
        raise HTTPException(status_code=401, detail="session_expired")
    return result


def _me_db(token: str, now: datetime) -> MeResponse | None:
    """同步查询用户信息（在子线程中执行）。返回 None 表示 session 无效。"""
    with session_scope() as session:
        auth_session = session.execute(
            select(AuthSession).where(AuthSession.token == token, AuthSession.expires_at >= now)
        ).scalar_one_or_none()
        if auth_session is None:
            return None

        user = session.execute(select(AuthUser).where(AuthUser.id == auth_session.user_id)).scalar_one_or_none()
        if user is None:
            return None

        return MeResponse(success=True, user=_build_user_profile(user))


@router.post("/logout", response_model=LogoutResponse)
async def logout(authorization: str | None = Header(default=None)):
    token = _get_bearer_token(authorization)

    await asyncio.to_thread(_logout_db, token)

    return LogoutResponse(success=True, message="logged_out")


def _logout_db(token: str) -> None:
    """同步删除 session（在子线程中执行）。"""
    with session_scope() as session:
        session.execute(delete(AuthSession).where(AuthSession.token == token))
