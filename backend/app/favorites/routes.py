from __future__ import annotations

from fastapi import APIRouter

from app.favorites.api.favorite import router as favorite_router

router = APIRouter(tags=["Favorites"])

router.include_router(favorite_router)
