"""initial schema

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-09-07 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


job_status = sa.Enum(
    "bookmarked",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    name="job_status",
)

priority_level = sa.Enum("low", "medium", "high", name="priority_level")


def upgrade() -> None:
    bind = op.get_bind()
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    job_status.create(bind, checkfirst=True)
    priority_level.create(bind, checkfirst=True)

    op.create_table(
        "job_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company", sa.String(length=150), nullable=False),
        sa.Column("role", sa.String(length=150), nullable=False),
        sa.Column("location", sa.String(length=150), nullable=True),
        sa.Column("salary_range", sa.String(length=100), nullable=True),
        sa.Column("job_url", sa.Text(), nullable=True),
        sa.Column("status", job_status, nullable=False, server_default=sa.text("'applied'::job_status")),
        sa.Column("interview_notes", sa.Text(), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_job_applications_user_id", "job_applications", ["user_id"])
    op.create_index("idx_jobs_user_status", "job_applications", ["user_id", "status"])
    op.create_index("idx_jobs_deadline", "job_applications", ["user_id", "deadline"])

    op.create_table(
        "job_checklists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_job_checklists_job_id", "job_checklists", ["job_id"])

    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.String(length=255), nullable=True),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(tags, ''))", persisted=True),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_notes_user_id", "notes", ["user_id"])
    op.create_index("idx_notes_search", "notes", ["search_vector"], postgresql_using="gin")

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("priority", priority_level, nullable=False, server_default=sa.text("'medium'::priority_level")),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_reminders_user_id", "reminders", ["user_id"])
    op.create_index("idx_reminders_user_due", "reminders", ["user_id", "due_date", "is_completed"])

    op.create_table(
        "scraped_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("is_virtual", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("external_id", name="uq_scraped_events_external_id"),
    )
    op.create_index("ix_scraped_events_start_date", "scraped_events", ["start_date"])


def downgrade() -> None:
    op.drop_index("ix_scraped_events_start_date", table_name="scraped_events")
    op.drop_table("scraped_events")

    op.drop_index("idx_reminders_user_due", table_name="reminders")
    op.drop_index("ix_reminders_user_id", table_name="reminders")
    op.drop_table("reminders")

    op.drop_index("idx_notes_search", table_name="notes")
    op.drop_index("ix_notes_user_id", table_name="notes")
    op.drop_table("notes")

    op.drop_index("ix_job_checklists_job_id", table_name="job_checklists")
    op.drop_table("job_checklists")

    op.drop_index("idx_jobs_deadline", table_name="job_applications")
    op.drop_index("idx_jobs_user_status", table_name="job_applications")
    op.drop_index("ix_job_applications_user_id", table_name="job_applications")
    op.drop_table("job_applications")

    bind = op.get_bind()
    priority_level.drop(bind, checkfirst=True)
    job_status.drop(bind, checkfirst=True)
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
