from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import (
    check_rate_limit,
    clear_failures,
    create_tokens,
    decode_token,
    get_current_user,
    record_failure,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str


def user_out(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "display_name": u.display_name,
        "age": u.age,
        "preferred_language": u.preferred_language,
        "easy_mode": u.easy_mode,
    }


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, body.username)
    user = db.scalar(select(User).where(User.username == body.username.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        record_failure(request, body.username)
        raise HTTPException(401, "That username or password is not right. Please check and try again.")
    clear_failures(request, body.username)
    return {**create_tokens(user), "user": user_out(user)}


@router.post("/refresh")
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token, "refresh")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "Account not found.")
    return {**create_tokens(user), "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)
