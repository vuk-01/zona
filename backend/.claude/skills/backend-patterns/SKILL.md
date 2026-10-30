---
name: backend-patterns
description: Patterns for FastAPI endpoints, services, repositories, SQLAlchemy models, auth and errors in this repo. Use when adding or changing an endpoint, model or migration.
---

# Backend patterns

Every snippet below is copied from `app/listings/`, the reference domain. Copy the shape, rename the
entity. All paths are relative to the repo root. A domain has no `__init__.py`; file names are the singular entity.

```
app/listings/
├── api/listing.py            endpoints (DBAPIRouter)
├── exceptions/listing.py     domain exceptions with a code
├── models/listing.py         the table
├── repositories/listing.py   session + queries
├── routes.py                 APIRouter(tags=[...]) → registered in app/routes.py
├── schemas/listing.py        request/response schemas
└── services/listing.py       rules, ownership, response schemas
```

## 1. Model (`models/listing.py`): typed columns, constraints in the database

```python
class ListingCategory(StrEnum):
    GAMES = "games"
    CONSOLES = "consoles"
    ACCESSORIES = "accessories"


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint("price >= 0", name="price_not_negative"),
        CheckConstraint(f"category IN ({_CATEGORY_LIST})", name="category_known"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(80))
    price: Mapped[float] = mapped_column(Numeric(10, 2, asdecimal=False))
    image_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    owner: Mapped[User] = relationship("User", back_populates="listings")   # User imported under TYPE_CHECKING
```

`Mapped[str | None]` makes the column nullable; everything else is `NOT NULL`. Uniqueness is `unique=True`.
`sqlalchemy.DateTime` is banned (ruff TID251): timestamps are `TIMESTAMP(timezone=True)`.

## 2. Schemas (`schemas/listing.py`): camelCase, limits from docs/entities.md

```python
class ListingCreateRequestSchema(CamelCaseModel):
    title: str = Field(min_length=3, max_length=80)
    price: float = Field(ge=0, le=_MAX_PRICE)       # _MAX_PRICE: what Numeric(10, 2) holds
    category: ListingCategory                       # the StrEnum from the model
    image_url: str | None = Field(default=None, max_length=500)


class ListingUpdateRequestSchema(CamelCaseModel):   # PATCH: every field optional
    title: str | None = Field(default=None, min_length=3, max_length=80)

    # Runs only for fields the client sent. The columns are NOT NULL, so `null` is 422, not a 500.
    @field_validator("title", "description", "price", "category", "city")
    @classmethod
    def _not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError("not_null", "Must not be null")
        return value


class ListingResponseSchema(CamelCaseResponseModel):
    id: int
    image_url: str | None                           # becomes "imageUrl" in JSON
    created_at: UtcDatetime                         # becomes "createdAt": "2026-10-12T00:00:00Z"
    owner_id: int
```

`CamelCaseModel` and `CamelCaseResponseModel` (in `app/utils/schemas.py`) set the alias generator;
the response variant adds `from_attributes`, so `ListingResponseSchema.model_validate(listing)` works on a model.

## 3. Exceptions (`exceptions/listing.py`): the domain error, not the status code

```python
class ListingNotFoundException(NotFoundException):
    def __init__(self) -> None:
        super().__init__(message="Listing not found", code="listing_not_found")


class NotListingOwnerException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(message="Only the owner can change this listing", code="not_listing_owner")
```

The bases in `app/utils/exceptions.py` (`NotFoundException`, `InvalidRequestException`, `UnauthenticatedException`,
`ForbiddenException`, `ConflictException`, `ServerException`) are mapped to statuses once, in `app/app.py`.

## 4. Repository (`repositories/listing.py`): the session and the queries, nothing else

