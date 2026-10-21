"""Durable notification schedules, devices, preferences and saved events."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
revision = '0005_notifications'
down_revision = '0004_job_status_values'
branch_labels = depends_on = None

def upgrade():
    op.create_table('notification_preferences',
        sa.Column('user_id',pg.UUID(as_uuid=True),primary_key=True),
        sa.Column('enabled',sa.Boolean(),nullable=False,server_default=sa.true()),
        sa.Column('timezone',sa.String(100),nullable=False,server_default='UTC'),
        sa.Column('advance_minutes',sa.Integer(),nullable=False,server_default='30'),
        sa.Column('overdue_minutes',sa.Integer(),nullable=False,server_default='1440'),
        sa.Column('quiet_start',sa.Integer()),sa.Column('quiet_end',sa.Integer()),
        *[sa.Column(k,sa.Boolean(),nullable=False,server_default=sa.true()) for k in ['reminders','jobs','events']],
        *[sa.Column(k,sa.Boolean(),nullable=False,server_default=sa.false()) for k in ['daily','weekly']],
        sa.Column('agenda_hour',sa.Integer(),nullable=False,server_default='8'))
    op.create_table('push_devices',sa.Column('id',pg.UUID(as_uuid=True),primary_key=True),
        sa.Column('user_id',pg.UUID(as_uuid=True),nullable=False),sa.Column('token',sa.Text(),nullable=False,unique=True),
        sa.Column('active',sa.Boolean(),nullable=False,server_default=sa.true()),
        sa.Column('last_seen_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))
    op.create_index('ix_push_devices_user_id','push_devices',['user_id'])
    op.create_table('saved_events',sa.Column('id',pg.UUID(as_uuid=True),primary_key=True),
        sa.Column('user_id',pg.UUID(as_uuid=True),nullable=False),
        sa.Column('event_id',pg.UUID(as_uuid=True),sa.ForeignKey('scraped_events.id',ondelete='CASCADE'),nullable=False),
        sa.Column('registration_deadline',sa.DateTime(timezone=True)),sa.UniqueConstraint('user_id','event_id'))
    op.create_index('ix_saved_events_user_id','saved_events',['user_id'])
    op.create_table('notifications',sa.Column('id',pg.UUID(as_uuid=True),primary_key=True),
        sa.Column('user_id',pg.UUID(as_uuid=True),nullable=False),sa.Column('dedupe_key',sa.String(255),nullable=False,unique=True),
        sa.Column('source',sa.String(40),nullable=False),sa.Column('source_id',pg.UUID(as_uuid=True)),
        sa.Column('send_at',sa.DateTime(timezone=True),nullable=False),sa.Column('status',sa.String(20),nullable=False,server_default='pending'),
        sa.Column('route',sa.String(255),nullable=False),sa.Column('body',sa.String(255),nullable=False))
    op.create_index('ix_notifications_user_id','notifications',['user_id'])
    op.create_index('ix_notifications_due','notifications',['status','send_at'])
    op.create_table('notification_deliveries',sa.Column('id',pg.UUID(as_uuid=True),primary_key=True),
        sa.Column('notification_id',pg.UUID(as_uuid=True),sa.ForeignKey('notifications.id',ondelete='CASCADE'),nullable=False),
        sa.Column('device_id',pg.UUID(as_uuid=True),sa.ForeignKey('push_devices.id',ondelete='CASCADE'),nullable=False),
        sa.Column('status',sa.String(20),nullable=False,server_default='pending'),sa.Column('attempts',sa.Integer(),nullable=False,server_default='0'),
        sa.Column('receipt_id',sa.Text()),sa.Column('next_attempt_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),sa.Column('error',sa.String(100)),
        sa.UniqueConstraint('notification_id','device_id'))
    for field in ['interview_at','assessment_at','follow_up_at']:
        op.add_column('job_applications',sa.Column(field,sa.DateTime(timezone=True)))

def downgrade():
    for field in ['interview_at','assessment_at','follow_up_at']: op.drop_column('job_applications',field)
    for table in ['notification_deliveries','notifications','saved_events','push_devices','notification_preferences']: op.drop_table(table)
