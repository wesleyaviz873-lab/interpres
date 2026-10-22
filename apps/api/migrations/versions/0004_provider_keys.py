"""provider API keys encrypted at rest

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provider_keys",
        sa.Column("provider", sa.String(length=40), primary_key=True, nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("provider_keys")
