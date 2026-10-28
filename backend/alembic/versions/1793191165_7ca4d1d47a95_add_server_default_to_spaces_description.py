"""add server default to spaces.description

Revision ID: 7ca4d1d47a95
Revises: 62a19e5cebde
Create Date: 2026-10-28 13:39:25.438172

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7ca4d1d47a95"
down_revision: str | Sequence[str] | None = "62a19e5cebde"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Written by hand: env.py does not set compare_server_default, so autogenerate does not see
# server_default changes (and `alembic check` would not either).


def upgrade() -> None:
    with op.batch_alter_table("spaces", schema=None) as batch_op:
        batch_op.alter_column(
            "description",
            existing_type=sa.Text(),
            existing_nullable=False,
            server_default="",
        )


def downgrade() -> None:
    with op.batch_alter_table("spaces", schema=None) as batch_op:
        batch_op.alter_column(
            "description",
            existing_type=sa.Text(),
            existing_nullable=False,
            server_default=None,
        )
