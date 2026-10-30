from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_core import PydanticCustomError

from app.listings.models.listing import ListingCategory
from app.utils.schemas import CamelCaseModel, CamelCaseResponseModel, UtcDatetime

# The largest value `Numeric(10, 2)` holds; above it Postgres refuses the row (numeric overflow).
_MAX_PRICE = 99_999_999.99


class ListingCreateRequestSchema(CamelCaseModel):
    title: str = Field(min_length=3, max_length=80)
    description: str = Field(default="", max_length=2000)
    price: float = Field(ge=0, le=_MAX_PRICE)
    category: ListingCategory
    city: str = Field(min_length=1, max_length=80)
    image_url: str | None = Field(default=None, max_length=500)


class ListingUpdateRequestSchema(CamelCaseModel):
    """Every field optional: PATCH changes only what the client sends (`exclude_unset`).

    Only `imageUrl` may be sent as `null` (it removes the image); `null` for any other field is 422.
    """

    title: str | None = Field(default=None, min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0, le=_MAX_PRICE)
    category: ListingCategory | None = None
    city: str | None = Field(default=None, min_length=1, max_length=80)
    image_url: str | None = Field(default=None, max_length=500)

    # Runs only for fields the client sent: defaults are not validated. The columns are NOT NULL.
    @field_validator("title", "description", "price", "category", "city")
    @classmethod
    def _not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError("not_null", "Must not be null")
        return value


class ListingResponseSchema(CamelCaseResponseModel):
    id: int
    title: str
    description: str
    price: float
    category: ListingCategory
    city: str
    image_url: str | None
    created_at: UtcDatetime
    owner_id: int
