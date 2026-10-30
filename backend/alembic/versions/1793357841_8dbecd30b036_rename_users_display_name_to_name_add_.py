"""rename users.display_name to name, add profile and mode

Revision ID: 8dbecd30b036
Revises: 7ca4d1d47a95
Create Date: 2026-10-30 11:57:21.206062

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8dbecd30b036"
down_revision: str | Sequence[str] | None = "7ca4d1d47a95"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class ForeignKeysOnError(RuntimeError):
    def __init__(self) -> None:
        super().__init__(
            "PRAGMA foreign_keys is ON: rebuilding the users table would cascade-delete every "
            "space and listing. Run this migration on a connection with foreign keys off."
        )


def _refuse_if_sqlite_foreign_keys_are_on() -> None:
    """On SQLite, batch mode rebuilds `users`: copy to a new table, DROP the old one, rename.

    With `PRAGMA foreign_keys=ON` that DROP cascades and deletes every space and listing. The
    PRAGMA cannot be relied on to switch off here (it is a no-op inside a transaction), so the
    migration checks it and stops before touching any table. Postgres alters in place.
    """
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return
    # A fixed PRAGMA read, no user input; the ORM has no expression for it (ADR-012).
    if bind.exec_driver_sql("PRAGMA foreign_keys").scalar():
        raise ForeignKeysOnError


def upgrade() -> None:
    _refuse_if_sqlite_foreign_keys_are_on()
    with op.batch_alter_table("users", schema=None) as batch_op:
        # A rename, not drop + add: every existing name is kept.
        batch_op.alter_column(
            "display_name",
            new_column_name="name",
            existing_type=sa.String(length=60),
            existing_nullable=False,
        )
        batch_op.add_column(sa.Column("avatar_url", sa.String(length=500), nullable=True))
        batch_op.add_column(
            sa.Column("city", sa.String(length=80), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column("bio", sa.String(length=200), server_default="", nullable=False)
        )
        # Existing rows become 'guest', so both CHECKs below hold for them.
        batch_op.add_column(
            sa.Column("mode", sa.String(length=10), server_default="guest", nullable=False)
        )
        batch_op.create_check_constraint(op.f("ck_users_mode_known"), "mode IN ('guest', 'host')")
        batch_op.create_check_constraint(
            op.f("ck_users_host_mode_requires_is_host"), "mode = 'guest' OR is_host"
        )


def downgrade() -> None:
    _refuse_if_sqlite_foreign_keys_are_on()
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint(op.f("ck_users_host_mode_requires_is_host"), type_="check")
        batch_op.drop_constraint(op.f("ck_users_mode_known"), type_="check")
        batch_op.drop_column("mode")
        batch_op.drop_column("bio")
        batch_op.drop_column("city")
        batch_op.drop_column("avatar_url")
        batch_op.alter_column(
            "name",
            new_column_name="display_name",
            existing_type=sa.String(length=60),
            existing_nullable=False,
        )
