# See Backend - Database Setup & Configuration

## Overview

The See backend uses PostgreSQL with SQLAlchemy async ORM and Alembic for migrations.

Current setup:
- **Database:** PostgreSQL (local or Supabase)
- **ORM:** SQLAlchemy 2.0 with async support
- **Migrations:** Alembic
- **Connection pooling:** SQLAlchemy built-in (pool_size=10, max_overflow=20)

---

## Development Setup

### Local PostgreSQL

```bash
# 1. Install PostgreSQL (if not already)
sudo apt-get install postgresql postgresql-contrib

# 2. Start PostgreSQL service
sudo service postgresql start

# 3. Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE see;
CREATE USER see_user WITH PASSWORD 'dev_password_change_in_production';
ALTER ROLE see_user SET client_encoding TO 'utf8';
ALTER ROLE see_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE see_user SET default_transaction_deferrable TO on;
ALTER ROLE see_user SET default_transaction_read_committed TO on;
GRANT ALL PRIVILEGES ON DATABASE see TO see_user;
EOF

# 4. Set .env
DATABASE_URL=postgresql+asyncpg://see_user:dev_password_change_in_production@localhost:5432/see

# 5. Run migrations
cd see-backend
source .venv/bin/activate
alembic upgrade head

# 6. Start backend
python -m uvicorn app.main:app --reload --port 8000
```

### Docker Compose (Easier)

```bash
cd "/home/daniel/projects/see folder/see"
make compose-up
```

This starts PostgreSQL + Redis + backend + workers automatically.

---

## Production Setup

### 1. PostgreSQL on Supabase (Recommended)

**Advantages:**
- Fully managed (backups, replication, monitoring)
- Free tier available
- Already configured in your project

**Steps:**
```bash
# 1. Go to https://supabase.com/dashboard/project/nvdhvesydakhkjamfkfs/settings/database
# 2. Note connection string: postgresql://postgres:[PASSWORD]@db.nvdhvesydakhkjamfkfs.supabase.co:5432/postgres
# 3. Update .env for production:

DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.nvdhvesydakhkjamfkfs.supabase.co:5432/postgres

# 4. Run migrations from production backend:
alembic upgrade head

# 5. Enable SSL (already enabled on Supabase)
# Update connection string to include SSL:
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.nvdhvesydakhkjamfkfs.supabase.co:5432/postgres?ssl=require
```

### 2. Self-Hosted PostgreSQL on AWS RDS

```bash
# Create RDS PostgreSQL instance
# Configuration:
# - Engine: PostgreSQL 15+
# - Multi-AZ: Yes (for HA)
# - Storage: 100GB + auto-scaling
# - Backup retention: 30 days
# - Security group: Allow port 5432 from app server

# After creating RDS:
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[RDS-ENDPOINT]:5432/postgres?ssl=require
```

### 3. Self-Hosted PostgreSQL on DigitalOcean

```bash
# Create Managed Database cluster
# 1 node: $15/month
# 3 nodes HA: $45/month

# After creation:
DATABASE_URL=postgresql+asyncpg://doadmin:[PASSWORD]@[DO-ENDPOINT]:25060/postgres?ssl=require&sslmode=require
```

---

## Connection Pooling Configuration

### Current (Development)
```python
# see-backend/app/core/database.py
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,       # Connections in pool
    max_overflow=20,    # Additional connections when pool exhausted
    pool_pre_ping=True, # Check connection before use
)
```

### Recommended for Production

**Option A: SQLAlchemy Built-in (Current)**
- Pool size: 10-20 (depends on server size)
- Max overflow: 20-40
- Good for small to medium apps
- Scaling: Increase pool size if you see connection pool exhaustion

```python
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False,
)
```

**Option B: PgBouncer (Recommended for High Traffic)**
- Standalone connection pool between app and PostgreSQL
- Supports thousands of connections
- Lower resource usage per connection

```bash
# Install PgBouncer
sudo apt-get install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
see = host=db.example.com port=5432 user=postgres password=secret dbname=postgres

[pgbouncer]
pool_mode = transaction  # Connection pool mode
max_client_conn = 1000
default_pool_size = 25

# Start PgBouncer
sudo systemctl start pgbouncer

# Update app connection string to use PgBouncer (localhost:6432)
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:6432/see
```

**Option C: AWS RDS Proxy**
- AWS-managed connection pool
- No additional infrastructure
- Integrated with RDS

```python
# When using RDS Proxy, update connection string:
DATABASE_URL=postgresql+asyncpg://postgres:password@[RDS-PROXY-ENDPOINT]:6432/postgres?ssl=require
```

---

## Database Migrations

### How Alembic Works
```bash
# Generate migration (auto-detects model changes)
alembic revision --autogenerate -m "Add new column"

# View pending migrations
alembic current  # Current revision
alembic history  # All revisions

# Apply migrations
alembic upgrade head  # Latest
alembic upgrade +1    # One revision

# Rollback
alembic downgrade -1  # One revision back
alembic downgrade base # To initial state
```