```python
class IListingRepository(Protocol):
    def get_all(self, search: str, pagination_params: PaginationParams) -> Page[Listing]: ...
    def get_by_id(self, listing_id: int) -> Listing | None: ...
    def add(self, listing: Listing) -> Listing: ...
    def save(self, listing: Listing) -> Listing: ...
    def delete(self, listing_id: int) -> bool: ...


@inject(alias=IListingRepository)
class ListingRepository(IListingRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(self, search: str, pagination_params: PaginationParams) -> Page[Listing]:
        db = self._session_factory()
        query = select(Listing).order_by(Listing.created_at.desc(), Listing.id.desc())
        if search:
            query = query.where(Listing.title.ilike(f"%{search}%"))  # a bound parameter, not SQL
        return paginate(query=query, pagination_params=pagination_params, db=db)

    def add(self, listing: Listing) -> Listing:
        db = self._session_factory()
        # A SAVEPOINT: when the database refuses the row, only the savepoint rolls back and the
        # session stays usable, so the service can still look up the owner.
        with db.begin_nested():
            db.add(listing)
            db.flush()  # assigns id and created_at; the endpoint's session handler commits (ADR-009)
        return listing

    def save(self, listing: Listing) -> Listing:
        db = self._session_factory()
        # Flush now, so a vanished row (StaleDataError) raises here, where the service can name it,
        # and not later inside the session handler's commit as a 500.
        db.flush()
        return listing

    def delete(self, listing_id: int) -> bool:
        """False when the row was already gone (deleted by a parallel request)."""
        db = self._session_factory()
        # A DELETE statement, not db.delete(listing): without a version column the ORM only warns
        # when the row is already gone, so the returned id is the only way to tell.
        deleted_id = db.execute(
            delete(Listing).where(Listing.id == listing_id).returning(Listing.id)
        ).scalar_one_or_none()
        return deleted_id is not None
```

Never `db.commit()` here: `DBAPIRouter` commits when the endpoint returns and rolls back when it raises.
Never `db.delete(model)` either: on a row a parallel request already deleted it only warns, and the
endpoint answers `204` instead of `404`.

## 5. Service (`services/listing.py`): the rules, including ownership; returns schemas

```python
class IListingService(Protocol):
    def get(self, listing_id: int) -> ListingResponseSchema: ...
    def create(self, data: ListingCreateRequestSchema, current_user: CurrentUser) -> ListingResponseSchema: ...


@inject(alias=IListingService)
class ListingService(IListingService):
    def __init__(self, listing_repository: IListingRepository, user_repository: IUserRepository) -> None:
        self._listing_repository = listing_repository
        self._user_repository = user_repository   # another domain, through its Protocol (ADR-014)

    def create(self, data: ListingCreateRequestSchema, current_user: CurrentUser) -> ListingResponseSchema:
        # The owner is always the signed-in user, never an id from the request body (ADR-006).
        listing = Listing(**data.model_dump(), owner_id=current_user.id)
        try:
            listing = self._listing_repository.add(listing)
        except IntegrityError as e:
            # Every CHECK and NOT NULL has a Pydantic twin; what is left is the owner_id foreign key,
            # refused when the owner's account was deleted during the request. Their token is then invalid.
            if self._user_repository.get_by_id(current_user.id) is None:
                raise InvalidTokenException from e
            raise  # the owner exists: a rule Pydantic lets through, a bug, not a client error
        return ListingResponseSchema.model_validate(listing)

    def update(self, listing_id: int, data: ListingUpdateRequestSchema, current_user: CurrentUser) -> ListingResponseSchema:
        listing = self._get_or_raise(listing_id)
        self._ensure_owner(listing, current_user)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        try:
            listing = self._listing_repository.save(listing)
        except StaleDataError as e:
            # The row vanished after it was read (deleted by its owner or with the owner's account).
            raise ListingNotFoundException from e
        return ListingResponseSchema.model_validate(listing)

    def delete(self, listing_id: int, current_user: CurrentUser) -> None:
        listing = self._get_or_raise(listing_id)
        self._ensure_owner(listing, current_user)
        if not self._listing_repository.delete(listing.id):
            # Deleted by a parallel request after it was read.
            raise ListingNotFoundException

    def _get_or_raise(self, listing_id: int) -> Listing:
        listing = self._listing_repository.get_by_id(listing_id)
        if listing is None:
            raise ListingNotFoundException
        return listing

    @staticmethod
    def _ensure_owner(listing: Listing, current_user: CurrentUser) -> None:
        if listing.owner_id != current_user.id:
            raise NotListingOwnerException
```

`@inject(alias=IListingService)` registers the class in the kink container under its Protocol; the constructor
arguments are resolved by type. Tests replace the Protocol with `create_autospec(IListingService, instance=True)`.

## 6. Endpoints (`api/listing.py`): thin, one service call per route

