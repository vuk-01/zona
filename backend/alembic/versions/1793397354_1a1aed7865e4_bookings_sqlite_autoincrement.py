"""bookings sqlite autoincrement

Revision ID: 1a1aed7865e4
Revises: 931e8ba2d389
Create Date: 2026-10-30 22:55:54.218386

Without AUTOINCREMENT SQLite gives a new row the id of the deleted last row, so a request that
names a booking by its id could reach another booking (ADR-024). Autogenerate does not compare
table options such as `sqlite_autoincrement`, so this revision is written by hand and
`alembic check` cannot tell whether it ran: `sqlite_master` shows `AUTOINCREMENT` in the table's SQL.

SQLite cannot add AUTOINCREMENT to a table, so batch mode rebuilds it: create `_alembic_tmp_bookings`,
copy every row with its id, drop `bookings`, rename the copy, create the indexes again. That is
safe because no table, view or trigger refers to `bookings` (no foreign key points at it), so the
drop cascades nowhere. The copy also sets `sqlite_sequence` to the largest id in the table, so from
here on no id is given twice (an id above it, deleted before this revision ran, can come back once).
Postgres sequences never repeat an id; there is nothing to do there.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1a1aed7865e4"
down_revision: str | Sequence[str] | None = "931e8ba2d389"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_context().dialect.name != "sqlite":
        return
    with op.batch_alter_table(
        "bookings", recreate="always", table_kwargs={"sqlite_autoincrement": True}
    ):
        pass


def downgrade() -> None:
    if op.get_context().dialect.name != "sqlite":
        return
    with op.batch_alter_table("bookings", recreate="always"):
        pass
