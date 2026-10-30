"""Demo data for development: `poetry run seed`. Idempotent: running it twice changes nothing."""

from __future__ import annotations

import logging

from app.auth.repositories.auth import IAuthRepository
from app.auth.schemas.auth import CurrentUser, LoginRequestSchema, RegisterRequestSchema
from app.auth.services.auth import IAuthService
from app.database.session_handler import db_session_handler
from app.listings.models.listing import ListingCategory
from app.listings.schemas.listing import ListingCreateRequestSchema
from app.listings.services.listing import IListingService
from app.spaces.models.space import SpaceCategory, SpaceStatus
from app.spaces.schemas.space import (
    DayHoursSchema,
    OpeningHoursSchema,
    SpaceCreateRequestSchema,
    SpaceListFilters,
)
from app.spaces.services.space import ISpaceService
from app.utils.di import get_from_di_container
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"

DEMO_LISTINGS = [
    ListingCreateRequestSchema(
        title="PlayStation 5 Slim",
        description="Used for six months, two controllers, original box.",
        price=380,
        category=ListingCategory.CONSOLES,
        city="Podgorica",
    ),
    ListingCreateRequestSchema(
        title="Elden Ring (PS5)",
        description="Disc in perfect condition.",
        price=35,
        category=ListingCategory.GAMES,
        city="Nikšić",
    ),
    ListingCreateRequestSchema(
        title="DualSense controller, white",
        description="Barely used.",
        price=45,
        category=ListingCategory.ACCESSORIES,
        city="Budva",
    ),
]


_NINE_TO_FIVE = DayHoursSchema(open="09:00", close="17:00")
_EIGHT_TO_EIGHT = DayHoursSchema(open="08:00", close="20:00")


def _weekdays(hours: DayHoursSchema, weekend: DayHoursSchema | None = None) -> OpeningHoursSchema:
    return OpeningHoursSchema(
        mon=hours, tue=hours, wed=hours, thu=hours, fri=hours, sat=weekend, sun=None
    )


def _photos(*ids: str) -> list[str]:
    return [f"https://images.unsplash.com/photo-{id_}?w=800&h=500&fit=crop" for id_ in ids]


DEMO_SPACES = [
    SpaceCreateRequestSchema(
        name="Hub Morača Coworking",
        description="Open-plan coworking with fast fiber, standing desks and a quiet phone booth.",
        category=SpaceCategory.DESK,
        city="Podgorica",
        address="Bulevar Svetog Petra Cetinjskog 9",
        price_per_hour=3,
        capacity=24,
        desk_count=24,
        images=_photos("1527192491265-7e15c55b1ed2", "1604328698692-f76ea9498e76"),
        opening_hours=_weekdays(_EIGHT_TO_EIGHT, DayHoursSchema(open="10:00", close="16:00")),
        status=SpaceStatus.LISTED,
    ),
    SpaceCreateRequestSchema(
        name="Glass Room at City Kvart",
        description="A glass-walled meeting room with a 65-inch screen and a whiteboard wall.",
        category=SpaceCategory.MEETING_ROOM,
        city="Podgorica",
        address="Bulevar Džordža Vašingtona 98",
        price_per_hour=18,
        capacity=8,
        images=_photos("1462826303086-329426d1aef5", "1497366811353-6870744d04b2"),
        opening_hours=_weekdays(_EIGHT_TO_EIGHT),
        status=SpaceStatus.LISTED,
    ),
    SpaceCreateRequestSchema(
        name="Hercegovačka Private Office",
        description="A lockable office for a team of up to four, with a printer and a kitchen.",
        category=SpaceCategory.OFFICE,
        city="Podgorica",
        address="Hercegovačka 30",
        price_per_hour=12,
        capacity=4,
        images=_photos("1600508774634-4e11d34730e2"),
        opening_hours=_weekdays(_NINE_TO_FIVE),
        status=SpaceStatus.DRAFT,
    ),
    SpaceCreateRequestSchema(
        name="Preko Morače Event Loft",
        description="An industrial loft for workshops, launches and private parties.",
        category=SpaceCategory.EVENT_HALL,
        city="Podgorica",
        address="Bulevar Ivana Crnojevića 64",
        price_per_hour=85,
        capacity=120,
        images=_photos("1505373877841-8d25f7d46678", "1540575467063-178a50c2df87"),
        opening_hours=_weekdays(
            DayHoursSchema(open="10:00", close="23:00"), DayHoursSchema(open="10:00", close="24:00")
        ),
        status=SpaceStatus.LISTED,
    ),
]


def _seed_spaces(current_user: CurrentUser) -> None:
    # Hosting is turned on directly, so the demo user still starts in guest mode like everyone else.
    user = get_from_di_container(IAuthRepository).get_user_by_id(current_user.id)
    if user is not None and not user.is_host:
        user.is_host = True
        current_user = current_user.model_copy(update={"is_host": True})

    space_service = get_from_di_container(ISpaceService)
    existing = space_service.list(
        filters=SpaceListFilters(host_id=current_user.id),
        pagination_params=PaginationParams(page=1, size=1),
        current_user=current_user,
    )
    if existing.total:
        logger.info("Spaces already exist (%s), nothing to do", existing.total)
        return

    for data in DEMO_SPACES:
        space_service.create(data=data, current_user=current_user)
    logger.info("Created %s demo spaces", len(DEMO_SPACES))


@db_session_handler
def seed() -> None:
    auth_service = get_from_di_container(IAuthService)
    listing_service = get_from_di_container(IListingService)

    try:
        auth = auth_service.login(LoginRequestSchema(email=DEMO_EMAIL, password=DEMO_PASSWORD))
        logger.info("Demo user already exists: %s", DEMO_EMAIL)
    except Exception:
        auth = auth_service.register(
            RegisterRequestSchema(email=DEMO_EMAIL, password=DEMO_PASSWORD, name="Demo User")
        )
        logger.info("Created demo user %s / %s", DEMO_EMAIL, DEMO_PASSWORD)

    current_user = auth_service.get_current_user(auth.token)
    _seed_spaces(current_user)

    existing = listing_service.list(search="", pagination_params=PaginationParams(page=1, size=1))
    if existing.total:
        logger.info("Listings already exist (%s), nothing to do", existing.total)
        return

    for data in DEMO_LISTINGS:
        listing_service.create(data=data, current_user=current_user)
    logger.info("Created %s demo listings", len(DEMO_LISTINGS))