```python
router = DBAPIRouter(prefix="/listings")


@router.post(path="", status_code=status.HTTP_201_CREATED, summary="Create listing")
def create_listing(
    data: ListingCreateRequestSchema,
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ListingResponseSchema:
    return listing_service.create(data=data, current_user=current_user)


@router.delete(path="/{listing_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete listing (owner only)")
def delete_listing(
    listing_id: int,
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    listing_service.delete(listing_id=listing_id, current_user=current_user)
```

`get_di_entity` and `get_current_user` come from `app.deps` (401 without a valid token). `routes.py`:
`router = APIRouter(tags=["Listings"]); router.include_router(listing_router)`, then in `app/routes.py`:
`api_router.include_router(listings_router)`.

## 7. Errors: one shape

Raise a domain exception anywhere below the endpoint; the handlers in `app/app.py` answer
`{"detail": "...", "code": "...", "fieldErrors": {"field": "..."}}` (`fieldErrors` only when a field is at fault).
Pydantic validation becomes `422` with `code: "validation_error"` and one message per field.
A duplicate is caught from the database, not checked beforehand (`app/auth/services/auth.py`):

```python
try:
    user = self._auth_repository.add_user(user)
except IntegrityError as e:
    # The UNIQUE constraint on users.email decides, not an `if` before the insert (ADR-007).
    raise EmailAlreadyRegisteredException from e      # ConflictException with field_errors={"email": ...}
```

Catch `IntegrityError` only for a rule the input cannot check, and answer by the rule that refused (ADR-019):

- a UNIQUE column → `409` with `fieldErrors` (above), or `200` with the existing row when the contract makes the
  `POST` idempotent (favorites; ADR-021);
- a foreign key to the signed-in user on `POST` (`owner_id`, `host_id`) → `401 invalid_token` (`create` in §5);
- a foreign key to another row named in the request (`spaceId` on a favorite or a booking) → `404` for that entity:

```python
except IntegrityError as e:
    if self._user_repository.get_by_id(current_user.id) is None:   # the signed-in user first
        raise InvalidTokenException from e
    if self._space_repository.get_by_id(data.space_id) is None:     # then the row from the request
        raise SpaceNotFoundException from e
    raise  # both exist: a rule Pydantic lets through, a bug
```

For a foreign key, `add` runs inside `db.begin_nested()` so the session stays usable for the lookup, and the
service reaches the other domain through its Protocol (`IUserRepository`, `ISpaceRepository`). Every `CHECK`
and `NOT NULL` gets a Pydantic twin instead; never a catch-all `409` "please try again". A row deleted while
its `PATCH` or `DELETE` runs is a `404`: `StaleDataError` from `save()`, or `False` from `delete()`; an idempotent
`DELETE` answers `204` either way (ADR-021).

## 8. Tests: unit (service mocked) and integration (real database)

```python
# tests/unit/test_listings_api.py
def test_patch_by_other_user_is_403(client: TestClient, listing_service: Mock) -> None:
    listing_service.update.side_effect = NotListingOwnerException()

    response = client.patch("/api/listings/7", json={"price": 1}, headers=AUTH)

    assert response.status_code == 403
    assert response.json()["code"] == "not_listing_owner"


# tests/integration/test_listings.py
def test_owner_can_delete(client: TestClient, auth_headers: dict[str, str], listing_id: int) -> None:
    deleted = client.delete(f"/api/listings/{listing_id}", headers=auth_headers)

    assert deleted.status_code == 204
    assert client.get(f"/api/listings/{listing_id}").status_code == 404
```

Unit: the autouse `auth_service` fixture authenticates every request as user 1. Integration: `auth_headers` and
`other_auth_headers` are two registered users; every test starts with empty tables.

## 9. Migration workflow

1. Change the model (a new `app/<domain>/models/<entity>.py` is picked up automatically by `load_all_models()`)
2. `poetry run makemigrations "add listings.sold_at"`
3. Read `alembic/versions/<new file>.py`: autogenerate misses renames and data moves and may drop what it does not know
4. `poetry run migrate`, then `poetry run alembic check` must say "No new upgrade operations detected"

## 10. File uploads: metadata before bytes

The database never stores file contents. An upload endpoint saves the file outside the database (a folder
such as `data/uploads/`, or object storage) and the row keeps only the path or URL (`image_url`),
plus size and content type if needed. Validate size and type before writing a single byte.
