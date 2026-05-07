from __future__ import annotations

from pydantic import BaseModel


class SendCodeRequest(BaseModel):
    mobile: str


class SendCodeResponse(BaseModel):
    success: bool
    message: str
    expires_in_seconds: int
    debug_code: str | None = None


class LoginRequest(BaseModel):
    mobile: str
    code: str


class AuthUserProfile(BaseModel):
    id: int
    mobile: str
    nickname: str
    avatar: str | None = None
    mobile_bound: bool = True
    level: str = "已注册用户"


class LoginResponse(BaseModel):
    success: bool
    token: str
    user: AuthUserProfile


class MeResponse(BaseModel):
    success: bool
    user: AuthUserProfile


class LogoutResponse(BaseModel):
    success: bool
    message: str
