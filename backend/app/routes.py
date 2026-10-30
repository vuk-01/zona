from __future__ import annotations

from fastapi import APIRouter

from app.auth.routes import router as auth_router
from app.bookings.routes import router as bookings_router
from app.favorites.routes import router as favorites_router
from app.listings.routes import router as listings_router
from app.spaces.routes import router as spaces_router
from app.users.routes import router as users_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(listings_router)
api_router.include_router(spaces_router)
api_router.include_router(favorites_router)
api_router.include_router(bookings_router)
