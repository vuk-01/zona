from __future__ import annotations

from fastapi import APIRouter

from app.users.api.user import router as user_router

router = APIRouter(tags=["Users"])

router.include_router(user_router)
