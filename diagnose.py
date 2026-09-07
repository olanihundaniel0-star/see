#!/usr/bin/env python3
"""
See Project Diagnostic Script
Checks all dependencies, configurations, and potential issues
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "see-backend"
sys.path.insert(0, str(backend_path))

def check_section(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)

def success(msg):
    print(f"✓ {msg}")

def error(msg):
    print(f"✗ {msg}")

def warning(msg):
    print(f"⚠ {msg}")

def info(msg):
    print(f"  {msg}")

# Check Python version
check_section("Python Environment")
print(f"Python: {sys.version}")
print(f"Executable: {sys.executable}")

# Check backend dependencies
check_section("Backend Dependencies")
try:
    import fastapi
    success(f"fastapi {fastapi.__version__}")
except ImportError as e:
    error(f"fastapi not installed: {e}")

try:
    import sqlalchemy
    success(f"sqlalchemy {sqlalchemy.__version__}")
except ImportError as e:
    error(f"sqlalchemy not installed: {e}")

try:
    import celery
    success(f"celery {celery.__version__}")
except ImportError as e:
    error(f"celery not installed: {e}")

try:
    import redis
    success(f"redis {redis.__version__}")
except ImportError as e:
    error(f"redis not installed: {e}")

try:
    import asyncpg
    success(f"asyncpg {asyncpg.__version__}")
except ImportError as e:
    error(f"asyncpg not installed: {e}")

try:
    import pydantic
    success(f"pydantic {pydantic.__version__}")
except ImportError as e:
    error(f"pydantic not installed: {e}")

try:
    import jwt
    success(f"pyjwt {jwt.__version__}")
except ImportError as e:
    error(f"pyjwt not installed: {e}")

try:
    from bs4 import BeautifulSoup
    success("beautifulsoup4 installed")
except ImportError as e:
    error(f"beautifulsoup4 not installed: {e}")

# Check backend imports
check_section("Backend Application Imports")
try:
    from app.main import app
    success("FastAPI app imports successfully")
except Exception as e:
    error(f"FastAPI app import failed: {e}")

try:
    from app.core.config import settings
    success("Config imports successfully")
    info(f"DATABASE_URL: {settings.DATABASE_URL[:50]}...")
    info(f"REDIS_URL: {settings.REDIS_URL}")
    
    if settings.SUPABASE_JWT_SECRET == "replace-me":
        warning("SUPABASE_JWT_SECRET not configured")
    else:
        success("SUPABASE_JWT_SECRET configured")
    
    if settings.MAILGUN_SIGNING_KEY == "replace-me":
        warning("MAILGUN_SIGNING_KEY not configured")
    else:
        success("MAILGUN_SIGNING_KEY configured")
        
except Exception as e:
    error(f"Config import failed: {e}")

try:
    from app.core.database import engine, get_db
    success("Database engine imports successfully")
except Exception as e:
    error(f"Database import failed: {e}")

try:
    from app.core.auth import get_current_user_id
    success("Auth module imports successfully")
except Exception as e:
    error(f"Auth import failed: {e}")

# Check models
check_section("Database Models")
try:
    from app.models import (
        JobApplication, 
        JobChecklist, 
        JobStatus,
        Note, 
        Reminder, 
        ReminderPriority,
        ScrapedEvent
    )
    success("All models import successfully")
except Exception as e:
    error(f"Model import failed: {e}")

# Check schemas
check_section("Pydantic Schemas")
try:
    from app.schemas import (
        JobApplicationCreate,
        JobApplicationRead,
        NoteCreate,
        NoteRead,
        EventRead,
        EmailExtractionResult
    )
    success("All schemas import successfully")
except Exception as e:
    error(f"Schema import failed: {e}")

# Check API endpoints
check_section("API Endpoints")
try:
    from app.api.v1.endpoints import (
        dashboard,
        jobs,
        notes,
        events,
        reminders,
        quick_add,
        webhooks
    )
    success("All endpoint modules import successfully")
except Exception as e:
    error(f"Endpoint import failed: {e}")

# Check workers
check_section("Celery Workers")
try:
    from app.workers.celery_app import celery_app
    success("Celery app imports successfully")
    info(f"Broker: {celery_app.conf.broker_url}")
    info(f"Backend: {celery_app.conf.result_backend}")
except Exception as e:
    error(f"Celery app import failed: {e}")

try:
    from app.workers.tasks import (
        scrape_devpost_events,
        scrape_luma_events,
        extract_email
    )
    success("All worker tasks import successfully")
except Exception as e:
    error(f"Worker task import failed: {e}")

try:
    from app.workers.ingest import (
        scrape_devpost_events as ingest_devpost,
        scrape_luma_events as ingest_luma
    )
    success("Ingest workers import successfully")
except Exception as e:
    error(f"Ingest worker import failed: {e}")

try:
    from app.workers.email import (
        normalize_mailgun_webhook_payload,
        build_email_extraction_payload
    )
    success("Email workers import successfully")
except Exception as e:
    error(f"Email worker import failed: {e}")

# Check database connectivity
check_section("Database Connectivity")
try:
    from app.core.database import engine
    import asyncio
    
    async def test_db():
        try:
            async with engine.connect() as conn:
                await conn.execute(sqlalchemy.text("SELECT 1"))
                return True
        except Exception as e:
            return str(e)
    
    result = asyncio.run(test_db())
    if result is True:
        success("Database connection successful")
    else:
        error(f"Database connection failed: {result}")
except Exception as e:
    error(f"Database test failed: {e}")

# Check Redis connectivity
check_section("Redis Connectivity")
try:
    import redis
    from app.core.config import settings
    
    r = redis.from_url(settings.REDIS_URL)
    r.ping()
    success("Redis connection successful")
except Exception as e:
    error(f"Redis connection failed: {e}")

# Check environment files
check_section("Environment Configuration")
backend_env = backend_path / ".env"
if backend_env.exists():
    success("Backend .env file exists")
else:
    warning("Backend .env file missing (using defaults)")

app_env = Path(__file__).parent / "see-app" / ".env"
if app_env.exists():
    success("Frontend .env file exists")
else:
    warning("Frontend .env file missing (using defaults)")

# Check migrations
check_section("Database Migrations")
migrations_dir = backend_path / "alembic" / "versions"
if migrations_dir.exists():
    migrations = list(migrations_dir.glob("*.py"))
    migrations = [m for m in migrations if not m.name.startswith("__")]
    success(f"Found {len(migrations)} migration files")
    for migration in migrations:
        info(f"  - {migration.name}")
else:
    error("Migrations directory not found")

# Check Alembic current version
try:
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from alembic.runtime.environment import EnvironmentContext
    from sqlalchemy import create_engine, pool
    
    info("Note: Cannot check current migration version without database connection")
except Exception as e:
    warning(f"Alembic check skipped: {e}")

# Frontend checks
check_section("Frontend Configuration")
app_dir = Path(__file__).parent / "see-app"
node_modules = app_dir / "node_modules"
if node_modules.exists():
    success("Frontend node_modules exists")
    package_count = len(list(node_modules.iterdir()))
    info(f"  ~{package_count} packages installed")
else:
    error("Frontend node_modules missing - run 'npm install'")

package_json = app_dir / "package.json"
if package_json.exists():
    success("package.json exists")
    import json
    with open(package_json) as f:
        pkg = json.load(f)
        info(f"  App name: {pkg.get('name')}")
        info(f"  Version: {pkg.get('version')}")
else:
    error("package.json missing")

# Summary
check_section("Summary")
print("\nQuick Start Commands:")
print("\n  Backend:")
print("    cd see-backend")
print("    cp .env.example .env  # Edit with real values")
print("    .venv/bin/alembic upgrade head")
print("    .venv/bin/uvicorn app.main:app --reload")
print("\n  Frontend:")
print("    cd see-app")
print("    npx expo start")
print("\n  Workers:")
print("    cd see-backend")
print("    .venv/bin/celery -A app.workers.celery_app worker -l info")
print("\n  Scheduler:")
print("    .venv/bin/celery -A app.workers.celery_app beat -l info")

print("\n" + "="*60)
print(" Diagnostic Complete")
print("="*60 + "\n")
