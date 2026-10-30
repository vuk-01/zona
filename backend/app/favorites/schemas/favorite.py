from __future__ import annotations

from dataclasses import dataclass

from pydantic import Field

from app.utils.schemas import CamelCaseModel, CamelCaseResponseModel, UtcDatetime

# Ids above this overflow SQLite's 64-bit integer as a 500; bounded here they are a 422.
MAX_ID = 2**31 - 1


class FavoriteCreateRequestSchema(CamelCaseModel):
    space_id: int = Field(ge=1, le=MAX_ID)


class FavoriteResponseSchema(CamelCaseResponseModel):
    """`userId` + `spaceId` is the key; the table's own `id` never leaves the API."""

    user_id: int
    space_id: int
    created_at: UtcDatetime


@dataclass(frozen=True)
class FavoriteSaved:
    """The saved favorite, and whether this request created it (201) or found it (200, ADR-021)."""

    favorite: FavoriteResponseSchema
    created: bool
