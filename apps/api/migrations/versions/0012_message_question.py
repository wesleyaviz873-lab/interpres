"""message question card

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversation_messages", sa.Column("question", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversation_messages", "question")
