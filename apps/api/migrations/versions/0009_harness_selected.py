"""selected harness for chat

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "harness_settings",
        sa.Column("selected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("harness_settings", "selected")
