"""message process log

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversation_messages", sa.Column("process", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversation_messages", "process")
