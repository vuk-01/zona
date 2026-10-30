from __future__ import annotations

from fastapi import APIRouter

from app.bookings.api.booking import router as booking_router

router = APIRouter(tags=["Bookings"])

router.include_router(booking_router)
