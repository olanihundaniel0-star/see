"""email ingestions

Revision ID: 0003_email_ingestions
Revises: 0002_event_ingestion_metadata
Create Date: 2026-09-07 00:00:02.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0003_email_ingestions"
down_revision = "0002_event_ingestion_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_ingestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("raw_email_hash", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default=sa.text("'gmail'")),
        sa.Column("sender", sa.Text(), nullable=True),
        sa.Column("recipient", sa.Text(), nullable=True),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("message_type", sa.String(length=50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("extraction_result", sa.JSON(), nullable=False),
        sa.Column("linked_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("linked_reminder_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("linked_note_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("raw_email_hash", name="uq_email_ingestions_raw_email_hash"),
    )


def downgrade() -> None:
    op.drop_table("email_ingestions")
