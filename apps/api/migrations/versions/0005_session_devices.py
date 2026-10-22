"""session device metadata

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("user_agent", sa.String(length=500), nullable=True))
    op.add_column("auth_sessions", sa.Column("ip", sa.String(length=64), nullable=True))
    op.add_column("auth_sessions", sa.Column("last_seen_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("auth_sessions", "last_seen_at")
    op.drop_column("auth_sessions", "ip")
    op.drop_column("auth_sessions", "user_agent")
