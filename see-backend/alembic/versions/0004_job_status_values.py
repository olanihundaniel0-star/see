"""add assessment and archived job statuses

Revision ID: 0004_job_status_values
Revises: 0003_email_ingestions
Create Date: 2026-09-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "0004_job_status_values"
down_revision = "0003_email_ingestions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'assessment' BEFORE 'interviewing'")
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'archived'")


def downgrade() -> None:
    # PostgreSQL cannot drop a single value from an enum type; the extra
    # labels are harmless to leave in place, so this migration is irreversible.
    pass
