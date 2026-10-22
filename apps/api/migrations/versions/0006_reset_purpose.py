"""separate password reset and email login codes

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "password_resets",
        sa.Column("purpose", sa.String(length=20), nullable=False, server_default="reset"),
    )


def downgrade() -> None:
    op.drop_column("password_resets", "purpose")
