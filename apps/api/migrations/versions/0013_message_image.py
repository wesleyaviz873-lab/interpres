"""message image attachment

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversation_messages", sa.Column("image", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversation_messages", "image")