### Pre-Deployment Checklist
```bash
# 1. Test migrations locally
docker-compose up  # Starts with migrations
curl http://localhost:8000/health

# 2. Generate migration for any new models
alembic revision --autogenerate -m "Describe change"

# 3. Review generated migration file
cat alembic/versions/[timestamp]_describe_change.py

# 4. Test migration locally
alembic upgrade head

# 5. Commit migration to git
git add alembic/versions/
git commit -m "Migration: describe change"

# 6. Deploy: Run migrations on production BEFORE deploying new code
# This ensures backward compatibility
```

### Migration Safety Best Practices
```python
# ✅ GOOD: Additive changes (forward-compatible)
def upgrade():
    op.add_column('jobs', sa.Column('new_field', sa.String()))

# ❌ BAD: Removing columns (breaks old app versions)
def upgrade():
    op.drop_column('jobs', 'old_field')

# ✅ GOOD: Add column with default
def upgrade():
    op.add_column('jobs', sa.Column('status', sa.String(), default='pending'))

# ✅ GOOD: Multi-step removal (safe for rolling deployments)
# Step 1: Add new column, migrate data, deprecate old column
# Step 2: (Later) Remove old column
```

---

## Production Environment Variables

### Required for Production
```bash
# Database
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[PROD-DB]:5432/postgres?ssl=require

# Supabase Auth (production keys)
SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
SUPABASE_JWT_SECRET=[PRODUCTION-JWT-SECRET-FROM-SUPABASE]
SUPABASE_ISSUER=https://nvdhvesydakhkjamfkfs.supabase.co/auth/v1
SUPABASE_JWKS_URL=https://nvdhvesydakhkjamfkfs.supabase.co/auth/v1/.well-known/jwks.json

# Redis (production)
REDIS_URL=redis://[PROD-REDIS]:6379/0

# API
CORS_ORIGINS=https://your-app-domain.com,https://www.your-app-domain.com

# Secrets (rotate these!)
INTERNAL_API_TOKEN=[STRONG-RANDOM-STRING]
EMAIL_WEBHOOK_SECRET=[STRONG-RANDOM-STRING]

# Optional: Gmail integration
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=[GMAIL-APP-PASSWORD]
```

### How to Set Environment Variables

**Option A: Render/Railway**
```
Dashboard → Settings → Environment → Add variable
```

**Option B: Docker**
```bash
docker run -e DATABASE_URL=... -e REDIS_URL=... see-backend
```

**Option C: Kubernetes**
```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: database-url
```

---

## Backups & Disaster Recovery

### Automated Backups

**Supabase (Automatic)**
- Daily automated backups
- Point-in-time recovery available
- No additional configuration needed

**AWS RDS**
```bash
# Enable automated backups (dashboard or CLI)
aws rds modify-db-instance \
  --db-instance-identifier see-db \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"
```

### Manual Backup

```bash
# Backup database
pg_dump "postgresql://user:password@host:5432/see" > backup.sql

# Restore from backup
psql "postgresql://user:password@host:5432/see" < backup.sql

# Compress backup for storage
pg_dump "postgresql://..." | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Backup Strategy
- **Daily:** Automated by database service
- **Weekly:** Manual backup to S3/object storage
- **Monthly:** Long-term archive
- **Test:** Monthly restore test to staging

---

## Monitoring & Troubleshooting

### Health Check
```bash
# Is database online?
curl http://localhost:8000/health

# Expected response:
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```

### Connection Pool Metrics

```python
# Check pool status
from sqlalchemy.pool import NullPool

# In your app:
pool = engine.pool
print(f"Pool size: {pool.size()}")
print(f"Checked out: {pool.checkedout()}")
print(f"Overflow: {pool.overflow()}")
```

### Common Issues

**Issue: "Too many connections"**
- Solution: Increase pool size or use PgBouncer
- Check: `SELECT count(*) FROM pg_stat_activity;`

**Issue: Connection timeout**
- Solution: Check network connectivity, firewall rules
- Check: `telnet [db-host] 5432`

**Issue: Slow queries**
- Solution: Add database indexes
- Check: Enable slow query log in PostgreSQL

```sql
-- Find slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Create index
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
```

---

## Production Deployment Checklist

- [ ] Database is Supabase or managed RDS/DO
- [ ] Connection pooling configured (pool_size, max_overflow)
- [ ] SSL/TLS enabled on database connection
- [ ] Backups enabled and tested
- [ ] Monitoring/alerts configured
- [ ] Migrations applied to production
- [ ] Database credentials in secrets manager
- [ ] Connection string uses environment variable
- [ ] CORS origins set correctly
- [ ] Health check passes (`/health` endpoint)
- [ ] Load testing completed (see PRODUCTION_READINESS.md)

---

## Next Steps

1. **Choose database service:** Supabase (easiest), AWS RDS, or DigitalOcean
2. **Set up SSL:** Use `?ssl=require` in connection string
3. **Configure pooling:** Update pool_size if using high-traffic app
4. **Run migrations:** `alembic upgrade head`
5. **Test connectivity:** `curl http://localhost:8000/health`
6. **Set up monitoring:** Configure slow query log and metrics
7. **Create backups:** Test restore procedure
