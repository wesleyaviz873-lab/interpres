"""conversation harness session

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("harness", sa.String(length=40), nullable=True))
    op.add_column(
        "conversations",
        sa.Column("harness_session", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversations", "harness_session")
    op.drop_column("conversations", "harness")
