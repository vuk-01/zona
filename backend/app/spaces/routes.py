from __future__ import annotations

from fastapi import APIRouter

from app.spaces.api.space import router as space_router

router = APIRouter(tags=["Spaces"])

router.include_router(space_router)
