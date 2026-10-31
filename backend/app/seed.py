"""Demo data for development: `poetry run seed`. Idempotent: running it twice changes nothing.

Everything goes through the services, so every rule of the API holds for the demo rows. Dates are
relative to the day the seed runs ("today" from `IClock`): spaces were created 8-10 weeks earlier,
past bookings fall in the last 8 weeks (popular times) and upcoming ones in the next two weeks.

The whole run is one transaction (`db_session_handler`): a seed that fails halfway rolls back as a
whole and leaves nothing behind, so running it again after a failure is safe.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.auth.exceptions.auth import InvalidCredentialsException
from app.auth.schemas.auth import CurrentUser, LoginRequestSchema, RegisterRequestSchema
from app.auth.services.auth import IAuthService
from app.bookings.repositories.booking import IBookingRepository
from app.bookings.schemas.booking import (
    BookingCreateRequestSchema,
    BookingListFilters,
    BookingStatusChange,
    BookingUpdateRequestSchema,
)
from app.bookings.services.booking import IBookingService
from app.config.settings import Settings
from app.database.session_handler import db_session_handler
from app.favorites.schemas.favorite import FavoriteCreateRequestSchema
from app.favorites.services.favorite import IFavoriteService
from app.listings.models.listing import ListingCategory
from app.listings.schemas.listing import ListingCreateRequestSchema
from app.listings.services.listing import IListingService
from app.spaces.models.space import SpaceCategory, SpaceStatus
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import (
    DayHoursSchema,
    OpeningHoursSchema,
    SpaceCreateRequestSchema,
    SpaceListFilters,
    SpaceResponseSchema,
)
from app.spaces.services.space import ISpaceService
from app.users.models.user import UserMode
from app.users.repositories.user import IUserRepository
from app.users.schemas.user import UserUpdateRequestSchema
from app.users.services.user import IUserService
from app.utils.clock import LOCAL_TIMEZONE, WEEKDAYS, IClock, local_hour_to_utc
from app.utils.di import add_to_di_container, get_from_di_container
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class SeedRefusedError(RuntimeError):
    """The seed was started outside local development (`ENVIRONMENT` is not `dev`)."""

    def __init__(self, environment: str) -> None:
        super().__init__(
            f"The demo seed only runs with ENVIRONMENT=dev, not ENVIRONMENT={environment}: "
            "its accounts have public passwords. Nothing was written."
        )


DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"
# Every account from the frontend mock (frontend/src/lib/mock-db.ts) uses this password.
ZONA_PASSWORD = "zona1234"

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


@dataclass(frozen=True)
class _DemoUser:
    key: str
    name: str
    email: str
    password: str
    avatar: int | None  # the pravatar.cc image number; None shows the initials
    city: str
    bio: str
    hosting: bool
    mode: UserMode
    joined_days_ago: int


def _zona_user(
    key: str,
    name: str,
    avatar: int | None,
    city: str,
    bio: str,
    joined_days_ago: int,
    hosting: bool = False,
    mode: UserMode = UserMode.GUEST,
) -> _DemoUser:
    return _DemoUser(
        key=key,
        name=name,
        email=f"{key}@zona.app",
        password=ZONA_PASSWORD,
        avatar=avatar,
        city=city,
        bio=bio,
        hosting=hosting,
        mode=mode,
        joined_days_ago=joined_days_ago,
    )


DEMO_USERS = [
    _DemoUser(
        key="demo",
        name="Demo User",
        email=DEMO_EMAIL,
        password=DEMO_PASSWORD,
        avatar=None,
        city="",
        bio="",
        hosting=False,
        mode=UserMode.GUEST,
        joined_days_ago=90,
    ),
    _zona_user(
        "ana",
        "Ana Petrović",
        47,
        "Podgorica",
        "Freelance UX designer. I book a desk near the river a few mornings a week.",
        joined_days_ago=75,
    ),
    _zona_user(
        "marko",
        "Marko Jovanović",
        12,
        "Podgorica",
        "I run two coworking floors and an event loft in Podgorica. "
        "Happy to help with setup for workshops.",
        joined_days_ago=84,
        hosting=True,
        mode=UserMode.HOST,
    ),
    _zona_user(
        "jelena",
        "Jelena Nikolić",
        45,
        "Nikšić",
        "Product manager at a remote startup, in Podgorica twice a month for team days.",
        joined_days_ago=62,
    ),
    _zona_user(
        "milica",
        "Milica Vuković",
        32,
        "Podgorica",
        "Office manager at City Kvart. I rent out our meeting rooms when the team does not need them.",
        joined_days_ago=80,
        hosting=True,
        mode=UserMode.HOST,
    ),
    _zona_user(
        "nikola",
        "Nikola Bulatović",
        None,
        "Budva",
        "Backend developer, looking for a quiet desk when I visit the capital.",
        joined_days_ago=60,
    ),
    _zona_user(
        "ivana",
        "Ivana Radulović",
        44,
        "Cetinje",
        "Turning my grandfather's old painting studio in Cetinje into a small workspace.",
        joined_days_ago=58,
        hosting=True,
        mode=UserMode.HOST,
    ),
    _zona_user(
        "luka",
        "Luka Šćepanović",
        53,
        "Kotor",
        "Photographer. I book event halls for exhibitions and portfolio reviews.",
        joined_days_ago=66,
    ),
    # A host in guest mode: `isHost` stays true after switching back.
    _zona_user(
        "teodora",
        "Teodora Vujošević",
        None,
        "Bar",
        "Getting a small office by the marina ready to list. "
        "Until then I book desks in Podgorica myself.",
        joined_days_ago=72,
        hosting=True,
        mode=UserMode.GUEST,
    ),
]


def _hours(open_: str, close: str) -> DayHoursSchema:
    return DayHoursSchema(open=open_, close=close)


def _weekdays(
    hours: DayHoursSchema, sat: DayHoursSchema | None = None, sun: DayHoursSchema | None = None
) -> OpeningHoursSchema:
    return OpeningHoursSchema(
        mon=hours, tue=hours, wed=hours, thu=hours, fri=hours, sat=sat, sun=sun
    )


def _photos(*ids: str) -> list[str]:
    return [f"https://images.unsplash.com/photo-{id_}?w=800&h=500&fit=crop" for id_ in ids]


@dataclass(frozen=True)
class _DemoSpace:
    key: str
    host: str
    created_days_ago: int  # 8-10 weeks, so popular times has a full 8-week window
    data: SpaceCreateRequestSchema


# As in the frontend mock (frontend/src/features/spaces/api/spaces-api.ts).
DEMO_SPACES = [
    _DemoSpace(
        key="hub",
        host="marko",
        created_days_ago=70,
        data=SpaceCreateRequestSchema(
            name="Hub Morača Coworking",
            description="Open-plan coworking on the second floor with fast fiber, standing desks and "
            "a quiet phone booth. Coffee and filtered water are included.",
            category=SpaceCategory.DESK,
            city="Podgorica",
            address="Bulevar Svetog Petra Cetinjskog 9",
            price_per_hour=3,
            capacity=24,
            desk_count=24,
            images=_photos(
                "1527192491265-7e15c55b1ed2",
                "1604328698692-f76ea9498e76",
                "1556761175-5973dc0f32e7",
            ),
            opening_hours=_weekdays(_hours("08:00", "20:00"), sat=_hours("10:00", "16:00")),
            status=SpaceStatus.LISTED,
        ),
    ),
    _DemoSpace(
        key="studio",
        host="marko",
        created_days_ago=68,
        data=SpaceCreateRequestSchema(
            name="Njegoševa Studio Desks",
            description="Two desks by the window in a bright studio above the pedestrian street, "
            "two minutes from Republic Square. Quiet, so it fills up fast.",
            category=SpaceCategory.DESK,
            city="Podgorica",
            address="Njegoševa 24",
            price_per_hour=4,
            capacity=2,
            desk_count=2,
            images=_photos(
                "1497215842964-222b430dc094",
                "1497032628192-86f99bcd76bc",
                "1524758631624-e2822e304c36",
            ),
            opening_hours=_weekdays(_hours("09:00", "18:00")),
            status=SpaceStatus.LISTED,
        ),
    ),
    _DemoSpace(
        key="office",
        host="marko",
        created_days_ago=60,
        data=SpaceCreateRequestSchema(
            name="Hercegovačka Private Office",
            description="A lockable office for a team of up to four, with ergonomic chairs, a printer "
            "and a small kitchen shared with one other office.",
            category=SpaceCategory.OFFICE,
            city="Podgorica",
            address="Hercegovačka 30",
            price_per_hour=12,
            capacity=4,
            images=_photos(
                "1600508774634-4e11d34730e2",
                "1568992687947-868a62a9f521",
                "1497366216548-37526070297c",
            ),
            opening_hours=_weekdays(_hours("07:00", "22:00"), sat=_hours("09:00", "18:00")),
            status=SpaceStatus.DRAFT,
        ),
    ),
    _DemoSpace(
        key="loft",
        host="marko",
        created_days_ago=66,
        data=SpaceCreateRequestSchema(
            name="Preko Morače Event Loft",
            description="An industrial loft for workshops, launches and private parties. Sound "
            "system, stage lighting and 120 chairs included; bar service can be booked.",
            category=SpaceCategory.EVENT_HALL,
            city="Podgorica",
            address="Bulevar Ivana Crnojevića 64",
            price_per_hour=85,
            capacity=120,
            images=_photos(
                "1505373877841-8d25f7d46678",
                "1540575467063-178a50c2df87",
                "1511578314322-379afb476865",
            ),
            opening_hours=_weekdays(
                _hours("10:00", "23:00"), sat=_hours("10:00", "23:00"), sun=_hours("12:00", "20:00")
            ),
            status=SpaceStatus.LISTED,
        ),
    ),
    _DemoSpace(
        key="glass",
        host="milica",
        created_days_ago=64,
        data=SpaceCreateRequestSchema(
            name="Glass Room at City Kvart",
            description="A glass-walled meeting room with a 65-inch screen, a whiteboard wall and "
            "video-call camera. Parking in the building garage.",
            category=SpaceCategory.MEETING_ROOM,
            city="Podgorica",
            address="Bulevar Džordža Vašingtona 98",
            price_per_hour=18,
            capacity=8,
            images=_photos("1462826303086-329426d1aef5", "1497366811353-6870744d04b2"),
            opening_hours=_weekdays(_hours("08:00", "21:00"), sat=_hours("09:00", "15:00")),
            status=SpaceStatus.LISTED,
        ),
    ),
    _DemoSpace(
        key="riverside",
        host="milica",
        created_days_ago=63,
        data=SpaceCreateRequestSchema(
            name="Riverside Boardroom",
            description="A boardroom with a long oak table and a view of the Morača river. "
            "Projector, conference phone and catering on request.",
            category=SpaceCategory.MEETING_ROOM,
            city="Podgorica",
            address="Ulica Vaka Đurovića 5",
            price_per_hour=30,
            capacity=14,
            images=_photos(
                "1431540015161-0bf868a2d407",
                "1517502884422-41eaead166d4",
                "1521737604893-d14cc237f11d",
            ),
            opening_hours=_weekdays(_hours("08:00", "20:00")),
            status=SpaceStatus.LISTED,
        ),
    ),
]

# (user, space), oldest saved first, so the Favorites page lists them newest first as in the mock.
DEMO_FAVORITES = [
    ("teodora", "hub"),
    ("luka", "loft"),
    ("teodora", "glass"),
    ("jelena", "riverside"),
    ("nikola", "hub"),
    ("ana", "hub"),
    ("ana", "loft"),
    ("jelena", "studio"),
    ("nikola", "studio"),
    ("ana", "glass"),
    ("demo", "hub"),
]

_CONFIRM = BookingStatusChange.CONFIRMED
_DECLINE = BookingStatusChange.DECLINED
_CANCEL = BookingStatusChange.CANCELLED

_MON_FRI = frozenset(range(5))


@dataclass(frozen=True)
class _DemoBooking:
    guest: str
    space: str
    day: date
    start: int
    end: int
    # Applied in order once every booking of the batch exists: the host confirms or declines,
    # the guest cancels. None leaves it pending.
    changes: tuple[BookingStatusChange, ...] = ()


@dataclass(frozen=True)
class _Pattern:
    """Confirmed bookings on every matching day of the last 8 weeks, for popular times.

    `base + ordinal % spread` units a day (desks, or 0/1 for a space booked whole), never more than
    the space has, so every confirm goes through.
    """

    space: str
    weekdays: frozenset[int]
    start: int
    end: int
    base: int
    spread: int


_PAST_PATTERNS = [
    _Pattern("hub", _MON_FRI, 9, 12, base=2, spread=3),
    _Pattern("hub", _MON_FRI, 13, 17, base=1, spread=3),
    _Pattern("hub", frozenset({5}), 10, 14, base=0, spread=3),
    _Pattern("studio", _MON_FRI, 10, 13, base=1, spread=2),
    _Pattern("glass", _MON_FRI, 9, 11, base=0, spread=2),
    _Pattern("glass", frozenset({1, 3}), 14, 16, base=1, spread=1),
    _Pattern("riverside", frozenset({0, 2}), 10, 12, base=1, spread=1),
    _Pattern("loft", frozenset({4, 5}), 18, 23, base=1, spread=1),
]
_PAST_GUESTS = ("ana", "jelena", "nikola", "luka", "teodora", "demo")
# Popular times looks back 56 days; the fixed clock for past bookings sits one day before that.
_PAST_DAYS = 56


class _FixedClock(IClock):
    def __init__(self, now: datetime) -> None:
        self._now = now

    def now(self) -> datetime:
        return self._now


@contextmanager
def _clock_at(now: datetime) -> Iterator[None]:
    """Services resolved inside the block see `now`; the clock that was there before comes back after.

    Restoring the previous clock (instead of removing the override) keeps a clock a test has fixed.
    """
    previous = get_from_di_container(IClock)
    add_to_di_container(IClock, _FixedClock(now))
    try:
        yield
    finally:
        add_to_di_container(IClock, previous)


def _days_ago(today: date, days: int) -> datetime:
    return local_hour_to_utc(today - timedelta(days=days), 9)


def _hh_mm(hour: int) -> str:
    return f"{hour:02d}:00"


def _weekday_on_or_after(day: date) -> date:
    while day.weekday() not in _MON_FRI:
        day += timedelta(days=1)
    return day


def _on_or_before(day: date, weekdays: frozenset[int]) -> date:
    while day.weekday() not in weekdays:
        day -= timedelta(days=1)
    return day


def _seed_user(demo: _DemoUser, today: date) -> CurrentUser:
    auth_service = get_from_di_container(IAuthService)
    try:
        auth = auth_service.login(LoginRequestSchema(email=demo.email, password=demo.password))
        return auth_service.get_current_user(auth.token)
    except InvalidCredentialsException:
        pass

    auth = auth_service.register(
        RegisterRequestSchema(email=demo.email, password=demo.password, name=demo.name)
    )
    current_user = auth_service.get_current_user(auth.token)
    user_service = get_from_di_container(IUserService)
    avatar_url = None if demo.avatar is None else f"https://i.pravatar.cc/300?img={demo.avatar}"
    user_service.update(
        current_user.id,
        UserUpdateRequestSchema(avatar_url=avatar_url, city=demo.city, bio=demo.bio),
        current_user,
    )
    # Through host mode like in the app, so `isHost` is set the way the API sets it.
    if demo.hosting:
        user_service.update(
            current_user.id, UserUpdateRequestSchema(mode=UserMode.HOST), current_user
        )
    if demo.hosting and demo.mode == UserMode.GUEST:
        user_service.update(
            current_user.id, UserUpdateRequestSchema(mode=UserMode.GUEST), current_user
        )

    # `created_at` comes from the database (server_default), not from IClock: set it directly.
    user_repository = get_from_di_container(IUserRepository)
    user = user_repository.get_by_id(current_user.id)
    if user is not None:
        user.created_at = _days_ago(today, demo.joined_days_ago)
        user_repository.save(user)
    logger.info("Created user %s", demo.email)
    return auth_service.get_current_user(auth.token)


def _own_spaces(host: CurrentUser) -> list[SpaceResponseSchema]:
    page = get_from_di_container(ISpaceService).list(
        filters=SpaceListFilters(host_id=host.id),
        pagination_params=PaginationParams(page=1, size=500),
        current_user=host,
    )
    return list(page.items)


def _seed_spaces(users: dict[str, CurrentUser], today: date) -> dict[str, SpaceResponseSchema]:
    spaces: dict[str, SpaceResponseSchema] = {}
    for host_key in dict.fromkeys(space.host for space in DEMO_SPACES):
        host = users[host_key]
        demos = [space for space in DEMO_SPACES if space.host == host_key]
        existing = _own_spaces(host)
        if existing:
            logger.info("%s already has spaces (%s), nothing to do", host.email, len(existing))
        else:
            space_service = get_from_di_container(ISpaceService)
            space_repository = get_from_di_container(ISpaceRepository)
            for demo in demos:
                created = space_service.create(data=demo.data, current_user=host)
                # `created_at` comes from the database (server_default), not from IClock.
                space = space_repository.get_by_id(created.id)
                if space is not None:
                    space.created_at = _days_ago(today, demo.created_days_ago)
                    space_repository.save(space)
            logger.info("Created %s spaces for %s", len(demos), host.email)
            existing = _own_spaces(host)
        by_name = {space.name: space for space in existing}
        for demo in demos:
            if demo.data.name in by_name:
                spaces[demo.key] = by_name[demo.data.name]
    return spaces


def _seed_favorites(users: dict[str, CurrentUser], spaces: dict[str, SpaceResponseSchema]) -> None:
    favorite_service = get_from_di_container(IFavoriteService)
    created = 0
    for user_key, space_key in DEMO_FAVORITES:
        if space_key not in spaces:
            continue
        saved = favorite_service.create(
            FavoriteCreateRequestSchema(space_id=spaces[space_key].id), users[user_key]
        )
        created += saved.created
    logger.info("Created %s favorites", created)


def _past_bookings(today: date, hub: SpaceResponseSchema) -> list[_DemoBooking]:
    bookings = [
        # Returned as `finished` and `expired`: the slot has ended.
        _DemoBooking(
            "jelena", "hub", _on_or_before(today - timedelta(days=15), _MON_FRI), 9, 12, (_CONFIRM,)
        ),
        _DemoBooking(
            "ana", "loft", _on_or_before(today - timedelta(days=13), frozenset(range(4))), 18, 22
        ),
    ]
    guest = 0
    for days_back in range(_PAST_DAYS, 0, -1):
        day = today - timedelta(days=days_back)
        for pattern in _PAST_PATTERNS:
            if day.weekday() not in pattern.weekdays:
                continue
            for _ in range(pattern.base + day.toordinal() % pattern.spread):
                bookings.append(
                    _DemoBooking(
                        _PAST_GUESTS[guest % len(_PAST_GUESTS)],
                        pattern.space,
                        day,
                        pattern.start,
                        pattern.end,
                        (_CONFIRM,),
                    )
                )
                guest += 1
    # Under way while Hub Morača is open today, so it shows one desk taken ("23 desks available").
    hours = getattr(hub.opening_hours, WEEKDAYS[today.weekday()])
    if hours is None:
        logger.info("Hub Morača is closed today, no booking for today")
    else:
        bookings.append(
            _DemoBooking(
                "luka", "hub", today, int(hours.open[:2]), int(hours.close[:2]), (_CONFIRM,)
            )
        )
    return bookings


def _upcoming_bookings(today: date) -> list[_DemoBooking]:
    # Weekdays from the day after tomorrow on: every listed space is open Monday to Friday.
    week_1, week_2, week_3 = (_weekday_on_or_after(today + timedelta(days=n)) for n in (2, 5, 8))
    return [
        # Both desks of Njegoševa are taken 10:00-12:00 ("No desks left at 10:00").
        _DemoBooking("ana", "studio", week_1, 10, 13, (_CONFIRM,)),
        _DemoBooking("jelena", "studio", week_1, 9, 12, (_CONFIRM,)),
        # Jelena's request overlaps Ana's confirmed one: confirming it answers 409 slot_full.
        _DemoBooking("ana", "glass", week_1, 14, 16, (_CONFIRM,)),
        _DemoBooking("jelena", "glass", week_1, 15, 17),
        _DemoBooking("ana", "loft", week_1, 18, 23, (_CONFIRM,)),
        _DemoBooking("ana", "riverside", week_1, 16, 18, (_CONFIRM, _CANCEL)),
        _DemoBooking("jelena", "riverside", week_2, 9, 12),
        _DemoBooking("jelena", "hub", week_2, 13, 18),
        _DemoBooking("nikola", "studio", week_2, 10, 14),
        _DemoBooking("jelena", "loft", week_2, 17, 21, (_CANCEL,)),
        _DemoBooking("ana", "riverside", week_2, 10, 12, (_DECLINE,)),
        _DemoBooking("luka", "loft", week_3, 18, 22),
    ]


def _book(
    bookings: list[_DemoBooking],
    users: dict[str, CurrentUser],
    spaces: dict[str, SpaceResponseSchema],
) -> list[int]:
    # Resolved here, so the service sees the clock of the caller's `_clock_at` block.
    booking_service = get_from_di_container(IBookingService)
    users_by_id = {user.id: user for user in users.values()}
    # All of them first, then the status changes: a request that overlaps a confirmed booking can
    # only be created while that one is still pending.
    ids = [
        booking_service.create(
            BookingCreateRequestSchema(
                space_id=spaces[booking.space].id,
                date=booking.day,
                start_time=_hh_mm(booking.start),
                end_time=_hh_mm(booking.end),
            ),
            users[booking.guest],
        ).id
        for booking in bookings
    ]
    for booking_id, booking in zip(ids, bookings, strict=True):
        host = users_by_id[spaces[booking.space].host.id]
        for change in booking.changes:
            actor = users[booking.guest] if change == _CANCEL else host
            booking_service.update(booking_id, BookingUpdateRequestSchema(status=change), actor)
    return ids


def _seed_bookings(
    users: dict[str, CurrentUser], spaces: dict[str, SpaceResponseSchema], today: date
) -> None:
    marko = users["marko"]
    existing = get_from_di_container(IBookingService).list(
        filters=BookingListFilters(host_id=marko.id),
        pagination_params=PaginationParams(page=1, size=1),
        current_user=marko,
    )
    if existing.total:
        logger.info("Bookings already exist (%s for Marko), nothing to do", existing.total)
        return
    if any(space.key not in spaces for space in DEMO_SPACES):
        logger.info("Some demo spaces are missing, no bookings")
        return

    # Past slots through the service, so `booking_in_past`, the window and the overlap rule still
    # hold: the clock stands at midnight before the first of them.
    past_now = local_hour_to_utc(today - timedelta(days=_PAST_DAYS + 1), 0)
    with _clock_at(past_now):
        past_ids = _book(_past_bookings(today, spaces["hub"]), users, spaces)
    # `created_at` comes from the database (server_default), not from IClock: without this a past
    # booking would be created after its own slot.
    booking_repository = get_from_di_container(IBookingRepository)
    for booking_id in past_ids:
        booking = booking_repository.get_by_id(booking_id)
        if booking is not None:
            booking.created_at = past_now
    upcoming_ids = _book(_upcoming_bookings(today), users, spaces)
    logger.info("Created %s bookings", len(past_ids) + len(upcoming_ids))


def _seed_listings(current_user: CurrentUser) -> None:
    listing_service = get_from_di_container(IListingService)
    existing = listing_service.list(search="", pagination_params=PaginationParams(page=1, size=1))
    if existing.total:
        logger.info("Listings already exist (%s), nothing to do", existing.total)
        return

    for data in DEMO_LISTINGS:
        listing_service.create(data=data, current_user=current_user)
    logger.info("Created %s demo listings", len(DEMO_LISTINGS))


@db_session_handler
def seed() -> None:
    # The demo passwords are public: never create these accounts outside local development.
    environment = get_from_di_container(Settings).ENVIRONMENT
    if environment != "dev":
        raise SeedRefusedError(environment)
    # One "today" for every relative date, from the clock the services use too.
    today = get_from_di_container(IClock).now().astimezone(LOCAL_TIMEZONE).date()
    users = {demo.key: _seed_user(demo, today) for demo in DEMO_USERS}
    spaces = _seed_spaces(users, today)
    _seed_favorites(users, spaces)
    _seed_bookings(users, spaces, today)
    _seed_listings(users["demo"])
