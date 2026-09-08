"""event ingestion metadata

Revision ID: 0002_event_ingestion_metadata
Revises: 0001_initial_schema
Create Date: 2026-09-07 00:00:01.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0002_event_ingestion_metadata"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scraped_events", sa.Column("source_url", sa.Text(), nullable=True))
    op.add_column("scraped_events", sa.Column("categories", postgresql.ARRAY(sa.String(length=50)), nullable=False, server_default=sa.text("'{}'::varchar(50)[]")))
    op.add_column("scraped_events", sa.Column("prize_pool", sa.String(length=255), nullable=True))
    op.add_column("scraped_events", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("scraped_events", sa.Column("raw_source_ref", sa.String(length=255), nullable=True))

    op.create_index("ix_scraped_events_source", "scraped_events", ["source"])
    op.create_index("ix_scraped_events_last_seen_at", "scraped_events", ["last_seen_at"])
    op.create_index("ix_scraped_events_categories", "scraped_events", ["categories"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_scraped_events_categories", table_name="scraped_events")
    op.drop_index("ix_scraped_events_last_seen_at", table_name="scraped_events")
    op.drop_index("ix_scraped_events_source", table_name="scraped_events")

    op.drop_column("scraped_events", "raw_source_ref")
    op.drop_column("scraped_events", "last_seen_at")
    op.drop_column("scraped_events", "prize_pool")
    op.drop_column("scraped_events", "categories")
    op.drop_column("scraped_events", "source_url")
